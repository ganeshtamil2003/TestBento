'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { Bug, ChevronRight, ExternalLink, Search, Filter, AlertCircle, CheckCircle2, CircleDashed } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/audit'
import { can } from '@/lib/permissions'
import { createNotification } from '@/lib/notifications'
import type { Defect, DefectStatus } from '@/types'

const STATUS_COLORS: Record<DefectStatus, string> = {
  OPEN: 'bg-slate-100 text-slate-700 border-slate-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
  RESOLVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-200 text-slate-500 border-slate-300'
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-blue-100 text-blue-700 border-blue-200',
  LOW: 'bg-slate-100 text-slate-700 border-slate-200',
}

export default function DefectsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const store = useAppStore()
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  
  const [selectedDefects, setSelectedDefects] = useState<string[]>([])
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const supabase = createClient()

  const project = store.projects.find(p => p.id === projectId)
  const projectMembers = store.profiles.filter(p => p.status === 'ACTIVE')
  
  // Aggregate all defects for this project
  const allDefects = store.defects
    .filter(d => d.project_id === projectId)
    .map(d => {
      const tc = store.testCases.find(t => t.id === d.test_case_id)
      return {
        ...d,
        testCaseTitle: tc?.title || 'Unknown Test Case',
      }
    })
    .filter(d => {
      const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) || 
                           d.testCaseTitle.toLowerCase().includes(search.toLowerCase())
      const matchesSeverity = severityFilter === 'ALL' || d.severity === severityFilter
      const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter
      return matchesSearch && matchesSeverity && matchesStatus
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Summary Metrics
  const projectDefects = store.defects.filter(d => d.project_id === projectId)
  const totalOpen = projectDefects.filter(d => d.status === 'OPEN').length
  const totalInProgress = projectDefects.filter(d => d.status === 'IN_PROGRESS').length
  const totalResolved = projectDefects.filter(d => d.status === 'RESOLVED' || d.status === 'CLOSED').length
  const totalCriticalHigh = projectDefects.filter(d => (d.severity === 'CRITICAL' || d.severity === 'HIGH') && d.status !== 'CLOSED' && d.status !== 'RESOLVED').length

  const canEdit = can(store.currentUser?.global_role, 'updateExecution')

  async function handleStatusChange(defectId: string, newStatus: DefectStatus) {
    if (!canEdit || isUpdating) return
    setIsUpdating(defectId)
    try {
      const { error } = await supabase.from('defects').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', defectId)
      if (!error) {
        store.updateDefect(defectId, { status: newStatus })
        const d = store.defects.find(x => x.id === defectId)
        if (d) {
          logAudit(supabase, {
            projectId,
            userId: store.currentUser.id,
            action: 'UPDATE',
            entityType: 'DEFECT',
            entityId: d.id,
            entityTitle: d.title,
            details: { field: 'status', from: d.status, to: newStatus }
          })
        }
      }
    } finally {
      setIsUpdating(null)
    }
  }

  async function handleAssigneeChange(defectId: string, assigneeId: string) {
    if (!canEdit || isUpdating) return
    setIsUpdating(defectId)
    try {
      const { error } = await supabase.from('defects').update({ assigned_to: assigneeId || null, updated_at: new Date().toISOString() }).eq('id', defectId)
      if (!error) {
        store.updateDefect(defectId, { assigned_to: assigneeId || undefined })
        const d = store.defects.find(x => x.id === defectId)
        if (d) {
          logAudit(supabase, {
            projectId,
            userId: store.currentUser.id,
            action: 'UPDATE',
            entityType: 'DEFECT',
            entityId: d.id,
            entityTitle: d.title,
            details: { field: 'assigned_to', to: store.profiles.find(p => p.id === assigneeId)?.full_name || 'Unassigned' }
          })
          
          if (assigneeId && assigneeId !== store.currentUser.id) {
            createNotification(supabase, store.addNotification, {
              userId: assigneeId,
              title: 'Defect Assigned',
              message: `You have been assigned to defect: ${d.title}`,
              link: `/projects/${projectId}/defects`
            })
          }
        }
      }
    } finally {
      setIsUpdating(null)
    }
  }

  const allSelected = allDefects.length > 0 && selectedDefects.length === allDefects.length
  function toggleAll() {
    setSelectedDefects(allSelected ? [] : allDefects.map(d => d.id))
  }
  function toggleDefect(id: string) {
    setSelectedDefects(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleBulkStatus(newStatus: DefectStatus) {
    if (selectedDefects.length === 0 || isBulkUpdating || !canEdit) return
    setIsBulkUpdating(true)
    try {
      const { error } = await supabase.from('defects').update({ status: newStatus, updated_at: new Date().toISOString() }).in('id', selectedDefects)
      if (!error) {
        selectedDefects.forEach(id => store.updateDefect(id, { status: newStatus }))
        logAudit(supabase, {
          projectId,
          userId: store.currentUser.id,
          action: 'UPDATE',
          entityType: 'DEFECT',
          entityId: selectedDefects[0],
          entityTitle: `Bulk updated ${selectedDefects.length} defects to ${newStatus}`,
        })
      }
    } finally {
      setIsBulkUpdating(false)
      setSelectedDefects([])
    }
  }

  async function handleBulkAssign(assigneeId: string) {
    if (selectedDefects.length === 0 || isBulkUpdating || !canEdit) return
    setIsBulkUpdating(true)
    try {
      const { error } = await supabase.from('defects').update({ assigned_to: assigneeId || null, updated_at: new Date().toISOString() }).in('id', selectedDefects)
      if (!error) {
        selectedDefects.forEach(id => store.updateDefect(id, { assigned_to: assigneeId || undefined }))
        logAudit(supabase, {
          projectId,
          userId: store.currentUser.id,
          action: 'UPDATE',
          entityType: 'DEFECT',
          entityId: selectedDefects[0],
          entityTitle: `Bulk assigned ${selectedDefects.length} defects`,
        })

        if (assigneeId && assigneeId !== store.currentUser.id) {
          createNotification(supabase, store.addNotification, {
            userId: assigneeId,
            title: 'Multiple Defects Assigned',
            message: `You have been assigned ${selectedDefects.length} new defects in ${project?.name || 'a project'}.`,
            link: `/projects/${projectId}/defects`
          })
        }
      }
    } finally {
      setIsBulkUpdating(false)
      setSelectedDefects([])
    }
  }

  if (!project) return <div className="p-8 text-muted-foreground">Project not found.</div>

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Link href="/projects" className="hover:text-foreground">Projects</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">{project.name}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Defects</span>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <Bug className="w-6 h-6 text-red-600" />
            Defect Management
          </h1>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-lg"><AlertCircle className="w-6 h-6" /></div>
          <div>
            <div className="text-2xl font-bold">{totalCriticalHigh}</div>
            <div className="text-xs text-muted-foreground uppercase font-semibold">Active Critical/High</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-600 rounded-lg"><CircleDashed className="w-6 h-6" /></div>
          <div>
            <div className="text-2xl font-bold">{totalOpen}</div>
            <div className="text-xs text-muted-foreground uppercase font-semibold">Open Defects</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Bug className="w-6 h-6" /></div>
          <div>
            <div className="text-2xl font-bold">{totalInProgress}</div>
            <div className="text-xs text-muted-foreground uppercase font-semibold">In Progress</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg"><CheckCircle2 className="w-6 h-6" /></div>
          <div>
            <div className="text-2xl font-bold">{totalResolved}</div>
            <div className="text-xs text-muted-foreground uppercase font-semibold">Resolved/Closed</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search defects or test cases..."
            className="input pl-10 h-10 w-full"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select 
            className="input h-10 px-3 cursor-pointer"
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Only</option>
            <option value="MEDIUM">Medium Only</option>
            <option value="LOW">Low Only</option>
          </select>
          <select 
            className="input h-10 px-3 cursor-pointer"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Defects Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10 text-center">
                  <input type="checkbox" className="accent-primary" checked={allSelected} onChange={toggleAll} />
                </th>
                <th>Bug Title</th>
                <th>Status</th>
                <th>Severity</th>
                <th>Assigned To</th>
                <th>Source Test Case</th>
                <th>Logged Date</th>
                <th>Links</th>
              </tr>
            </thead>
            <tbody>
              {allDefects.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    {search || severityFilter !== 'ALL' || statusFilter !== 'ALL' ? 'No defects match your filters.' : 'No defects logged for this project yet.'}
                  </td>
                </tr>
              )}
              {allDefects.map((defect) => (
                <tr key={defect.id} className={cn(isUpdating === defect.id ? 'opacity-50' : '', selectedDefects.includes(defect.id) ? 'bg-accent/30' : '')}>
                  <td className="text-center">
                    <input type="checkbox" className="accent-primary" checked={selectedDefects.includes(defect.id)} onChange={() => toggleDefect(defect.id)} />
                  </td>
                  <td>
                    <div className="font-semibold text-sm">{defect.title}</div>
                    {defect.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{defect.description}</div>}
                  </td>
                  <td>
                    {canEdit ? (
                      <select 
                        className={cn('text-xs font-semibold py-1 px-2 rounded border cursor-pointer outline-none', STATUS_COLORS[defect.status])}
                        value={defect.status}
                        onChange={(e) => handleStatusChange(defect.id, e.target.value as DefectStatus)}
                        disabled={isUpdating === defect.id}
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    ) : (
                      <span className={cn('badge text-[10px] px-2 py-0.5 border', STATUS_COLORS[defect.status])}>
                        {defect.status.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={cn('badge text-[10px] px-2 py-0.5 border', SEVERITY_COLORS[defect.severity])}>
                      {defect.severity}
                    </span>
                  </td>
                  <td>
                    {canEdit ? (
                      <select
                        className="text-xs p-1 rounded border bg-transparent"
                        value={defect.assigned_to || ''}
                        onChange={(e) => handleAssigneeChange(defect.id, e.target.value)}
                        disabled={isUpdating === defect.id}
                      >
                        <option value="">Unassigned</option>
                        {projectMembers.map(m => (
                          <option key={m.id} value={m.id}>{m.full_name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {projectMembers.find(p => p.id === defect.assigned_to)?.full_name || 'Unassigned'}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="text-sm max-w-[150px] truncate" title={defect.testCaseTitle}>{defect.testCaseTitle}</div>
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {formatDate(defect.created_at)}
                  </td>
                  <td>
                    {defect.jira_url ? (
                      <a 
                        href={defect.jira_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn-secondary btn-sm h-8 px-2 flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Jira
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedDefects.length > 0 && canEdit && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in flex items-center gap-4 bg-card border border-border shadow-2xl rounded-full px-6 py-3">
          <span className="text-sm font-medium">{selectedDefects.length} selected</span>
          <div className="h-4 w-px bg-border"></div>
          
          <select 
            className="text-xs bg-muted border-none rounded py-1.5 px-2 outline-none cursor-pointer"
            onChange={e => { if (e.target.value) handleBulkStatus(e.target.value as DefectStatus) }}
            value=""
          >
            <option value="" disabled>Set Status...</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select 
            className="text-xs bg-muted border-none rounded py-1.5 px-2 outline-none cursor-pointer"
            onChange={e => { handleBulkAssign(e.target.value) }}
            value=""
          >
            <option value="" disabled>Assign To...</option>
            <option value="">Unassigned</option>
            {projectMembers.map(m => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
