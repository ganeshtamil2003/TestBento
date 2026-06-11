'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { ChevronRight, CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function RTMPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const store = useAppStore()
  const project = store.projects.find(p => p.id === projectId)

  const epicIds = new Set(store.epics.filter(e => e.project_id === projectId).map(e => e.id))
  const featureIds = new Set(store.features.filter(f => epicIds.has(f.epic_id)).map(f => f.id))
  const stories = store.userStories.filter(s => featureIds.has(s.feature_id))
  const storyIds = new Set(stories.map(s => s.id))
  const testCases = store.testCases.filter(tc => storyIds.has(tc.story_id))
  const executionItems = store.executionItems.filter(ei => testCases.some(tc => tc.id === ei.test_case_id))

  function getStoryStatus(storyId: string) {
    const tcs = testCases.filter(tc => tc.story_id === storyId)
    if (tcs.length === 0) return 'untested'
    const execResults = tcs.map(tc => {
      const items = executionItems.filter(ei => ei.test_case_id === tc.id)
      if (items.length === 0) return 'not_run'
      const latestStatus = items[items.length - 1].status
      return latestStatus
    })
    if (execResults.every(r => r === 'PASS')) return 'pass'
    if (execResults.some(r => r === 'FAIL')) return 'fail'
    if (execResults.some(r => r === 'BLOCKED')) return 'blocked'
    return 'not_run'
  }

  const covered = stories.filter(s => testCases.some(tc => tc.story_id === s.id)).length
  const totalCoverageSum = stories.reduce((sum, story) => {
    const storyTCs = testCases.filter(tc => tc.story_id === story.id)
    const approved = storyTCs.filter(tc => tc.status === 'APPROVED').length
    return sum + (storyTCs.length > 0 ? (approved / storyTCs.length) * 100 : 0)
  }, 0)
  const coveragePct = stories.length > 0 ? Math.round(totalCoverageSum / stories.length) : 0

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
            <span>RTM</span>
          </div>
          <h1 className="page-title">Requirement Traceability Matrix</h1>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Stories', value: stories.length, color: 'bg-blue-100 text-blue-700' },
          { label: 'Coverage', value: `${coveragePct}%`, color: 'bg-purple-100 text-purple-700' },
          { label: 'Total Test Cases', value: testCases.length, color: 'bg-indigo-100 text-indigo-700' },
          { label: 'Untested Stories', value: stories.length - covered, color: 'bg-red-100 text-red-700' },
        ].map(c => (
          <div key={c.label} className="stat-card text-center">
            <div className={cn('text-3xl font-bold mb-1', c.color.split(' ')[1])}>{c.value}</div>
            <div className="text-sm text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        {[
          { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, label: 'All Pass' },
          { icon: <XCircle className="w-4 h-4 text-red-500" />, label: 'Has Failures' },
          { icon: <AlertTriangle className="w-4 h-4 text-orange-500" />, label: 'Blocked' },
          { icon: <MinusCircle className="w-4 h-4 text-slate-400" />, label: 'Not Run / Has TCs' },
          { icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />, label: 'Untested (No TCs)' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1.5 text-muted-foreground">{l.icon}{l.label}</span>
        ))}
      </div>

      {/* RTM Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>User Story</th>
                <th>Feature</th>
                <th>Test Cases</th>
                <th>Approved TCs</th>
                <th>Execution Status</th>
                <th>Coverage</th>
              </tr>
            </thead>
            <tbody>
              {stories.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No user stories found.</td></tr>
              )}
              {stories.map(story => {
                const feature = store.features.find(f => f.id === story.feature_id)
                const tcs = testCases.filter(tc => tc.story_id === story.id)
                const approvedTCs = tcs.filter(tc => tc.status === 'APPROVED').length
                const status = getStoryStatus(story.id)
                const statusConfig = {
                  pass: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-600', label: 'All Pass' },
                  fail: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-600', label: 'Failing' },
                  blocked: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-orange-600', label: 'Blocked' },
                  not_run: { icon: <MinusCircle className="w-4 h-4" />, color: 'text-slate-400', label: 'Not Run' },
                  untested: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-yellow-600', label: 'Untested' },
                }[status]

                return (
                  <tr key={story.id}>
                    <td>
                      <div className="font-medium text-foreground max-w-xs truncate">{story.title}</div>
                      {story.acceptance_criteria && <div className="text-xs text-muted-foreground truncate max-w-xs">{story.acceptance_criteria}</div>}
                    </td>
                    <td className="text-sm text-muted-foreground">{feature?.title || '—'}</td>
                    <td className="text-center">
                      <span className="badge bg-secondary text-secondary-foreground">{tcs.length}</span>
                    </td>
                    <td className="text-center">
                      <span className={cn('badge', approvedTCs > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>{approvedTCs}</span>
                    </td>
                    <td>
                      <span className={cn('flex items-center gap-1.5 text-sm font-medium', statusConfig.color)}>
                        {statusConfig.icon}{statusConfig.label}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2 min-w-16">
                          <div className={cn('h-2 rounded-full transition-all', tcs.length > 0 ? 'bg-primary' : 'bg-muted')} style={{ width: `${tcs.length > 0 ? Math.min((approvedTCs / tcs.length) * 100, 100) : 0}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-10">{tcs.length > 0 ? Math.round((approvedTCs/tcs.length)*100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
