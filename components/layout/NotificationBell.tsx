'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Check, ExternalLink } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function NotificationBell() {
  const { notifications, markAllNotificationsRead, currentUser } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const myNotifications = notifications.filter(n => n.user_id === currentUser.id)
  const unreadCount = myNotifications.filter(n => !n.is_read).length

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleMarkAllRead() {
    if (unreadCount === 0) return
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', currentUser.id)
      .eq('is_read', false)
    
    if (!error) {
      markAllNotificationsRead()
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        className={cn("btn-icon relative", isOpen ? "bg-accent text-accent-foreground" : "")}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-card shadow-sm"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
          <div className="p-3 border-b flex items-center justify-between bg-muted/30">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllRead}
                className="text-[10px] uppercase font-semibold text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {myNotifications.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center">
                <Bell className="w-8 h-8 text-muted/50 mb-2" />
                <p className="text-sm text-muted-foreground">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y">
                {myNotifications.map((n) => (
                  <div key={n.id} className={cn("p-3 transition-colors hover:bg-muted/50", !n.is_read ? "bg-primary/5" : "")}>
                    <div className="flex gap-3">
                      {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </span>
                          {n.link && (
                            <Link href={n.link} onClick={() => setIsOpen(false)} className="text-[10px] font-semibold text-primary flex items-center gap-1 hover:underline">
                              View <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
