'use client'

import { useState, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { Plus, Download, Upload, Search, ChevronRight, Trash2, Edit2, Eye, FileSpreadsheet } from 'lucide-react'
import { STATUS_LABELS, STATUS_COLORS, cn } from '@/lib/utils'
import { exportTestCasesToExcel, getImportTemplate, parseTestCasesExcel } from '@/lib/excel'
import type { TestCase, TestStep } from '@/types'
import TestCaseModal from '@/components/test-cases/TestCaseModal'
import { createClient } from '@/lib/supabase/client'
import { can } from '@/lib/permissions'

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
  const [editTC, setEditTC] = useState<TestCase | null>(null)
  const [viewTC, setViewTC] = useState<TestCase | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        status: 'DRAFT',
        created_by: currentUser.id,
      }))
      
      const { data, error } = await supabase.from('test_cases').insert(newTCsPayload).select()
      
      if (!error && data) {
        store.addTestCases(data as TestCase[])
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
    const { error } = await supabase.from('test_cases').delete().eq('id', id)
    if (!error) store.deleteTestCase(id)
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
          <button className="btn-secondary" onClick={() => exportTestCasesToExcel(filtered)}>
            <Download className="w-4 h-4" /> Export
          </button>
          {can(currentUser?.global_role, 'createTestCase') && (
            <button id="add-tc-btn" className="btn-primary" onClick={() => { setEditTC(null); setShowModal(true) }}>
              <Plus className="w-4 h-4" /> Add Test Case
            </button>
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
            <option value="">All Automation</option>
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
                <th className="w-8">#</th>
                <th>Title</th>
                <th>Story</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Automation</th>
                <th>Steps</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No test cases found.</td></tr>
              )}
              {filtered.map((tc, idx) => {
                const story = store.userStories.find(s => s.id === tc.story_id)
                const canEditRow = currentUser?.global_role === 'ADMIN' || currentUser?.global_role === 'QA_LEAD' || tc.created_by === currentUser?.id
                const canDeleteRow = can(currentUser?.global_role, 'deleteTestCase')

                return (
                  <tr key={tc.id}>
                    <td className="text-muted-foreground text-xs">{idx + 1}</td>
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

      {/* View Modal */}
      {viewTC && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4" onClick={() => setViewTC(null)}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="card-header sticky top-0 bg-card z-10">
              <div>
                <h2 className="card-title">{viewTC.title}</h2>
                <div className="flex gap-2 mt-1">
                  <span className={cn('badge', STATUS_COLORS[viewTC.status])}>{STATUS_LABELS[viewTC.status as keyof typeof STATUS_LABELS]}</span>
                  <span className={cn('badge', STATUS_COLORS[viewTC.priority])}>{viewTC.priority}</span>
                  <span className={cn('badge', STATUS_COLORS[viewTC.automation_status])}>{STATUS_LABELS[viewTC.automation_status as keyof typeof STATUS_LABELS]}</span>
                </div>
              </div>
              <button className="btn-ghost btn-icon" onClick={() => setViewTC(null)}>✕</button>
            </div>
            <div className="card-body space-y-4">
              {viewTC.description && <div><p className="form-label">Description</p><p className="text-sm text-muted-foreground">{viewTC.description}</p></div>}
              {viewTC.preconditions && <div><p className="form-label">Preconditions</p><p className="text-sm text-muted-foreground">{viewTC.preconditions}</p></div>}
              <div>
                <p className="form-label mb-3">Test Steps</p>
                <div className="space-y-2">
                  {viewTC.steps.map(step => (
                    <div key={step.step_number} className="flex gap-3 text-sm">
                      <span className="w-8 h-7 rounded bg-primary/10 text-primary font-bold flex items-center justify-center text-xs flex-shrink-0">{step.step_number}</span>
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{step.action}</div>
                        {step.test_data && <div className="text-muted-foreground text-xs font-mono bg-muted/50 p-1 rounded inline-block mt-1">Data: {step.test_data}</div>}
                        <div className="text-muted-foreground text-xs mt-1">Expected: {step.expected_result}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {viewTC.expected_result && <div><p className="form-label">Overall Expected Result</p><p className="text-sm text-muted-foreground">{viewTC.expected_result}</p></div>}
              {viewTC.postconditions && <div><p className="form-label">Postconditions</p><p className="text-sm text-muted-foreground">{viewTC.postconditions}</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
