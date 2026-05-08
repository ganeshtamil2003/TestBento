'use client'

import { useAppStore } from '@/store/appStore'
import { Mail, Briefcase, Calendar, Shield, Activity, UserCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export default function ProfilePage() {
  const { currentUser, notifications, executionItems } = useAppStore()

  const myExecutions = executionItems.filter(ei => ei.executed_by === currentUser.id)
  const passCount = myExecutions.filter(ei => ei.status === 'PASS').length
  const failCount = myExecutions.filter(ei => ei.status === 'FAIL').length
  
  const recentActivity = notifications
    .filter(n => n.user_id === currentUser.id)
    .slice(0, 10)

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary border border-primary/20">
          <UserCircle className="w-10 h-10" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{currentUser.full_name}</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <Mail className="w-4 h-4" /> {currentUser.email}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="space-y-6">
          <div className="card">
            <div className="card-header border-b px-5 py-4">
              <h3 className="font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4 text-muted-foreground" /> Professional Info</h3>
            </div>
            <div className="card-body p-5 space-y-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase font-semibold tracking-wider">System Role</div>
                <div className="font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-500" />
                  {currentUser.global_role.replace('_', ' ')}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase font-semibold tracking-wider">Status</div>
                <span className="badge bg-green-100 text-green-700 border-green-200">
                  {currentUser.status}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase font-semibold tracking-wider">Member Since</div>
                <div className="font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  {new Date(currentUser.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header border-b px-5 py-4">
              <h3 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-muted-foreground" /> Testing Stats</h3>
            </div>
            <div className="card-body p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Tests Executed</span>
                <span className="font-bold">{myExecutions.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Passes</span>
                <span className="font-bold text-green-600">{passCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Failures</span>
                <span className="font-bold text-red-600">{failCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Activity */}
        <div className="md:col-span-2">
          <div className="card h-full">
            <div className="card-header border-b px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold">Recent Notifications</h3>
            </div>
            <div className="card-body p-0">
              {recentActivity.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No recent activity.
                </div>
              ) : (
                <div className="divide-y">
                  {recentActivity.map(act => (
                    <div key={act.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{act.title}</p>
                          <p className="text-muted-foreground text-sm mt-0.5">{act.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDateTime(act.created_at)}
                          </p>
                        </div>
                        {act.link && (
                          <Link href={act.link} className="btn-secondary btn-sm">
                            View
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
