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
    <ClientDataHydrator userId={userProfile.id}>
      <div className="flex h-screen overflow-hidden" style={{ padding: '10px', gap: '10px' }}>
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden rounded-2xl" style={{ background: 'rgba(255,255,255,0.28)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.55)', boxShadow: '0 4px 32px rgba(100,130,200,0.18)' }}>
          <Header />
          <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </ClientDataHydrator>
  )
}
