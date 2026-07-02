'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import ExportDropdown from '@/components/layout/ExportDropdown'
import { ChevronRight, CheckCircle2, AlertTriangle, XCircle, MinusCircle, ChevronDown, Eye, FileBox, FileJson, Bookmark, TestTube2, Download } from 'lucide-react'
import { exportToExcel, exportToCSV, exportTableToPDF } from '@/lib/export'
import { cn, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import ViewTestCaseModal from '@/components/test-cases/ViewTestCaseModal'
import type { TestCase } from '@/types'

export default function RTMPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const store = useAppStore()
  const project = store.projects.find(p => p.id === projectId)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [viewTC, setViewTC] = useState<TestCase | null>(null)

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Gather Data
  const epics = store.epics.filter(e => e.project_id === projectId)
  const features = store.features.filter(f => epics.some(e => e.id === f.epic_id))
  const stories = store.userStories.filter(s => features.some(f => f.id === s.feature_id))
  const testCases = store.testCases.filter(tc => stories.some(s => s.id === tc.story_id))
  const executionItems = store.executionItems.filter(ei => testCases.some(tc => tc.id === ei.test_case_id))

  // Helpers
  const getTCExecutionStatus = (tcId: string) => {
    const items = executionItems.filter(ei => ei.test_case_id === tcId).sort((a,b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime())
    return items.length > 0 ? items[items.length - 1].status : 'NOT_RUN'
  }

  const getRollupStatus = (tcIds: string[]) => {
    if (tcIds.length === 0) return 'UNTESTED'
    const statuses = tcIds.map(id => getTCExecutionStatus(id))
    if (statuses.some(s => s === 'FAIL')) return 'FAIL'
    if (statuses.some(s => s === 'BLOCKED')) return 'BLOCKED'
    if (statuses.every(s => s === 'PASS')) return 'PASS'
    return 'NOT_RUN'
  }

  const renderStatus = (status: string) => {
    const config: Record<string, { icon: any, color: string, label: string }> = {
      PASS: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-600', label: 'Pass' },
      FAIL: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-600', label: 'Fail' },
      BLOCKED: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-orange-600', label: 'Blocked' },
      NOT_RUN: { icon: <MinusCircle className="w-4 h-4" />, color: 'text-slate-400', label: 'Not Run' },
      UNTESTED: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-yellow-600', label: 'Untested' },
    }
    const c = config[status] || config.NOT_RUN
    return (
      <span className={cn('flex items-center gap-1.5 text-sm font-medium', c.color)}>
        {c.icon}{c.label}
      </span>
    )
  }

  const getCoveredStoriesCount = (storyList: typeof stories) => {
    return storyList.filter(s => {
      const tcs = testCases.filter(tc => tc.story_id === s.id)
      return tcs.some(tc => tc.status === 'APPROVED')
    }).length
  }

  const totalStories = stories.length
  const coveredStories = getCoveredStoriesCount(stories)
  const coveragePct = totalStories > 0 ? Math.round((coveredStories / totalStories) * 100) : 0

  const getExportData = () => {
    const exportData: any[] = []
    epics.forEach(epic => {
      const epicFeatures = features.filter(f => f.epic_id === epic.id)
      if (epicFeatures.length === 0) {
        exportData.push({ 'Epic ID': `EPIC-${epic.sequence_id || epic.id.slice(0,4)}`, 'Epic Title': epic.title })
        return
      }
      
      epicFeatures.forEach(feat => {
        const featStories = stories.filter(s => s.feature_id === feat.id)
        if (featStories.length === 0) {
          exportData.push({ 'Epic ID': `EPIC-${epic.sequence_id || epic.id.slice(0,4)}`, 'Epic Title': epic.title, 'Feature ID': `FEAT-${feat.sequence_id || feat.id.slice(0,4)}`, 'Feature Title': feat.title })
          return
        }

        featStories.forEach(story => {
          const storyTCs = testCases.filter(tc => tc.story_id === story.id)
          if (storyTCs.length === 0) {
            exportData.push({ 'Epic ID': `EPIC-${epic.sequence_id || epic.id.slice(0,4)}`, 'Epic Title': epic.title, 'Feature ID': `FEAT-${feat.sequence_id || feat.id.slice(0,4)}`, 'Feature Title': feat.title, 'Story ID': `US-${story.sequence_id || story.id.slice(0,4)}`, 'Story Title': story.title })
            return
          }

          storyTCs.forEach(tc => {
            exportData.push({ 
              'Epic ID': `EPIC-${epic.sequence_id || epic.id.slice(0,4)}`, 'Epic Title': epic.title, 
              'Feature ID': `FEAT-${feat.sequence_id || feat.id.slice(0,4)}`, 'Feature Title': feat.title, 
              'Story ID': `US-${story.sequence_id || story.id.slice(0,4)}`, 'Story Title': story.title,
              'TC ID': `TC-${tc.sequence_id || tc.id.slice(0,4)}`, 'TC Title': tc.title,
              'Coverage Status': tc.status === 'APPROVED' ? 'Covered' : 'Draft/In Review',
              'Execution Status': getTCExecutionStatus(tc.id)
            })
          })
        })
      })
    })
    return exportData
  }

  const handleExportRTMExcel = () => {
    exportToExcel(`${project?.name || 'Project'}_RTM`, 'Traceability Matrix', getExportData())
  }
  
  const handleExportRTMCSV = () => {
    exportToCSV(`${project?.name || 'Project'}_RTM`, getExportData())
  }

  if (!project) return <div className="p-8 text-muted-foreground">Project not found.</div>

  // Generate Tree Data
  // Epics -> Features -> Stories -> TCs
  // We will render this linearly by traversing
  const rows: any[] = []

  epics.forEach(epic => {
    const epicFeatures = features.filter(f => f.epic_id === epic.id)
    const epicStories = stories.filter(s => epicFeatures.some(f => f.id === s.feature_id))
    const epicTCs = testCases.filter(tc => epicStories.some(s => s.id === tc.story_id))
    const coveredCount = getCoveredStoriesCount(epicStories)
    const pct = epicStories.length > 0 ? Math.round((coveredCount / epicStories.length) * 100) : 0
    const status = getRollupStatus(epicTCs.map(tc => tc.id))

    rows.push({ type: 'epic', id: epic.id, item: epic, level: 0, hasChildren: epicFeatures.length > 0, coveragePct: pct, coveredCount, totalCount: epicStories.length, status })

    if (expanded.has(epic.id)) {
      epicFeatures.forEach(feature => {
        const featStories = stories.filter(s => s.feature_id === feature.id)
        const featTCs = testCases.filter(tc => featStories.some(s => s.id === tc.story_id))
        const fCoveredCount = getCoveredStoriesCount(featStories)
        const fPct = featStories.length > 0 ? Math.round((fCoveredCount / featStories.length) * 100) : 0
        const fStatus = getRollupStatus(featTCs.map(tc => tc.id))

        rows.push({ type: 'feature', id: feature.id, item: feature, level: 1, hasChildren: featStories.length > 0, coveragePct: fPct, coveredCount: fCoveredCount, totalCount: featStories.length, status: fStatus })

        if (expanded.has(feature.id)) {
          featStories.forEach(story => {
            const storyTCs = testCases.filter(tc => tc.story_id === story.id)
            const isCovered = storyTCs.some(tc => tc.status === 'APPROVED')
            const sStatus = getRollupStatus(storyTCs.map(tc => tc.id))

            rows.push({ type: 'story', id: story.id, item: story, level: 2, hasChildren: storyTCs.length > 0, isCovered, status: sStatus })

            if (expanded.has(story.id)) {
              storyTCs.forEach(tc => {
                rows.push({ type: 'tc', id: tc.id, item: tc, level: 3, hasChildren: false, tcStatus: tc.status, status: getTCExecutionStatus(tc.id) })
              })
            }
          })
        }
      })
    }
  })

  return (
    <div className="space-y-5 pb-10">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Link href="/projects" className="hover:text-foreground">Projects</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">{project.name}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>RTM</span>
          </div>
          <h1 className="page-title">Requirement Traceability Matrix</h1>
        </div>
        <div className="flex items-center gap-2 no-print">
          <ExportDropdown 
            onExportCSV={handleExportRTMCSV}
            onExportExcel={handleExportRTMExcel}
            onExportPDF={() => exportTableToPDF(`${project?.name || 'Project'}_RTM`, 'Traceability Matrix', getExportData())}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card text-center">
          <div className="text-3xl font-bold mb-1 text-blue-700">{totalStories}</div>
          <div className="text-sm text-muted-foreground">Total Stories</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-3xl font-bold mb-1 text-purple-700">{coveragePct}%</div>
          <div className="text-sm text-muted-foreground">Story Coverage</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-3xl font-bold mb-1 text-indigo-700">{testCases.length}</div>
          <div className="text-sm text-muted-foreground">Total Test Cases</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-3xl font-bold mb-1 text-red-700">{totalStories - coveredStories}</div>
          <div className="text-sm text-muted-foreground">Uncovered Stories</div>
        </div>
      </div>

      {/* Tree Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground w-1/2">Entity / Title</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Coverage</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Execution</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No data found for this project.</td></tr>
              )}
              {rows.map(row => (
                <tr key={`${row.type}-${row.id}`} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${row.level * 24}px` }}>
                      {row.hasChildren ? (
                        <button onClick={() => toggleExpand(row.id)} className="p-0.5 hover:bg-muted rounded text-muted-foreground transition-transform">
                          <ChevronDown className={cn("w-4 h-4 transition-transform", !expanded.has(row.id) && "-rotate-90")} />
                        </button>
                      ) : (
                        <div className="w-5" />
                      )}
                      
                      {row.type === 'epic' && <FileBox className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                      {row.type === 'feature' && <FileJson className="w-4 h-4 text-purple-500 flex-shrink-0" />}
                      {row.type === 'story' && <Bookmark className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                      {row.type === 'tc' && <TestTube2 className="w-4 h-4 text-amber-500 flex-shrink-0" />}

                      <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider w-16 flex-shrink-0">
                        {row.type === 'epic' ? `EPIC-${row.item.sequence_id || row.item.id.slice(0,4)}` : row.type === 'feature' ? `FEAT-${row.item.sequence_id || row.item.id.slice(0,4)}` : row.type === 'story' ? `US-${row.item.sequence_id || row.item.id.slice(0,4)}` : `TC-${row.item.sequence_id || row.item.id.slice(0,4)}`}
                      </span>
                      <span className={cn("font-medium truncate max-w-[300px]", row.type === 'tc' ? "text-muted-foreground" : "text-foreground")}>
                        {row.item.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-muted-foreground text-xs truncate max-w-[200px]" title={row.item.description || (row.type === 'story' ? row.item.acceptance_criteria : '')}>
                      {row.item.description || (row.type === 'story' ? row.item.acceptance_criteria : '—')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {row.type === 'epic' || row.type === 'feature' ? (
                      <div className="flex items-center gap-2 w-32">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className={cn('h-2 rounded-full transition-all', row.coveragePct === 100 ? 'bg-green-500' : row.coveragePct > 0 ? 'bg-primary' : 'bg-muted')} style={{ width: `${row.coveragePct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-10">{row.coveragePct}%</span>
                      </div>
                    ) : row.type === 'story' ? (
                      <span className={cn('badge text-[10px] px-1.5 py-0.5', row.isCovered ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200')}>
                        {row.isCovered ? 'Covered' : 'Not Covered'}
                      </span>
                    ) : (
                      <span className={cn('badge text-[10px] px-1.5 py-0.5', STATUS_COLORS[row.tcStatus as keyof typeof STATUS_COLORS] || 'bg-slate-100 text-slate-700')}>
                        {STATUS_LABELS[row.tcStatus as keyof typeof STATUS_LABELS] || row.tcStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {renderStatus(row.status)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.type === 'tc' ? (
                      <button className="btn-ghost btn-icon p-1.5 text-muted-foreground hover:text-primary mx-auto" onClick={() => setViewTC(row.item)} title="View Test Case">
                        <Eye className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewTC && <ViewTestCaseModal viewTC={viewTC} onClose={() => setViewTC(null)} />}
    </div>
  )
}
