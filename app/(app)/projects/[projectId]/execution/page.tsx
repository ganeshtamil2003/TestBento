'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { ChevronRight, Plus, CheckCircle, XCircle, AlertTriangle, MinusCircle, Bug, Edit2, Trash2, UserRound, ExternalLink, CheckCircle2 } from 'lucide-react'
import { STATUS_COLORS, STATUS_LABELS, cn, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { can } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'
import { toast } from 'sonner'
import type { ExecutionCycle, ExecutionItem, Defect } from '@/types'

export default function ExecutionPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const store = useAppStore()
  const project = store.projects.find(p => p.id === projectId)

  const epicIds = new Set(store.epics.filter(e => e.project_id === projectId).map(e => e.id))
  const featureIds = new Set(store.features.filter(f => epicIds.has(f.epic_id)).map(f => f.id))
  const storyIds = new Set(store.userStories.filter(s => featureIds.has(s.feature_id)).map(s => s.id))
  const projectTCs = store.testCases.filter(tc => storyIds.has(tc.story_id))
  const cycles = store.executionCycles.filter(c => c.project_id === projectId)

  const [activeCycle, setActiveCycle] = useState<string>(cycles[0]?.id || '')
  const [showCycleModal, setShowCycleModal] = useState(false)
  const [showTCModal, setShowTCModal] = useState(false)
  const [showDefectModal, setShowDefectModal] = useState<string | null>(null)
  const [viewTC, setViewTC] = useState<any>(null)
  const [viewDefectItems, setViewDefectItems] = useState<Defect[] | null>(null)
  // editItem: id of execution item being edited (reassign / notes / remove)
  const [editItem, setEditItem] = useState<{ id: string; assigned_to: string; notes: string } | null>(null)
  const [editCycleId, setEditCycleId] = useState<string | null>(null)
  const [deleteCyclePrompt, setDeleteCyclePrompt] = useState<string | null>(null)
  const [cycleForm, setCycleForm] = useState({ name: '', type: 'SPRINT', sprint_name: '', start_date: '', end_date: '' })
  const [defectForm, setDefectForm] = useState({ title: '', severity: 'HIGH', description: '', jira_url: '' })
  const [selectedTCs, setSelectedTCs] = useState<string[]>([])
  // tcAssignees: map of tcId → userId (optional per-TC assignment)
  const [tcAssignees, setTcAssignees] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  // Only users added to the project are valid assignees
  const projectMemberIds = new Set(store.projectMembers.filter(m => m.project_id === projectId).map(m => m.user_id))
  const projectMembers = store.profiles.filter(p => p.status === 'ACTIVE' && projectMemberIds.has(p.id))


  const activeItems = store.executionItems.filter(ei => ei.cycle_id === activeCycle)
  const cycle = cycles.find(c => c.id === activeCycle)
  const passCount = activeItems.filter(ei => ei.status === 'PASS').length
  const failCount = activeItems.filter(ei => ei.status === 'FAIL').length
  const blockedCount = activeItems.filter(ei => ei.status === 'BLOCKED').length
  const notRunCount = activeItems.filter(ei => ei.status === 'NOT_RUN').length
  const total = activeItems.length

  async function saveCycle(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      if (editCycleId) {
        const { data, error } = await supabase.from('execution_cycles').update({
          name: cycleForm.name,
          type: cycleForm.type,
          sprint_name: cycleForm.sprint_name,
          start_date: cycleForm.start_date,
          end_date: cycleForm.end_date,
        }).eq('id', editCycleId).select().single()

        if (!error && data) {
          store.updateExecutionCycle(editCycleId, data as ExecutionCycle)
          setShowCycleModal(false)
          setEditCycleId(null)
          setCycleForm({ name: '', type: 'SPRINT', sprint_name: '', start_date: '', end_date: '' })
        }
      } else {
        const { data, error } = await supabase.from('execution_cycles').insert({
          project_id: projectId,
          name: cycleForm.name,
          type: cycleForm.type,
          sprint_name: cycleForm.sprint_name,
          start_date: cycleForm.start_date,
          end_date: cycleForm.end_date,
          created_by: store.currentUser.id,
        }).select().single()

        if (!error && data) {
          store.addExecutionCycle({ ...data, _counts: { total: 0, pass: 0, fail: 0, blocked: 0, not_run: 0 } } as ExecutionCycle)
          setActiveCycle(data.id)
          setShowCycleModal(false)
          setCycleForm({ name: '', type: 'SPRINT', sprint_name: '', start_date: '', end_date: '' })
        }
      }
    } catch(err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function deleteCycle(cycleId: string) {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('execution_cycles').delete().eq('id', cycleId)
      if (!error) {
        store.deleteExecutionCycle(cycleId)
        if (activeCycle === cycleId) {
          setActiveCycle(cycles.find(c => c.id !== cycleId)?.id || '')
        }
        setDeleteCyclePrompt(null)
      }
    } catch(err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  function openEditCycle(c: ExecutionCycle) {
    setCycleForm({
      name: c.name,
      type: c.type,
      sprint_name: c.sprint_name || '',
      start_date: c.start_date || '',
      end_date: c.end_date || ''
    })
    setEditCycleId(c.id)
    setShowCycleModal(true)
  }

  async function addToCycle(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const payload: any[] = []
      selectedTCs.forEach(tcId => {
        if (!activeItems.some(ei => ei.test_case_id === tcId)) {
          payload.push({
            cycle_id: activeCycle,
            test_case_id: tcId,
            assigned_to: tcAssignees[tcId] || null,
            status: 'NOT_RUN',
            defects: []
          })
        }
      })

      if (payload.length > 0) {
        const { data, error } = await supabase.from('execution_items').insert(payload).select(`
          *,
          test_case:test_case_id(*),
          assignee:assigned_to(*)
        `)
        if (!error && data) {
          data.forEach(ei => store.addExecutionItem(ei as ExecutionItem))
          
          // Group assignments to send summary notifications
          const assigneeMap = new Map<string, number>()
          data.forEach(ei => {
            if (ei.assigned_to && ei.assigned_to !== store.currentUser.id) {
              assigneeMap.set(ei.assigned_to, (assigneeMap.get(ei.assigned_to) || 0) + 1)
            }
          })
          
          assigneeMap.forEach((count, userId) => {
            createNotification(supabase, store.addNotification, {
              userId,
              title: 'Test Cases Assigned',
              message: `You have been assigned ${count} test case${count > 1 ? 's' : ''} for execution in cycle "${cycle?.name || 'Unknown'}".`,
              link: `/projects/${projectId}/execution`
            })
          })
        }
      }
    } catch(err) {
      console.error(err)
    } finally {
      setSelectedTCs([])
      setTcAssignees({})
      setShowTCModal(false)
      setIsSubmitting(false)
    }
  }

  async function updateAssignee(itemId: string, assigned_to: string) {
    const newAssignedTo = assigned_to || null
    const oldItem = store.executionItems.find(ei => ei.id === itemId)
    
    // Optimistic update
    store.updateExecutionItem(itemId, { 
      assigned_to: newAssignedTo as string,
      assignee: newAssignedTo ? store.profiles.find(p => p.id === newAssignedTo) : undefined
    })

    const { error } = await supabase.from('execution_items').update({
      assigned_to: newAssignedTo
    }).eq('id', itemId)
    
    if (error) {
      store.updateExecutionItem(itemId, { 
        assigned_to: oldItem?.assigned_to,
        assignee: oldItem?.assignee
      })
      toast.error('Failed to update assignee')
    } else if (newAssignedTo && newAssignedTo !== oldItem?.assigned_to && newAssignedTo !== store.currentUser.id) {
      const tc = projectTCs.find(t => t.id === oldItem?.test_case_id) || oldItem?.test_case
      createNotification(supabase, store.addNotification, {
        userId: newAssignedTo,
        title: 'Test Case Reassigned',
        message: `You have been assigned the test case "${tc?.title || 'Unknown'}" for execution.`,
        link: `/projects/${projectId}/execution`
      })
      toast.success('Assignee updated')
    } else {
      toast.success('Assignee updated')
    }
  }

  async function updateStatus(itemId: string, status: ExecutionItem['status']) {
    const executed_by = store.currentUser.id
    const executed_at = new Date().toISOString()
    const { error } = await supabase.from('execution_items').update({ status, executed_by, executed_at }).eq('id', itemId)
    if (!error) store.updateExecutionItem(itemId, { status, executed_by, executed_at })
  }

  async function addDefect(itemId: string) {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const item = store.executionItems.find(ei => ei.id === itemId)
      if (!item) return
      
      const newDefect = {
        project_id: projectId,
        execution_item_id: itemId,
        test_case_id: item.test_case_id,
        title: defectForm.title,
        severity: defectForm.severity,
        description: defectForm.description,
        jira_url: defectForm.jira_url,
        created_by: store.currentUser.id,
        assigned_to: store.currentUser.id,
      }
      
      const { error, data } = await supabase.from('defects').insert(newDefect).select().single()
      
      if (!error && data) {
        store.addDefect(data as Defect)
        logAudit(supabase, {
          projectId,
          userId: store.currentUser.id,
          action: 'CREATE',
          entityType: 'DEFECT',
          entityId: data.id,
          entityTitle: data.title
        })
        setDefectForm({ title: '', severity: 'HIGH', description: '', jira_url: '' })
        setShowDefectModal(null)
      }
    } catch(err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function saveEdit() {
    if (!editItem || isSubmitting) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('execution_items').update({
        assigned_to: editItem.assigned_to || null,
        notes: editItem.notes || null
      }).eq('id', editItem.id)
      
      if (!error) {
        const oldItem = store.executionItems.find(ei => ei.id === editItem.id)
        
        store.updateExecutionItem(editItem.id, {
          assigned_to: editItem.assigned_to || undefined,
          notes: editItem.notes || undefined,
          assignee: editItem.assigned_to ? store.profiles.find(p => p.id === editItem.assigned_to) : undefined,
        })

        // Notify if assigned to a new user
        if (editItem.assigned_to && editItem.assigned_to !== oldItem?.assigned_to && editItem.assigned_to !== store.currentUser.id) {
          const tc = projectTCs.find(t => t.id === oldItem?.test_case_id) || oldItem?.test_case
          createNotification(supabase, store.addNotification, {
            userId: editItem.assigned_to,
            title: 'Test Case Assigned',
            message: `You have been assigned the test case "${tc?.title || 'Unknown'}" for execution.`,
            link: `/projects/${projectId}/execution`
          })
        }

        setEditItem(null)
      }
    } catch(err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function removeFromCycle(itemId: string) {
    const { error } = await supabase.from('execution_items').delete().eq('id', itemId)
    if (!error) store.removeExecutionItem(itemId)
  }

  const statusIcons = {
    PASS: <CheckCircle className="w-4 h-4 text-green-500" />,
    FAIL: <XCircle className="w-4 h-4 text-red-500" />,
    BLOCKED: <AlertTriangle className="w-4 h-4 text-orange-500" />,
    NOT_RUN: <MinusCircle className="w-4 h-4 text-slate-400" />,
  }

  if (!project) return <div className="p-8 text-muted-foreground">Project not found.</div>

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Link href="/projects" className="hover:text-foreground">Projects</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">{project.name}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Execution</span>
          </div>
          <h1 className="page-title">Test Execution</h1>
        </div>
        {can(store.currentUser?.global_role, 'createCycle') && (
          <button id="new-cycle-btn" className="btn-primary" onClick={() => {
            setEditCycleId(null)
            setCycleForm({ name: '', type: 'SPRINT', sprint_name: '', start_date: '', end_date: '' })
            setShowCycleModal(true)
          }}>
            <Plus className="w-4 h-4" /> New Cycle
          </button>
        )}
      </div>

      {/* Cycle Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {cycles.map(c => (
          <button key={c.id} onClick={() => setActiveCycle(c.id)} className={cn('px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors', activeCycle === c.id ? 'bg-primary text-primary-foreground' : 'bg-card border text-muted-foreground hover:bg-muted')}>
            {c.name}
            <span className="ml-2 text-xs opacity-70">{c.type}</span>
          </button>
        ))}
        {cycles.length === 0 && <p className="text-sm text-muted-foreground">No execution cycles. Create one to get started.</p>}
      </div>

      {cycle && (
        <>
          {/* Progress Bar */}
          <div className="card card-body py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold">{cycle.name}</h3>
                <p className="text-sm text-muted-foreground">{cycle.sprint_name && `Sprint: ${cycle.sprint_name} · `}{cycle.start_date && `${formatDate(cycle.start_date)} – ${cycle.end_date ? formatDate(cycle.end_date) : 'ongoing'}`}</p>
              </div>
              <div className="flex items-center gap-2">
                {can(store.currentUser?.global_role, 'editCycle') && (
                  <>
                    <button className="btn-ghost btn-icon p-1.5 text-muted-foreground hover:text-primary" onClick={() => openEditCycle(cycle)} title="Edit Cycle">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="btn-ghost btn-icon p-1.5 text-muted-foreground hover:text-destructive" onClick={() => setDeleteCyclePrompt(cycle.id)} title="Delete Cycle">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button className="btn-secondary btn-sm" onClick={() => setShowTCModal(true)}>
                      <Plus className="w-3.5 h-3.5" /> Add Test Cases
                    </button>
                  </>
                )}
              </div>
            </div>
            {total > 0 && (
              <div>
                <div className="flex rounded-full overflow-hidden h-3 mb-2">
                  <div className="bg-green-500 transition-all" style={{ width: `${(passCount/total)*100}%` }} />
                  <div className="bg-red-500 transition-all" style={{ width: `${(failCount/total)*100}%` }} />
                  <div className="bg-orange-500 transition-all" style={{ width: `${(blockedCount/total)*100}%` }} />
                  <div className="bg-slate-200 transition-all" style={{ width: `${(notRunCount/total)*100}%` }} />
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />Pass: {passCount}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />Fail: {failCount}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500 inline-block" />Blocked: {blockedCount}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-300 inline-block" />Not Run: {notRunCount}</span>
                  <span className="ml-auto font-medium text-foreground">{total > 0 ? Math.round((passCount/total)*100) : 0}% Pass Rate</span>
                </div>
              </div>
            )}
          </div>

          {/* Execution Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Test Case</th>
                    <th>Assigned To</th>
                    <th>Status</th>
                    <th>Actions</th>
                    <th>Defects</th>
                  </tr>
                </thead>
                <tbody>
                  {activeItems.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No test cases in this cycle.</td></tr>}
                  {activeItems.map((item, idx) => {
                    const tc = projectTCs.find(t => t.id === item.test_case_id) || item.test_case
                    return (
                      <tr key={item.id}>
                        <td className="text-muted-foreground text-xs">{idx + 1}</td>
                        <td>
                          <div
                            className="font-medium text-sm text-primary cursor-pointer hover:underline"
                            onClick={() => tc && setViewTC(tc)}
                          >
                            {tc?.title || 'Unknown'}
                          </div>
                          {item.notes && <div className="text-xs text-muted-foreground italic mt-0.5">📝 {item.notes}</div>}
                        </td>
                        {/* Assigned To */}
                        <td>
                          {can(store.currentUser?.global_role, 'editCycle') ? (
                            <select
                              className="form-input text-xs py-1 h-8 bg-transparent hover:bg-muted border-transparent hover:border-border cursor-pointer transition-colors w-36"
                              value={item.assigned_to || ''}
                              onChange={(e) => updateAssignee(item.id, e.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {projectMembers.map(m => (
                                <option key={m.id} value={m.id}>{m.full_name}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {store.profiles.find(p => p.id === item.assigned_to)?.full_name || <span className="italic">Unassigned</span>}
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={cn('badge', STATUS_COLORS[item.status])}>
                            <span className="flex items-center gap-1">{statusIcons[item.status]}{STATUS_LABELS[item.status as keyof typeof STATUS_LABELS]}</span>
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1 items-center">
                            {can(store.currentUser?.global_role, 'updateExecution') ? (
                              (['PASS','FAIL','BLOCKED','NOT_RUN'] as const).map(s => (
                                <button key={s} onClick={() => updateStatus(item.id, s)} className={cn('px-2 py-1 text-xs rounded-md font-medium transition-colors', item.status === s ? STATUS_COLORS[s] + ' opacity-100' : 'bg-muted text-muted-foreground hover:bg-muted/80')} title={s}>
                                  {s === 'NOT_RUN' ? 'NR' : s.slice(0,1).toUpperCase() + s.slice(1,2).toLowerCase()}
                                </button>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Read-only</span>
                            )}
                            {can(store.currentUser?.global_role, 'editCycle') && (
                              <>
                                {/* Edit assignee / notes */}
                                <button
                                  className="ml-1 btn-ghost btn-icon p-1 text-muted-foreground hover:text-primary"
                                  title="Edit assignee / notes"
                                  onClick={() => setEditItem({ id: item.id, assigned_to: item.assigned_to || '', notes: item.notes || '' })}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {/* Remove from cycle */}
                                <button
                                  className="btn-ghost btn-icon p-1 text-muted-foreground hover:text-destructive"
                                  title="Remove from cycle"
                                  onClick={() => removeFromCycle(item.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          {(() => {
                            const itemDefects = store.defects.filter(d => d.execution_item_id === item.id)
                            const openDefects = itemDefects.filter(d => d.status === 'OPEN' || d.status === 'IN_PROGRESS')
                            const resolvedDefects = itemDefects.filter(d => d.status === 'RESOLVED' || d.status === 'CLOSED')

                            if (itemDefects.length > 0) {
                              if (openDefects.length > 0) {
                                return (
                                  <button 
                                    className="badge bg-red-100 text-red-700 text-xs hover:bg-red-200 transition-colors border-none cursor-pointer"
                                    onClick={() => setViewDefectItems(itemDefects)}
                                  >
                                    {openDefects.length} open defect{openDefects.length > 1 ? 's' : ''}
                                  </button>
                                )
                              } else {
                                return (
                                  <button 
                                    className="badge bg-emerald-100 text-emerald-700 text-xs hover:bg-emerald-200 transition-colors border-none cursor-pointer flex items-center gap-1"
                                    onClick={() => setViewDefectItems(itemDefects)}
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> {resolvedDefects.length} resolved
                                  </button>
                                )
                              }
                            } else if (item.status === 'FAIL' && can(store.currentUser?.global_role, 'updateExecution')) {
                              return (
                                <button id={`log-defect-${item.id}`} className="btn-ghost btn-sm text-xs text-red-600 flex items-center gap-1" onClick={() => setShowDefectModal(item.id)}>
                                  <Bug className="w-3 h-3" /> Log Defect
                                </button>
                              )
                            }
                            return null
                          })()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Cycle Modal (Create/Edit) */}
      {showCycleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowCycleModal(false); setEditCycleId(null); setCycleForm({ name: '', type: 'SPRINT', sprint_name: '', start_date: '', end_date: '' }) }}>
          <div className="bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editCycleId ? 'Edit Execution Cycle' : 'Create Execution Cycle'}</h2>
            <form onSubmit={saveCycle} className="space-y-4">
              <div><label className="form-label">Cycle Name *</label><input className="form-input" placeholder="e.g. Sprint 7 - Auth Module" value={cycleForm.name} onChange={e => setCycleForm(f => ({...f, name: e.target.value}))} required /></div>
              <div><label className="form-label">Type</label><select className="form-input" value={cycleForm.type} onChange={e => setCycleForm(f => ({...f, type: e.target.value}))}>
                {['SPRINT','RELEASE','REGRESSION'].map(t => <option key={t} value={t}>{t}</option>)}
              </select></div>
              <div><label className="form-label">Sprint Name</label><input className="form-input" placeholder="e.g. Sprint 7" value={cycleForm.sprint_name} onChange={e => setCycleForm(f => ({...f, sprint_name: e.target.value}))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">Start Date</label><input type="date" className="form-input" value={cycleForm.start_date} onChange={e => setCycleForm(f => ({...f, start_date: e.target.value}))} /></div>
                <div><label className="form-label">End Date</label><input type="date" className="form-input" value={cycleForm.end_date} onChange={e => setCycleForm(f => ({...f, end_date: e.target.value}))} /></div>
              </div>
              <div className="flex gap-3"><button type="button" className="btn-secondary flex-1" onClick={() => { setShowCycleModal(false); setEditCycleId(null); setCycleForm({ name: '', type: 'SPRINT', sprint_name: '', start_date: '', end_date: '' }) }}>Cancel</button><button type="submit" className="btn-primary flex-1">{editCycleId ? 'Save Changes' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Add TCs Modal */}
      {showTCModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTCModal(false)}>
          <div className="bg-card rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Add Test Cases to Cycle</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Select test cases and optionally assign each one to a team member.</p>
            </div>

            {/* Select All row */}
            {projectTCs.filter(tc => tc.status === 'APPROVED' && !activeItems.some(ei => ei.test_case_id === tc.id)).length > 0 && (
              <div className="flex items-center gap-3 px-3 py-2 border-b mb-1">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={selectedTCs.length > 0 && selectedTCs.length === projectTCs.filter(tc => tc.status === 'APPROVED' && !activeItems.some(ei => ei.test_case_id === tc.id)).length}
                  onChange={e => {
                    const all = projectTCs.filter(tc => tc.status === 'APPROVED' && !activeItems.some(ei => ei.test_case_id === tc.id)).map(tc => tc.id)
                    setSelectedTCs(e.target.checked ? all : [])
                  }}
                />
                <span className="text-sm font-medium text-muted-foreground">Select All</span>
                <span className="ml-auto text-xs text-muted-foreground">{selectedTCs.length} selected</span>
              </div>
            )}

            <div className="overflow-y-auto flex-1 space-y-1">
              {projectTCs.filter(tc => tc.status === 'APPROVED' && !activeItems.some(ei => ei.test_case_id === tc.id)).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">All test cases are already added to this cycle.</p>
              )}
              {projectTCs.filter(tc => tc.status === 'APPROVED' && !activeItems.some(ei => ei.test_case_id === tc.id)).map(tc => (
                <div key={tc.id} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors', selectedTCs.includes(tc.id) ? 'bg-accent/30' : 'hover:bg-muted/50')}>
                  <input
                    type="checkbox"
                    className="accent-primary flex-shrink-0"
                    checked={selectedTCs.includes(tc.id)}
                    onChange={e => setSelectedTCs(prev => e.target.checked ? [...prev, tc.id] : prev.filter(id => id !== tc.id))}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{tc.title}</div>
                    <div className="text-xs text-muted-foreground">{tc.priority} · {tc.automation_status.replace('_','-')}</div>
                  </div>
                  {/* Assign To dropdown per TC */}
                  <select
                    className="form-input w-40 text-xs flex-shrink-0"
                    value={tcAssignees[tc.id] || ''}
                    onChange={e => setTcAssignees(prev => ({ ...prev, [tc.id]: e.target.value }))}
                    disabled={!selectedTCs.includes(tc.id)}
                  >
                    <option value="">Unassigned</option>
                    {projectMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4 pt-3 border-t">
              <button className="btn-secondary flex-1" onClick={() => { setShowTCModal(false); setSelectedTCs([]); setTcAssignees({}) }}>Cancel</button>
              <button className="btn-primary flex-1" onClick={addToCycle} disabled={selectedTCs.length === 0}>
                Add {selectedTCs.length > 0 ? `${selectedTCs.length} Test Case${selectedTCs.length > 1 ? 's' : ''}` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Defect Modal */}
      {showDefectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDefectModal(null)}>
          <div className="bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Log Defect</h2>
            <div className="space-y-4">
              <div><label className="form-label">Title *</label><input className="form-input" placeholder="Defect title" value={defectForm.title} onChange={e => setDefectForm(f => ({...f, title: e.target.value}))} /></div>
              <div><label className="form-label">Severity</label><select className="form-input" value={defectForm.severity} onChange={e => setDefectForm(f => ({...f, severity: e.target.value}))}>
                {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => <option key={s}>{s}</option>)}
              </select></div>
              <div><label className="form-label">Description</label><textarea className="form-textarea" rows={3} value={defectForm.description} onChange={e => setDefectForm(f => ({...f, description: e.target.value}))} /></div>
              <div><label className="form-label">Jira URL</label><input className="form-input" placeholder="https://..." value={defectForm.jira_url} onChange={e => setDefectForm(f => ({...f, jira_url: e.target.value}))} /></div>
              <div className="flex gap-3"><button className="btn-secondary flex-1" onClick={() => setShowDefectModal(null)}>Cancel</button><button className="btn-primary flex-1" onClick={() => defectForm.title && addDefect(showDefectModal)}>Log Defect</button></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Execution Item Modal (reassign / notes) ── */}
      {editItem && (() => {
        const item = store.executionItems.find(ei => ei.id === editItem.id)
        const tc = item ? (projectTCs.find(t => t.id === item.test_case_id) || item.test_case) : null
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={() => setEditItem(null)}>
            <div className="bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="mb-5">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <UserRound className="w-5 h-5 text-primary" /> Edit Execution Item
                </h2>
                {tc && <p className="text-sm text-muted-foreground mt-1 truncate">{tc.title}</p>}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="form-label">Assign To</label>
                  <select
                    className="form-input"
                    value={editItem.assigned_to}
                    onChange={e => setEditItem(prev => prev ? { ...prev, assigned_to: e.target.value } : prev)}
                  >
                    <option value="">— Unassigned —</option>
                    {projectMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name} ({m.global_role.replace('_', ' ')})</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">This replaces the previously assigned person.</p>
                </div>
                <div>
                  <label className="form-label">Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="e.g. Focus on mobile viewport, skip IE11 testing..."
                    value={editItem.notes}
                    onChange={e => setEditItem(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button className="btn-secondary flex-1" onClick={() => setEditItem(null)}>Cancel</button>
                  <button className="btn-primary flex-1" onClick={saveEdit}>Save Changes</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* View Test Case Details Modal */}
      {viewTC && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4" onClick={() => setViewTC(null)}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="card-header sticky top-0 bg-card z-10 flex items-center justify-between border-b px-6 py-4">
              <div className="flex-1">
                <h2 className="card-title text-base sm:text-lg">{viewTC.title}</h2>
                <div className="flex gap-2 mt-1">
                  <span className={cn('badge', STATUS_COLORS[viewTC.status as keyof typeof STATUS_COLORS] || 'bg-slate-100 text-slate-700')}>{STATUS_LABELS[viewTC.status as keyof typeof STATUS_LABELS] || viewTC.status}</span>
                  <span className={cn('badge', STATUS_COLORS[viewTC.priority as keyof typeof STATUS_COLORS] || 'bg-slate-100 text-slate-700')}>{viewTC.priority}</span>
                </div>
              </div>
              <button className="btn-ghost btn-icon h-8 w-8 text-xl flex-shrink-0" onClick={() => setViewTC(null)}>✕</button>
            </div>
            <div className="card-body space-y-5 p-6">
              {viewTC.description && <div><p className="form-label text-xs font-semibold mb-1">Description</p><p className="text-sm text-foreground">{viewTC.description}</p></div>}
              {viewTC.preconditions && <div><p className="form-label text-xs font-semibold mb-1">Preconditions</p><p className="text-sm text-foreground">{viewTC.preconditions}</p></div>}
              {viewTC.steps && viewTC.steps.length > 0 && (
                <div>
                  <p className="form-label mb-3 text-xs font-semibold">Test Steps</p>
                  <div className="space-y-3">
                    {viewTC.steps.map((step: any) => (
                      <div key={step.step_number} className="flex gap-3 text-sm p-3 border rounded-lg bg-background">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs flex-shrink-0">{step.step_number}</span>
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{step.action}</div>
                          {step.test_data && <div className="text-muted-foreground text-xs font-mono bg-muted/50 p-1.5 rounded inline-block mt-1.5 border">Data: {step.test_data}</div>}
                          <div className="text-muted-foreground text-sm mt-1.5">Expected: {step.expected_result}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {viewTC.expected_result && <div><p className="form-label text-xs font-semibold mb-1">Overall Expected Result</p><p className="text-sm text-foreground">{viewTC.expected_result}</p></div>}
              {viewTC.postconditions && <div><p className="form-label text-xs font-semibold mb-1">Postconditions</p><p className="text-sm text-foreground">{viewTC.postconditions}</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* View Defects Modal */}
      {viewDefectItems && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4" onClick={() => setViewDefectItems(null)}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="card-header border-b flex items-center justify-between px-6 py-4">
              <h2 className="card-title text-red-600 flex items-center gap-2">
                <Bug className="w-5 h-5" /> Logged Defects
              </h2>
              <button className="btn-ghost btn-icon h-8 w-8 text-xl" onClick={() => setViewDefectItems(null)}>✕</button>
            </div>
            <div className="card-body overflow-y-auto p-0">
              <div className="divide-y">
                {viewDefectItems.map((defect, i) => (
                  <div key={defect.id || i} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-foreground">{defect.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn('badge text-[10px] px-1.5 py-0', 
                            defect.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-200' :
                            defect.severity === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                            defect.severity === 'MEDIUM' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          )}>
                            {defect.severity}
                          </span>
                          <span className="text-[10px] text-muted-foreground">Logged {new Date(defect.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {defect.jira_url && (
                        <a 
                          href={defect.jira_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn-ghost btn-sm h-8 px-2 text-xs text-primary flex items-center gap-1 border border-primary/20"
                        >
                          <ExternalLink className="w-3 h-3" /> Jira
                        </a>
                      )}
                    </div>
                    {defect.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded border border-muted">
                        {defect.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t bg-muted/20">
              <button className="btn-secondary w-full" onClick={() => setViewDefectItems(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Cycle Prompt */}
      {deleteCyclePrompt && (() => {
        const cycleToDelete = cycles.find(c => c.id === deleteCyclePrompt)
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={() => setDeleteCyclePrompt(null)}>
            <div className="bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5" /> Delete Execution Cycle
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to delete the cycle <span className="font-semibold text-foreground">"{cycleToDelete?.name}"</span>? 
                This will also permanently delete all associated execution items and results. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button className="btn-secondary flex-1" onClick={() => setDeleteCyclePrompt(null)}>Cancel</button>
                <button className="btn-primary flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteCycle(deleteCyclePrompt)}>Delete Cycle</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
