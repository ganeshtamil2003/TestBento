'use client'

import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { useAppStore } from '@/store/appStore'
import { useEffect } from 'react'
import type { Profile } from '@/types'

import ClientDataHydrator from './ClientDataHydrator'

export default function ClientLayout({ children, userProfile }: { children: React.ReactNode, userProfile: Profile }) {
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const currentUser = useAppStore((s) => s.currentUser)

  // Hydrate global store with the authenticated user profile
  useEffect(() => {
    if (userProfile && currentUser.id !== userProfile.id) {
      setCurrentUser(userProfile)
    }
  }, [userProfile, currentUser.id, setCurrentUser])

  return (
    <ClientDataHydrator>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </ClientDataHydrator>
  )
}
