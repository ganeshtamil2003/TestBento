'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, FolderKanban, TestTube2, CheckCircle2,
  GitBranch, BarChart3, Users, ChevronRight, LayoutGrid, GitMerge, LogOut, Bug, Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { getInitials } from '@/lib/utils'
import { logout } from '@/app/(auth)/login/actions'

const topNav = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/projects', icon: FolderKanban, label: 'Projects' },
]

const bottomNav = [
  { href: '/admin', icon: Users, label: 'User Management' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { currentUser } = useAppStore()

  // Detect current project from URL: /projects/[projectId]/...
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  const currentProjectId = projectMatch ? projectMatch[1] : null
  const base = currentProjectId ? `/projects/${currentProjectId}` : '/projects'

  const quickLinks = [
    { href: `${base}/test-cases`, segment: 'test-cases', icon: TestTube2,   label: 'Test Cases' },
    { href: `${base}/reviews`,    segment: 'reviews',    icon: CheckCircle2, label: 'Reviews'    },
    { href: `${base}/execution`,  segment: 'execution',  icon: GitBranch,    label: 'Execution'  },
    { href: `${base}/defects`,    segment: 'defects',    icon: Bug,          label: 'Defects'    },
    { href: `${base}/rtm`,        segment: 'rtm',        icon: GitMerge,     label: 'RTM'        },
    { href: `${base}/reports`,    segment: 'reports',    icon: BarChart3,    label: 'Reports'    },
    { href: `${base}/members`,    segment: 'members',    icon: Users,        label: 'Members'    },
    { href: `${base}/audit-logs`, segment: 'audit-logs', icon: Activity,     label: 'Audit Logs' },
  ]

  return (
    <aside className="w-64 flex flex-col h-full" style={{ background: 'hsl(var(--sidebar))' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 bg-black">
          <img src="/images/logo.png" alt="TestBento Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="text-white font-bold text-sm leading-tight tracking-tight">TestBento</div>
          <div className="text-sidebar-foreground/50 text-xs font-medium uppercase tracking-tighter">Organized QA Hub</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {topNav.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn('sidebar-item', pathname === href || pathname.startsWith(href + '/') ? 'active' : '')}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}

        <div className="pt-4 pb-1">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40 mb-2">
            {currentProjectId ? 'Current Project' : 'Quick Links'}
          </p>
          {quickLinks.map(({ href, segment, icon: Icon, label }) => {
            const isActive = pathname.includes(`/${segment}`)
            const isDisabled = !currentProjectId
            
            return (
              <Link
                key={segment}
                href={isDisabled ? '#' : href}
                onClick={(e) => isDisabled && e.preventDefault()}
                className={cn(
                  'sidebar-item transition-all duration-200 group', 
                  isActive ? 'active' : '',
                  isDisabled ? 'opacity-40 cursor-not-allowed grayscale' : ''
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {isDisabled && (
                  <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-white bg-white/10 px-1.5 py-0.5 rounded border border-white/20 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    Select Project
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        <div className="pt-2">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40 mb-2">
            Admin
          </p>
          {bottomNav.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn('sidebar-item', pathname === href ? 'active' : '')}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {/* User Profile & Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <Link href="/profile" className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent/50 border border-sidebar-border hover:bg-sidebar-accent transition-colors">
          <div className="w-8 h-8 rounded-full gradient-info flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{getInitials(currentUser?.full_name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{currentUser?.full_name || 'Loading...'}</div>
            <div className="text-sidebar-foreground/50 text-xs truncate">{currentUser?.global_role?.replace('_', ' ') || ''}</div>
          </div>
        </Link>
        <form action={logout}>
          <button type="submit" className="w-full flex items-center justify-center gap-2 py-2 text-sm text-sidebar-foreground/60 hover:text-red-400 hover:bg-sidebar-accent rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}
