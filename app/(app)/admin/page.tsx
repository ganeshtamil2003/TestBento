import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  // Enforce Route Guard: Must be ADMIN
  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', session.user.id)
    .single()

  if (profile?.global_role !== 'ADMIN') {
    return (
      <div className="p-12 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You do not have the Administrator privileges required to view this page.</p>
      </div>
    )
  }

  // Fetch all profiles
  const { data: allProfiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="text-red-500">Failed to load users: {error.message}</div>
  }

  // Fetch Auth Users to map the Ban states
  const adminClient = createAdminClient()
  const { data: authUsers } = await adminClient.auth.admin.listUsers()

  const profilesWithStatus = allProfiles.map(p => {
    const authProfile = authUsers?.users.find(u => u.id === p.id)
    return { ...p, status: !authProfile?.banned_until ? 'ACTIVE' : 'SUSPENDED' }
  })

  return <AdminClient profiles={profilesWithStatus as Profile[]} />
}
