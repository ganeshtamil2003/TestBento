'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Search, Activity, History, Download } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import ExportDropdown from '@/components/layout/ExportDropdown'
import { exportToCSV, exportToExcel, exportTableToPDF } from '@/lib/export'
import { createClient } from '@/lib/supabase/client'
import { cn, getInitials } from '@/lib/utils'
import type { AuditLog } from '@/types'

export default function AuditLogsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const store = useAppStore()
  const project = store.projects.find(p => p.id === projectId)
  const supabase = createClient()

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => {
    async function fetchLogs() {
      if (!projectId) return
      setLoading(true)
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          user:profiles (
            id,
            email,
            full_name,
            avatar_url,
            global_role
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (!error && data) {
        setLogs(data as unknown as AuditLog[])
      }
      setLoading(false)
    }
    fetchLogs()
  }, [projectId])

  const filtered = logs.filter(log => {
    const matchSearch = 
      log.user?.full_name?.toLowerCase().includes(search.toLowerCase())
    
    const matchAction = !actionFilter || log.action === actionFilter
    
    return matchSearch && matchAction
  })

  const ACTION_COLORS: Record<string, string> = {
    CREATE: 'bg-emerald-500/10 text-emerald-500',
    UPDATE: 'bg-blue-500/10 text-blue-500',
    DELETE: 'bg-red-500/10 text-red-500'
  }

  if (!project) return <div className="text-muted-foreground p-8">Project not found.</div>

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Link href="/projects" className="hover:text-foreground">Projects</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">{project.name}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Audit Logs</span>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <History className="w-6 h-6" /> 
            Audit Logs
          </h1>
        </div>
        <div className="flex items-center gap-2 no-print">
          <ExportDropdown 
            onExportCSV={() => exportToCSV('audit_logs', filtered.map(log => ({
              'Action': log.action,
              'User': log.user?.full_name || 'Unknown',
              'Entity Type': log.entity_type,
              'Entity Title': log.entity_title || '',
              'Details': log.details ? JSON.stringify(log.details) : '',
              'Date': new Date(log.created_at).toLocaleString()
            })))}
            onExportExcel={() => exportToExcel('audit_logs', 'Logs', filtered.map(log => ({
              'Action': log.action,
              'User': log.user?.full_name || 'Unknown',
              'Entity Type': log.entity_type,
              'Entity Title': log.entity_title || '',
              'Details': log.details ? JSON.stringify(log.details) : '',
              'Date': new Date(log.created_at).toLocaleString()
            })))}
            onExportPDF={() => exportTableToPDF('audit_logs', 'Logs', filtered.map(log => ({
              'Action': log.action,
              'User': log.user?.full_name || 'Unknown',
              'Entity Type': log.entity_type,
              'Entity Title': log.entity_title || '',
              'Date': new Date(log.created_at).toLocaleString()
            })))}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="card card-body py-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              className="form-input pl-9" 
              placeholder="Search by user name..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <select className="form-input w-40" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12">Action</th>
                <th>User</th>
                <th>Item Changed</th>
                <th>Specific Changes</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading logs...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No audit logs found.</td></tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className={cn('badge text-xs px-2 py-0.5', ACTION_COLORS[log.action] || 'bg-gray-500/10 text-gray-500')}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full gradient-info flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[10px] font-bold">
                            {getInitials(log.user?.full_name)}
                          </span>
                        </div>
                        <div className="text-sm font-medium">{log.user?.full_name || 'Unknown'}</div>
                      </div>
                    </td>
                    <td>
                      <div className="text-sm font-medium text-foreground">{log.entity_title || 'Unknown Entity'}</div>
                      <div className="text-xs text-muted-foreground">{log.entity_type.replace('_', ' ')}</div>
                    </td>
                    <td className="text-xs text-muted-foreground max-w-xs">
                      {log.details ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(log.details).map(([k, v]) => (
                            <span key={k} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground border border-border inline-flex items-center">
                              <span className="font-medium text-foreground mr-1 capitalize">{k}:</span>
                              <span className="truncate max-w-[150px]">{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
