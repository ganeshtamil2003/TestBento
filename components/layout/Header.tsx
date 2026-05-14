'use client'

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import NotificationBell from './NotificationBell'

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/admin': 'User Management',
}

function getBreadcrumb(path: string): string {
  if (path === '/dashboard') return 'Dashboard'
  if (path === '/projects') return 'Projects'
  if (path === '/admin') return 'Admin'
  if (path.includes('/test-cases')) return 'Test Cases'
  if (path.includes('/hierarchy')) return 'Hierarchy'
  if (path.includes('/reviews')) return 'Reviews'
  if (path.includes('/execution')) return 'Execution'
  if (path.includes('/rtm')) return 'Traceability Matrix'
  if (path.includes('/reports')) return 'Reports'
  return 'TestBento'
}

export default function Header() {
  const pathname = usePathname()
  const { currentUser } = useAppStore()

  return (
    <header className="h-14 flex items-center justify-between px-6 flex-shrink-0" style={{ borderBottom: '1px solid rgba(226,232,240,0.6)', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div>
        <h1 className="text-base font-bold text-foreground">{getBreadcrumb(pathname)}</h1>
        <p className="text-xs text-muted-foreground">Welcome back, {currentUser.full_name.split(' ')[0]}</p>
      </div>
      <div className="flex items-center gap-3">

        <NotificationBell />
      </div>
    </header>
  )
}
