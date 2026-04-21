'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/types'

export async function getActiveProfiles(): Promise<Profile[]> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) return []

  const { data: profiles } = await supabase.from('profiles').select('*')
  
  const adminClient = createAdminClient()
  const { data: authUsers } = await adminClient.auth.admin.listUsers()

  if (!profiles) return []

  return profiles.map(p => {
    const authUser = authUsers?.users.find(u => u.id === p.id)
    const isBanned = !!authUser?.banned_until
    return { ...p, status: isBanned ? 'SUSPENDED' : 'ACTIVE' } as Profile
  })
}
