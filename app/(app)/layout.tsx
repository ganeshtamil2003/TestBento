import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientLayout from './ClientLayout'
import type { Profile } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  
  const { data: { session }, error: authError } = await supabase.auth.getSession()

  if (authError || !session) {
    redirect('/login')
  }

  // Fetch the user's RBAC profile
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  let userProfile = profileData as Profile

  // If they have auth but no profile (e.g. email confirmation bypassed the signup action before creating profile),
  // auto-create it right here before rendering.
  if (!userProfile) {
    const { data: newProfile, error: insertError } = await supabase.from('profiles').insert({
      id: session.user.id,
      email: session.user.email || '',
      full_name: session.user.email?.split('@')[0] || 'Unknown User',
      global_role: 'ADMIN' // Default first users to Admin for testing
    }).select().single()

    if (!insertError && newProfile) {
      userProfile = newProfile as Profile
    } else {
      // Extreme fallback so the UI never crashes / loops
      userProfile = { 
        id: session.user.id, 
        email: session.user.email || '',
        full_name: 'Fallback User', 
        global_role: 'QA_ENGINEER' 
      } as Profile
    }
  }

  return (
    <ClientLayout userProfile={userProfile}>
      {children}
    </ClientLayout>
  )
}

