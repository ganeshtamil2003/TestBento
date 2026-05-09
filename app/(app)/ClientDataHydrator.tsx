'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'
import { getActiveProfiles } from '@/app/actions/profiles'

import { toast } from 'sonner'
import { AppNotification } from '@/types'

export default function ClientDataHydrator({ children }: { children: React.ReactNode }) {
  const { setInitialData, addNotification } = useAppStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let subscription: any = null

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

        // --- Notification Logic ---
        if (notifications && notifications.length > 0) {
          const unreadCount = notifications.filter(n => !n.is_read).length
          if (unreadCount > 0) {
            toast(`You have ${unreadCount} new message${unreadCount > 1 ? 's' : ''}`)
          }
        }

        // Auto-cleanup: Delete read notifications older than 2 days
        const twoDaysAgo = new Date()
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
        await supabase
          .from('notifications')
          .delete()
          .eq('is_read', true)
          .lt('created_at', twoDaysAgo.toISOString())

        // Real-time subscription for new notifications
        subscription = supabase
          .channel('public:notifications')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications' },
            (payload) => {
              const newNotification = payload.new as AppNotification
              addNotification(newNotification)
              toast(newNotification.title, { description: newNotification.message })
            }
          )
          .subscribe()

      } catch (err) {
        console.error('Error hydrating store:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    return () => {
      if (subscription) {
        createClient().removeChannel(subscription)
      }
    }
  }, [setInitialData, addNotification])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-muted-foreground animate-pulse">
        Initializing Workspace...
      </div>
    )
  }

  return <>{children}</>
}
