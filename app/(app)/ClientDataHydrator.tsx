'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'
import { getActiveProfiles } from '@/app/actions/profiles'

export default function ClientDataHydrator({ children }: { children: React.ReactNode }) {
  const setInitialData = useAppStore((s) => s.setInitialData)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      try {
        // Fetch everything in parallel since DB is small/relational
        const [
          { data: projects },
          { data: epics },
          { data: features },
          { data: userStories },
          { data: testCases },
          { data: reviewCycles },
          { data: executionCycles },
          { data: executionItems },
          { data: defects },
          { data: projectMembers },
          { data: notifications }
        ] = await Promise.all([
          supabase.from('projects').select('*'),
          supabase.from('epics').select('*'),
          supabase.from('features').select('*'),
          supabase.from('user_stories').select('*'),
          supabase.from('test_cases').select('*'),
          supabase.from('review_cycles').select('*'),
          supabase.from('execution_cycles').select('*'),
          supabase.from('execution_items').select('*'),
          supabase.from('defects').select('*'),
          supabase.from('project_members').select('*, profile:user_id(*)'),
          supabase.from('notifications').select('*').order('created_at', { ascending: false })
        ])

        const profiles = await getActiveProfiles()

        setInitialData({
          projects: projects || [],
          epics: epics || [],
          features: features || [],
          userStories: userStories || [],
          testCases: testCases || [],
          reviewCycles: reviewCycles || [],
          executionCycles: executionCycles || [],
          executionItems: executionItems || [],
          defects: defects || [],
          projectMembers: projectMembers || [],
          notifications: notifications || [],
          profiles: profiles || []
        })
      } catch (err) {
        console.error('Error hydrating store:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [setInitialData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-muted-foreground animate-pulse">
        Initializing Workspace...
      </div>
    )
  }

  return <>{children}</>
}
