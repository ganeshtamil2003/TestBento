'use client'

import { useState, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { Plus, Download, Upload, Search, ChevronRight, Trash2, Edit2, Eye, FileSpreadsheet, Sparkles, ArrowRight } from 'lucide-react'
import { STATUS_LABELS, STATUS_COLORS, cn } from '@/lib/utils'
import ExportDropdown from '@/components/layout/ExportDropdown'
import { getTestCasesExportData, getImportTemplate, parseTestCasesExcel } from '@/lib/excel'
import { exportToExcel, exportToCSV, exportTableToPDF } from '@/lib/export'
import type { TestCase, TestStep, ReviewCycle } from '@/types'
import TestCaseModal from '@/components/test-cases/TestCaseModal'
import GenerateTestCasesModal from '@/components/test-cases/GenerateTestCasesModal'
import ViewTestCaseModal from '@/components/test-cases/ViewTestCaseModal'
import { createClient } from '@/lib/supabase/client'
import { can } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

export default function TestCasesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const searchParams = useSearchParams()
  const storyFilter = searchParams.get('story')
  const store = useAppStore()

  const project = store.projects.find(p => p.id === projectId)
  const epicIds = new Set(store.epics.filter(e => e.project_id === projectId).map(e => e.id))
  const featureIds = new Set(store.features.filter(f => epicIds.has(f.epic_id)).map(f => f.id))
  const storyIds = new Set(store.userStories.filter(s => featureIds.has(s.feature_id)).map(s => s.id))
  const allTCs = store.testCases.filter(tc => storyIds.has(tc.story_id))
  const currentUser = store.currentUser
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [autoFilter, setAutoFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [selectedStory, setSelectedStory] = useState(storyFilter || '')
  const [showModal, setShowModal] = useState(false)
  const [showGenModal, setShowGenModal] = useState(false)
  const [editTC, setEditTC] = useState<TestCase | null>(null)
  const [viewTC, setViewTC] = useState<TestCase | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedTCIds, setSelectedTCIds] = useState<string[]>([])
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [targetProjectId, setTargetProjectId] = useState('')
  const [targetStoryId, setTargetStoryId] = useState('')

  const stories = store.userStories.filter(s => storyIds.has(s.id))

  const filtered = allTCs.filter(tc => {
    const matchSearch = tc.title.toLowerCase().includes(search.toLowerCase()) || tc.description?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || tc.status === statusFilter
    const matchAuto = !autoFilter || tc.automation_status === autoFilter
    const matchPrio = !priorityFilter || tc.priority === priorityFilter
    const matchStory = !selectedStory || tc.story_id === selectedStory
    return matchSearch && matchStatus && matchAuto && matchPrio && matchStory
  })

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !storyIds.size) return
    setImporting(true)
    try {
      const parsed = await parseTestCasesExcel(file)
      const importStoryId = selectedStory || [...storyIds][0]
      const leads = store.profiles.filter(p => ['QA_LEAD', 'MANAGER'].includes(p.global_role))
      const firstLead = leads[0]
      const shouldReview = !!firstLead

      const newTCsPayload = parsed.map(p => ({
        story_id: importStoryId,
        title: p.title,
        description: p.description,
        preconditions: p.preconditions,
        postconditions: p.postconditions,
        steps: p.steps,
        expected_result: p.expected_result,
        priority: p.priority,
        automation_status: p.automation_status,
        status: shouldReview ? 'IN_REVIEW' : 'DRAFT',
        created_by: currentUser.id,
      }))
      
      const { data, error } = await supabase.from('test_cases').insert(newTCsPayload).select()
      
      if (!error && data) {
        store.addTestCases(data as TestCase[])

        if (shouldReview) {
          const rcPayload = data.map((d: any) => ({
            test_case_id: d.id,
            reviewer_id: firstLead.id,
            assigned_by: currentUser.id,
            status: 'PENDING'
          }))
          const { data: rcData, error: rcError } = await supabase.from('review_cycles').insert(rcPayload).select()
          if (!rcError && rcData) {
            rcData.forEach((rc: any) => store.addReviewCycle(rc as ReviewCycle))
          }
        }

        data.forEach((tc: any) => {
          logAudit(supabase, {
            projectId,
            userId: currentUser.id,
            action: 'CREATE',
            entityType: 'TEST_CASE',
            entityId: tc.id,
            entityTitle: tc.title,
            details: { source: 'Excel Import' }
          })
        })
        alert(`Successfully imported ${data.length} test case(s).`)
      } else {
        alert('Failed to insert test cases into database.')
      }
    } catch {
      alert('Failed to parse Excel file. Please use the correct template.')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    const tcToDelete = store.testCases.find(tc => tc.id === id)
    const { error } = await supabase.from('test_cases').delete().eq('id', id)
    if (!error) {
      store.deleteTestCase(id)
      if (tcToDelete) {
        logAudit(supabase, {
          projectId,
          userId: currentUser.id,
          action: 'DELETE',
          entityType: 'TEST_CASE',
          entityId: tcToDelete.id,
          entityTitle: tcToDelete.title,
        })
      }
    }
  }

  const allSelected = filtered.length > 0 && selectedTCIds.length === filtered.length
  function toggleAll() {
    setSelectedTCIds(allSelected ? [] : filtered.map(tc => tc.id))
  }
  function toggleTC(id: string) {
    setSelectedTCIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleBulkUpdate(field: 'priority' | 'automation_status', value: string) {
    if (selectedTCIds.length === 0 || isBulkUpdating) return
    setIsBulkUpdating(true)
    try {
      const { error } = await supabase.from('test_cases').update({ [field]: value }).in('id', selectedTCIds)
      if (!error) {
        selectedTCIds.forEach(id => store.updateTestCase(id, { [field]: value }))
        logAudit(supabase, {
          projectId,
          userId: currentUser.id,
          action: 'UPDATE',
          entityType: 'TEST_CASE',
          entityId: selectedTCIds[0],
          entityTitle: `Bulk updated ${selectedTCIds.length} test cases`,
          details: { field, to: value }
        })
      }
    } finally {
      setIsBulkUpdating(false)
      setSelectedTCIds([])
    }
  }

  async function handleBulkDelete() {
    if (selectedTCIds.length === 0 || isBulkUpdating || !window.confirm(`Are you sure you want to delete ${selectedTCIds.length} test cases?`)) return
    setIsBulkUpdating(true)
    try {
      const { error } = await supabase.from('test_cases').delete().in('id', selectedTCIds)
      if (!error) {
        selectedTCIds.forEach(id => store.deleteTestCase(id))
        logAudit(supabase, {
          projectId,
          userId: currentUser.id,
          action: 'DELETE',
          entityType: 'TEST_CASE',
          entityId: selectedTCIds[0],
          entityTitle: `Bulk deleted ${selectedTCIds.length} test cases`,
        })
      }
    } finally {
      setIsBulkUpdating(false)
      setSelectedTCIds([])
    }
  }

  async function handleBulkMove() {
    if (selectedTCIds.length === 0 || isBulkUpdating || !targetStoryId) return
    setIsBulkUpdating(true)
    try {
      const { error } = await supabase.from('test_cases').update({ story_id: targetStoryId }).in('id', selectedTCIds)
      if (!error) {
        selectedTCIds.forEach(id => store.updateTestCase(id, { story_id: targetStoryId }))
        logAudit(supabase, {
          projectId,
          userId: currentUser.id,
          action: 'UPDATE',
          entityType: 'TEST_CASE',
          entityId: selectedTCIds[0],
          entityTitle: `Bulk moved ${selectedTCIds.length} test cases to story ${targetStoryId}`,
        })
        setShowMoveModal(false)
        setTargetProjectId('')
        setTargetStoryId('')
      } else {
        alert('Failed to move test cases.')
      }
    } finally {
      setIsBulkUpdating(false)
      setSelectedTCIds([])
    }
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
            <span>Test Cases</span>
          </div>
          <h1 className="page-title">Test Cases <span className="text-muted-foreground text-lg font-normal">({filtered.length})</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={getImportTemplate}>
            <FileSpreadsheet className="w-4 h-4" /> Template
          </button>
          {can(currentUser?.global_role, 'createTestCase') && (
            <>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" id="import-excel-input" onChange={handleImport} />
              <label htmlFor="import-excel-input" className="btn-secondary cursor-pointer">
                <Upload className="w-4 h-4" /> {importing ? 'Importing...' : 'Import'}
              </label>
            </>
          )}
          <ExportDropdown 
            onExportCSV={() => exportToCSV('test_cases', getTestCasesExportData(filtered))}
            onExportExcel={() => exportToExcel('test_cases', 'Test Cases', getTestCasesExportData(filtered))}
            onExportPDF={() => exportTableToPDF('test_cases', 'Test Cases', getTestCasesExportData(filtered))}
          />
          {can(currentUser?.global_role, 'createTestCase') && (
            <>
              <button id="gen-tc-btn" className="btn-secondary" onClick={() => setShowGenModal(true)}>
                <Sparkles className="w-4 h-4 text-primary" /> Generate
              </button>
              <button id="add-tc-btn" className="btn-primary" onClick={() => { setEditTC(null); setShowModal(true) }}>
                <Plus className="w-4 h-4" /> Add Test Case
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card card-body py-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input className="form-input pl-9" placeholder="Search test cases..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select id="story-filter" className="form-input w-40" value={selectedStory} onChange={e => setSelectedStory(e.target.value)}>
            <option value="">All Stories</option>
            {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <select className="form-input w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {['DRAFT','IN_REVIEW','APPROVED','REJECTED'].map(s => <option key={s} value={s}>{STATUS_LABELS[s as keyof typeof STATUS_LABELS]}</option>)}
          </select>
          <select className="form-input w-36" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="">All Priorities</option>
            {['HIGH','MEDIUM','LOW'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="form-input w-40" value={autoFilter} onChange={e => setAutoFilter(e.target.value)}>
            <option value="">All Execution Types</option>
            {['AUTOMATED','MANUAL','SEMI_AUTOMATED'].map(a => <option key={a} value={a}>{STATUS_LABELS[a as keyof typeof STATUS_LABELS]}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10 text-center">
                  <input type="checkbox" className="accent-primary" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="w-16">ID</th>
                <th>Title</th>
                <th>Story</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Execution Type</th>
                <th>Steps</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No test cases found.</td></tr>
              )}
              {filtered.map((tc, idx) => {
                const story = store.userStories.find(s => s.id === tc.story_id)
                const canEditRow = currentUser?.global_role === 'ADMIN' || currentUser?.global_role === 'QA_LEAD' || tc.created_by === currentUser?.id
                const canDeleteRow = can(currentUser?.global_role, 'deleteTestCase')

                return (
                  <tr key={tc.id} className={selectedTCIds.includes(tc.id) ? 'bg-accent/30' : ''}>
                    <td className="text-center">
                      <input type="checkbox" className="accent-primary" checked={selectedTCIds.includes(tc.id)} onChange={() => toggleTC(tc.id)} />
                    </td>
                    <td className="text-muted-foreground text-[10px] font-semibold tracking-wide">TC-{tc.sequence_id || tc.id.slice(0,4)}</td>
                    <td>
                      <div className="font-medium text-foreground max-w-xs truncate">{tc.title}</div>
                      {tc.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{tc.description}</div>}
                    </td>
                    <td className="text-xs text-muted-foreground max-w-[140px] truncate">{story?.title || '—'}</td>
                    <td><span className={cn('badge', STATUS_COLORS[tc.priority])}>{tc.priority}</span></td>
                    <td><span className={cn('badge', STATUS_COLORS[tc.status])}>{STATUS_LABELS[tc.status as keyof typeof STATUS_LABELS]}</span></td>
                    <td><span className={cn('badge', STATUS_COLORS[tc.automation_status])}>{STATUS_LABELS[tc.automation_status as keyof typeof STATUS_LABELS]}</span></td>
                    <td className="text-muted-foreground text-center">{tc.steps.length}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button className="btn-ghost btn-icon p-1.5" onClick={() => setViewTC(tc)} title="View">
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        {canEditRow && (
                          <button className="btn-ghost btn-icon p-1.5" onClick={() => { setEditTC(tc); setShowModal(true) }} title="Edit">
                            <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        )}
                        {canDeleteRow && (
                          <button className="btn-ghost btn-icon p-1.5" onClick={() => handleDelete(tc.id)} title="Delete">
                            <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedTCIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in flex items-center gap-4 bg-card border border-border shadow-2xl rounded-full px-6 py-3">
          <span className="text-sm font-medium">{selectedTCIds.length} selected</span>
          <div className="h-4 w-px bg-border"></div>
          
          <select 
            className="text-xs bg-muted border-none rounded py-1.5 px-2 outline-none cursor-pointer"
            onChange={e => { if (e.target.value) handleBulkUpdate('priority', e.target.value) }}
            value=""
          >
            <option value="" disabled>Set Priority...</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select 
            className="text-xs bg-muted border-none rounded py-1.5 px-2 outline-none cursor-pointer"
            onChange={e => { if (e.target.value) handleBulkUpdate('automation_status', e.target.value) }}
            value=""
          >
            <option value="" disabled>Set Execution Type...</option>
            <option value="MANUAL">Manual</option>
            <option value="AUTOMATED">Automated</option>
            <option value="SEMI_AUTOMATED">Semi-Automated</option>
          </select>

          {can(currentUser?.global_role, 'deleteTestCase') && (
            <>
              <button className="btn-ghost btn-sm text-primary hover:bg-primary/10 hover:text-primary gap-1 flex items-center px-2 py-1 rounded" onClick={() => setShowMoveModal(true)}>
                <ArrowRight className="w-3.5 h-3.5" /> Move
              </button>
              <button className="btn-ghost btn-sm text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 flex items-center px-2 py-1 rounded" onClick={handleBulkDelete}>
                <Trash2 className="w-3.5 h-3.5" /> Delete All
              </button>
            </>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <TestCaseModal
          projectId={projectId}
          editTC={editTC}
          stories={stories}
          initialStoryId={selectedStory}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* AI Generate Modal */}
      {showGenModal && (
        <GenerateTestCasesModal
          stories={stories}
          initialStoryId={selectedStory}
          onClose={() => setShowGenModal(false)}
        />
      )}

      {/* View Modal */}
      {viewTC && (
        <ViewTestCaseModal viewTC={viewTC} onClose={() => setViewTC(null)} />
      )}

      {/* Move Test Cases Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={() => !isBulkUpdating && setShowMoveModal(false)}>
          <div className="bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Move Test Cases</h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">Target Project</label>
                <select className="form-input" value={targetProjectId} onChange={e => { setTargetProjectId(e.target.value); setTargetStoryId('') }}>
                  <option value="">Select Project</option>
                  {store.projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              
              {targetProjectId && (
                <div>
                  <label className="form-label">Target Story</label>
                  <select className="form-input" value={targetStoryId} onChange={e => setTargetStoryId(e.target.value)}>
                    <option value="">Select Story</option>
                    {store.userStories.filter(s => {
                      const feature = store.features.find(f => f.id === s.feature_id)
                      const epic = store.epics.find(e => e.id === feature?.epic_id)
                      return epic?.project_id === targetProjectId
                    }).map(s => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowMoveModal(false)} disabled={isBulkUpdating}>Cancel</button>
              <button 
                className="btn-primary flex-1" 
                onClick={handleBulkMove} 
                disabled={isBulkUpdating || !targetStoryId}
              >
                {isBulkUpdating ? 'Moving...' : 'Confirm Move'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
