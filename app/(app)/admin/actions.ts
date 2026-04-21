'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function inviteUser(formData: FormData) {
  // 1. Verify caller is an Administrator
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) return { error: 'Unauthorized' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', session.user.id)
    .single()

  if (callerProfile?.global_role !== 'ADMIN') {
    return { error: 'Forbidden: Only Administrators can create users.' }
  }

  // 2. Parse form
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const globalRole = formData.get('global_role') as string

  if (!email || !password || !fullName || !globalRole) {
    return { error: 'All fields are required.' }
  }

  // 3. Create user in Supabase Auth (admin API bypasses email checking/session overriding)
  const adminClient = createAdminClient()
  
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm so they can use the credentials immediately
  })

  if (error) {
    return { error: error.message }
  }

  // 4. Create their RBAC Profile
  if (data.user) {
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: data.user.id,
      email,
      full_name: fullName,
      global_role: globalRole
    })

    if (profileError) {
      console.error("Profile creation error for invited user:", profileError)
      // Cleanup auth user if profile fails (atomic rollback simulation)
      await adminClient.auth.admin.deleteUser(data.user.id)
      return { error: 'Failed to create user profile database record. Reverted.' }
    }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function toggleUserStatus(userId: string, targetActiveStatus: boolean) {
  // 1. Verify caller is an Administrator
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Unauthorized' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', session.user.id)
    .single()

  if (callerProfile?.global_role !== 'ADMIN') {
    return { error: 'Forbidden' }
  }

  // 2. Perform the ban/unban using the Admin SDK
  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: targetActiveStatus ? 'none' : '876000h' // Unban, or 100 years Ban
  })

  // 3. Mirror the status heavily into the profiles table for client hydration queries
  await adminClient.from('profiles').update({
    status: targetActiveStatus ? 'ACTIVE' : 'SUSPENDED'
  }).eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin')
  return { success: true }
}
