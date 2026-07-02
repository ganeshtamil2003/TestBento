'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import ExportDropdown from '@/components/layout/ExportDropdown'
import { ChevronRight } from 'lucide-react'
import { exportToCSV, exportToExcel, exportTableToPDF } from '@/lib/export'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line
} from 'recharts'

const EXEC_COLORS = ['#22c55e', '#ef4444', '#f97316', '#94a3b8']

export default function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const store = useAppStore()
  const project = store.projects.find(p => p.id === projectId)
  const [activeTab, setActiveTab] = useState<'execution' | 'coverage' | 'defects'>('execution')
  
  const [selectedExecStatus, setSelectedExecStatus] = useState<string | null>(null)
  const [selectedDefectSeverity, setSelectedDefectSeverity] = useState<string | null>(null)

  const epicIds = new Set(store.epics.filter(e => e.project_id === projectId).map(e => e.id))
  const featureIds = new Set(store.features.filter(f => epicIds.has(f.epic_id)).map(f => f.id))
  const storyIds = new Set(store.userStories.filter(s => featureIds.has(s.feature_id)).map(s => s.id))
  const testCases = store.testCases.filter(tc => storyIds.has(tc.story_id))
  const cycles = store.executionCycles.filter(c => c.project_id === projectId)
  const executionItems = store.executionItems.filter(ei => testCases.some(tc => tc.id === ei.test_case_id))
  const allDefects = store.defects.filter(d => d.project_id === projectId)
  const [defectStatusFilter, setDefectStatusFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE')
  const filteredDefects = allDefects.filter(d => defectStatusFilter === 'ALL' || d.status === 'OPEN' || d.status === 'IN_PROGRESS')

  const execByFeature = store.features.filter(f => featureIds.has(f.id)).map(f => {
    const fStoryIds = new Set(store.userStories.filter(s => s.feature_id === f.id).map(s => s.id))
    const fTCs = testCases.filter(tc => fStoryIds.has(tc.story_id))
    const fItems = executionItems.filter(ei => fTCs.some(tc => tc.id === ei.test_case_id))
    return {
      name: f.title.split(' ').slice(0,2).join(' '),
      Pass: fItems.filter(ei => ei.status === 'PASS').length,
      Fail: fItems.filter(ei => ei.status === 'FAIL').length,
      Blocked: fItems.filter(ei => ei.status === 'BLOCKED').length,
      'Not Run': fItems.filter(ei => ei.status === 'NOT_RUN').length,
    }
  })

  const cycleData = cycles.map(c => ({
    name: c.name.split(' ').slice(0,3).join(' '),
    Pass: (c._counts?.pass ?? 0),
    Fail: (c._counts?.fail ?? 0),
    Blocked: (c._counts?.blocked ?? 0),
    'Not Run': (c._counts?.not_run ?? 0),
  }))

  const overallPie = [
    { name: 'Pass', value: executionItems.filter(ei => ei.status === 'PASS').length },
    { name: 'Fail', value: executionItems.filter(ei => ei.status === 'FAIL').length },
    { name: 'Blocked', value: executionItems.filter(ei => ei.status === 'BLOCKED').length },
    { name: 'Not Run', value: executionItems.filter(ei => ei.status === 'NOT_RUN').length },
  ].filter(d => d.value > 0)

  const tcStatusData = [
    { name: 'Approved', value: testCases.filter(tc => tc.status === 'APPROVED').length },
    { name: 'In Review', value: testCases.filter(tc => tc.status === 'IN_REVIEW').length },
    { name: 'Draft', value: testCases.filter(tc => tc.status === 'DRAFT').length },
    { name: 'Rejected', value: testCases.filter(tc => tc.status === 'REJECTED').length },
  ].filter(d => d.value > 0)

  const defectBySeverity = ['CRITICAL','HIGH','MEDIUM','LOW'].map(s => ({
    name: s,
    count: filteredDefects.filter(d => d.severity === s).length
  })).filter(d => d.count > 0)

  const COVER_COLORS = ['#6366f1', '#3b82f6', '#94a3b8', '#ef4444']

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
            <span>Reports</span>
          </div>
          <h1 className="page-title">Reports & Analytics</h1>
        </div>
        <div className="flex items-center gap-2 no-print">
          <ExportDropdown 
            onExportCSV={() => exportToCSV('project_metrics', execByFeature)}
            onExportExcel={() => exportToExcel('project_metrics', 'Metrics', execByFeature)}
            onExportPDF={() => exportTableToPDF('project_metrics', 'Project Metrics', execByFeature)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {(['execution','coverage','defects'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {tab === 'execution' ? 'Execution' : tab === 'coverage' ? 'Coverage' : 'Defects'}
          </button>
        ))}
      </div>

      {activeTab === 'execution' && (
        <div className="space-y-5">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Executed', value: executionItems.filter(e => e.status !== 'NOT_RUN').length, color: 'text-primary' },
              { label: 'Pass Rate', value: executionItems.length > 0 ? `${Math.round((executionItems.filter(e=>e.status==='PASS').length/executionItems.length)*100)}%` : '0%', color: 'text-green-600' },
              { label: 'Fail Rate', value: executionItems.length > 0 ? `${Math.round((executionItems.filter(e=>e.status==='FAIL').length/executionItems.length)*100)}%` : '0%', color: 'text-red-600' },
              { label: 'Open Defects', value: allDefects.filter(d => d.status === 'OPEN' || d.status === 'IN_PROGRESS').length, color: 'text-orange-600' },
            ].map(kpi => (
              <div key={kpi.label} className="stat-card text-center">
                <div className={`text-3xl font-bold mb-1 ${kpi.color}`}>{kpi.value}</div>
                <div className="text-sm text-muted-foreground">{kpi.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card">
              <div className="card-header"><h3 className="card-title">Execution by Feature</h3></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={execByFeature}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Pass" fill="#22c55e" stackId="a" radius={[0,0,0,0]} />
                    <Bar dataKey="Fail" fill="#ef4444" stackId="a" />
                    <Bar dataKey="Blocked" fill="#f97316" stackId="a" />
                    <Bar dataKey="Not Run" fill="#94a3b8" stackId="a" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3 className="card-title">Overall Status</h3></div>
              <div className="card-body flex flex-col items-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie 
                      data={overallPie} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value"
                      onClick={(data, index) => setSelectedExecStatus(data.name.toUpperCase().replace(' ', '_'))}
                      className="cursor-pointer"
                    >
                      {overallPie.map((_, i) => <Cell key={i} fill={EXEC_COLORS[i]} className="hover:opacity-80 transition-opacity" />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-2 w-full">
                  {overallPie.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: EXEC_COLORS[i] }} />
                      <span className="text-muted-foreground text-xs">{d.name}</span>
                      <span className="font-semibold ml-auto text-xs">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Cycle comparison */}
          {cycleData.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="card-title">Cycle Comparison</h3></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={cycleData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Pass" fill="#22c55e" radius={[4,4,0,0]} />
                    <Bar dataKey="Fail" fill="#ef4444" radius={[4,4,0,0]} />
                    <Bar dataKey="Blocked" fill="#f97316" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {/* Dynamic Execution Items Table based on Chart Click */}
          {selectedExecStatus && (
            <div className="card overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="card-header border-b flex items-center justify-between">
                <h3 className="card-title">Execution Items: {selectedExecStatus.replace('_', ' ')}</h3>
                <button onClick={() => setSelectedExecStatus(null)} className="text-xs text-muted-foreground hover:text-foreground">Clear Filter</button>
              </div>
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="data-table">
                  <thead className="sticky top-0 bg-card"><tr><th>Test Case</th><th>Status</th><th>Executed At</th></tr></thead>
                  <tbody>
                    {executionItems.filter(ei => ei.status === selectedExecStatus).length === 0 && (
                      <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">No items match this filter.</td></tr>
                    )}
                    {executionItems.filter(ei => ei.status === selectedExecStatus).map(ei => {
                      const tc = testCases.find(t => t.id === ei.test_case_id)
                      return (
                        <tr key={ei.id}>
                          <td className="font-medium text-sm">{tc?.title || 'Unknown'}</td>
                          <td><span className={`badge ${ei.status === 'PASS' ? 'bg-green-100 text-green-700' : ei.status === 'FAIL' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{ei.status}</span></td>
                          <td className="text-xs text-muted-foreground">{ei.executed_at ? new Date(ei.executed_at).toLocaleString() : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'coverage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card">
            <div className="card-header"><h3 className="card-title">Test Case Status Distribution</h3></div>
            <div className="card-body flex flex-col items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={tcStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {tcStatusData.map((_, i) => <Cell key={i} fill={COVER_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-2 w-full">
                {tcStatusData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COVER_COLORS[i] }} />
                    <span className="text-muted-foreground text-xs">{d.name}</span>
                    <span className="font-semibold ml-auto text-xs">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="card-title">Execution Type Coverage</h3></div>
            <div className="card-body">
              <div className="space-y-4">
                {[
                  { label: 'Automated', count: testCases.filter(tc=>tc.automation_status==='AUTOMATED').length, color: 'bg-purple-500' },
                  { label: 'Semi-Automated', count: testCases.filter(tc=>tc.automation_status==='SEMI_AUTOMATED').length, color: 'bg-indigo-400' },
                  { label: 'Manual', count: testCases.filter(tc=>tc.automation_status==='MANUAL').length, color: 'bg-slate-400' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{item.count} ({testCases.length > 0 ? Math.round((item.count/testCases.length)*100) : 0}%)</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full"><div className={`h-2.5 rounded-full ${item.color}`} style={{ width: `${testCases.length > 0 ? (item.count/testCases.length)*100 : 0}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'defects' && (
        <div className="space-y-5">
          <div className="flex justify-between items-center bg-card p-3 rounded-xl border border-border shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Defect Report Scope</h2>
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              <button 
                onClick={() => setDefectStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${defectStatusFilter === 'ACTIVE' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Active Defects Only
              </button>
              <button 
                onClick={() => setDefectStatusFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${defectStatusFilter === 'ALL' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All Defects
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => {
              const cnt = filteredDefects.filter(d => d.severity === s).length
              const colors = { CRITICAL: 'text-red-900', HIGH: 'text-red-600', MEDIUM: 'text-yellow-600', LOW: 'text-green-600' }
              return (
                <div key={s} className="stat-card text-center">
                  <div className={`text-3xl font-bold mb-1 ${colors[s as keyof typeof colors]}`}>{cnt}</div>
                  <div className="text-sm text-muted-foreground">{s}</div>
                </div>
              )
            })}
          </div>
          {defectBySeverity.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="card-title">Defect Density by Severity</h3></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={defectBySeverity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: 12 }} />
                    <Bar 
                      dataKey="count" fill="hsl(var(--primary))" radius={[4,4,0,0]} 
                      onClick={(data) => setSelectedDefectSeverity(data.name)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="card overflow-hidden">
            <div className="card-header border-b flex items-center justify-between">
              <h3 className="card-title">
                {selectedDefectSeverity ? `${selectedDefectSeverity} Defects` : 'All Defects'}
              </h3>
              {selectedDefectSeverity && (
                <button onClick={() => setSelectedDefectSeverity(null)} className="text-xs text-muted-foreground hover:text-foreground">Clear Filter</button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Title</th><th>Severity</th><th>Logged By</th></tr></thead>
                <tbody>
                  {filteredDefects.filter(d => selectedDefectSeverity ? d.severity === selectedDefectSeverity : true).length === 0 && <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">No defects match.</td></tr>}
                  {filteredDefects.filter(d => selectedDefectSeverity ? d.severity === selectedDefectSeverity : true).map(d => (
                    <tr key={d.id}>
                      <td><div className="font-medium text-sm">{d.title}</div>{d.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{d.description}</div>}</td>
                      <td><span className={`badge ${d.severity === 'CRITICAL' || d.severity === 'HIGH' ? 'bg-red-100 text-red-700' : d.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{d.severity}</span></td>
                      <td className="text-sm text-muted-foreground">{store.profiles.find(p => p.id === d.created_by)?.full_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
