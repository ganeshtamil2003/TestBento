'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { Bug, ChevronRight, ExternalLink, Search, Filter } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

export default function DefectsPage() {
  const { projectId } = useParams()
  const store = useAppStore()
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('ALL')

  const project = store.projects.find(p => p.id === projectId)
  const projectCycles = store.executionCycles.filter(c => c.project_id === projectId)
  const cycleIds = projectCycles.map(c => c.id)
  
  // Aggregate all defects from execution items in this project
  const allDefects = store.executionItems
    .filter(ei => cycleIds.includes(ei.cycle_id))
    .flatMap(ei => {
      const cycle = projectCycles.find(c => c.id === ei.cycle_id)
      const tc = store.testCases.find(t => t.id === ei.test_case_id)
      return (ei.defects || []).map(d => ({
        ...d,
        cycleName: cycle?.name || 'Unknown Cycle',
        testCaseTitle: tc?.title || 'Unknown Test Case',
      }))
    })
    .filter(d => {
      const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) || 
                           d.testCaseTitle.toLowerCase().includes(search.toLowerCase())
      const matchesSeverity = severityFilter === 'ALL' || d.severity === severityFilter
      return matchesSearch && matchesSeverity
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const SEVERITY_COLORS = {
    CRITICAL: 'bg-red-100 text-red-700 border-red-200',
    HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
    MEDIUM: 'bg-blue-100 text-blue-700 border-blue-200',
    LOW: 'bg-slate-100 text-slate-700 border-slate-200',
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
            Project Defects
          </h1>
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
        </div>
      </div>

      {/* Defects Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bug Title</th>
                <th>Severity</th>
                <th>Source Test Case</th>
                <th>Execution Cycle</th>
                <th>Logged Date</th>
                <th>Links</th>
              </tr>
            </thead>
            <tbody>
              {allDefects.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    {search || severityFilter !== 'ALL' ? 'No defects match your filters.' : 'No defects logged for this project yet.'}
                  </td>
                </tr>
              )}
              {allDefects.map((defect) => (
                <tr key={defect.id}>
                  <td>
                    <div className="font-semibold text-sm">{defect.title}</div>
                    {defect.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{defect.description}</div>}
                  </td>
                  <td>
                    <span className={cn('badge text-[10px] px-2 py-0.5 border', SEVERITY_COLORS[defect.severity])}>
                      {defect.severity}
                    </span>
                  </td>
                  <td>
                    <div className="text-sm">{defect.testCaseTitle}</div>
                  </td>
                  <td>
                    <div className="text-sm text-muted-foreground">{defect.cycleName}</div>
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
    </div>
  )
}
