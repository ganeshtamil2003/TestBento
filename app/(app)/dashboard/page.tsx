'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import {
  FolderKanban, TestTube2, CheckCircle2, GitBranch,
  CheckCheck
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, Legend
} from 'recharts'

const EXEC_COLORS = ['#22c55e', '#ef4444', '#f97316', '#94a3b8']
const AUTO_COLORS = ['#6366f1', '#8b5cf6', '#94a3b8']

export default function DashboardPage() {
  const store = useAppStore()
  const { projects, testCases, reviewCycles, executionItems, currentUser } = store
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL')
  const [selectedCycleId, setSelectedCycleId] = useState<string>('ALL')

  const isAll = selectedProjectId === 'ALL'
  const activeProjectIds = isAll ? projects.map(p => p.id) : [selectedProjectId]

  // Filter everything based on project context
  const activeEpics = store.epics.filter(e => activeProjectIds.includes(e.project_id))
  const epicIds = new Set(activeEpics.map(e => e.id))

  const activeFeatures = store.features.filter(f => epicIds.has(f.epic_id))
  const featureIds = new Set(activeFeatures.map(f => f.id))

  const activeStories = store.userStories.filter(s => featureIds.has(s.feature_id))
  const storyIds = new Set(activeStories.map(s => s.id))

  const activeTestCases = testCases.filter(tc => storyIds.has(tc.story_id))
  const tcIds = new Set(activeTestCases.map(tc => tc.id))

  const activeCycles = store.executionCycles.filter(c => activeProjectIds.includes(c.project_id))
  const cycleIds = new Set(activeCycles.map(c => c.id))

  const activeExecutionItems = executionItems.filter(ei => cycleIds.has(ei.cycle_id))
  const activeReviews = reviewCycles.filter(rc => tcIds.has(rc.test_case_id))

  const filteredExecutionItems = selectedCycleId === 'ALL' 
    ? activeExecutionItems 
    : activeExecutionItems.filter(ei => ei.cycle_id === selectedCycleId)

  const totalTCs = activeTestCases.length
  const approvedTCs = activeTestCases.filter(tc => tc.status === 'APPROVED').length
  const pendingReviews = activeReviews.filter(rc => rc.status === 'PENDING').length
  const passCount = filteredExecutionItems.filter(ei => ei.status === 'PASS').length
  const failCount = filteredExecutionItems.filter(ei => ei.status === 'FAIL').length
  const blockedCount = filteredExecutionItems.filter(ei => ei.status === 'BLOCKED').length
  const notRunCount = filteredExecutionItems.filter(ei => ei.status === 'NOT_RUN').length
  const totalExecItems = filteredExecutionItems.length
  const passRate = totalExecItems > 0 ? Math.round((passCount / totalExecItems) * 100) : 0

  const statCards = [
    { label: isAll ? 'Total Projects' : 'Project Status', value: isAll ? projects.length : 'Active', icon: FolderKanban, gradient: 'gradient-primary', sub: isAll ? 'Active projects' : projects.find(p => p.id === selectedProjectId)?.name },
    { label: 'Test Cases', value: totalTCs, icon: TestTube2, gradient: 'gradient-info', sub: `${approvedTCs} approved` },
    { label: 'Pending Reviews', value: pendingReviews, icon: CheckCircle2, gradient: 'gradient-warning', sub: 'Awaiting approval' },
    { label: 'Pass Rate', value: `${passRate}%`, icon: CheckCheck, gradient: 'gradient-success', sub: `${passCount}/${totalExecItems} passed` },
  ]

  const projectBarData = projects
    .filter(p => activeProjectIds.includes(p.id))
    .map(p => {
      const pEpics = store.epics.filter(e => e.project_id === p.id)
      const pEpicIds = new Set(pEpics.map(e => e.id))
      const pFeatures = store.features.filter(f => pEpicIds.has(f.epic_id))
      const pFeatureIds = new Set(pFeatures.map(f => f.id))
      const pStories = store.userStories.filter(s => pFeatureIds.has(s.feature_id))
      const pStoryIds = new Set(pStories.map(s => s.id))
      const pTCs = testCases.filter(tc => pStoryIds.has(tc.story_id))
      return {
        name: p.name.split(' ').slice(0, 2).join(' '),
        Total: pTCs.length,
        Approved: pTCs.filter(tc => tc.status === 'APPROVED').length,
        Draft: pTCs.filter(tc => tc.status === 'DRAFT').length,
      }
    })

  const pieData = [
    { name: 'Pass', value: passCount },
    { name: 'Fail', value: failCount },
    { name: 'Blocked', value: blockedCount },
    { name: 'Not Run', value: notRunCount },
  ].filter(d => d.value > 0)

  const autoPieData = [
    { name: 'Automated', value: activeTestCases.filter(tc => tc.automation_status === 'AUTOMATED').length },
    { name: 'Semi-Auto', value: activeTestCases.filter(tc => tc.automation_status === 'SEMI_AUTOMATED').length },
    { name: 'Manual', value: activeTestCases.filter(tc => tc.automation_status === 'MANUAL').length },
  ].filter(d => d.value > 0)

  const trendData = activeCycles.length > 0 
    ? activeCycles
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(cycle => {
          const cycleItems = activeExecutionItems.filter(ei => ei.cycle_id === cycle.id)
          return {
            sprint: cycle.name.length > 15 ? cycle.name.substring(0, 15) + '...' : cycle.name,
            pass: cycleItems.filter(ei => ei.status === 'PASS').length,
            fail: cycleItems.filter(ei => ei.status === 'FAIL').length,
            blocked: cycleItems.filter(ei => ei.status === 'BLOCKED').length,
          }
        })
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            {isAll ? 'Workspace Overview' : 'Project Insights'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAll ? 'Real-time analytics across all projects' : `Detailed performance data for ${projects.find(p => p.id === selectedProjectId)?.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project:</span>
          <select 
            className="input h-10 px-3 cursor-pointer min-w-[200px]"
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value)
              setSelectedCycleId('ALL')
            }}
          >
            <option value="ALL">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {!isAll && (
            <>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-2">Sprint:</span>
              <select 
                className="input h-10 px-3 cursor-pointer min-w-[150px]"
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
              >
                <option value="ALL">All Sprints</option>
                {activeCycles.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="stat-card flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl ${card.gradient} flex items-center justify-center flex-shrink-0`}>
              <card.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">{card.label}</p>
              <p className="text-3xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="card-header"><h3 className="card-title">Test Cases by Project</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={projectBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Approved" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Draft" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Execution Status</h3></div>
          <div className="card-body flex flex-col items-center">
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={EXEC_COLORS[i % EXEC_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 w-full">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: EXEC_COLORS[i] }} />
                      <span className="text-muted-foreground text-xs">{d.name}</span>
                      <span className="font-semibold ml-auto text-xs">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-muted-foreground text-sm py-10">No execution data yet.</p>}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="card-header"><h3 className="card-title">Execution Trend</h3></div>
          <div className="card-body">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="sprint" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="pass" stackId="1" stroke="#22c55e" fill="#22c55e" />
                  <Area type="monotone" dataKey="fail" stackId="1" stroke="#ef4444" fill="#ef4444" />
                  <Area type="monotone" dataKey="blocked" stackId="1" stroke="#f97316" fill="#f97316" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-10 text-center">No sprint cycles found.</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Automation Coverage</h3></div>
          <div className="card-body flex flex-col items-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={autoPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {autoPieData.map((_, i) => <Cell key={i} fill={AUTO_COLORS[i % AUTO_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2 w-full">
              {autoPieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: AUTO_COLORS[i] }} />
                  <span className="text-muted-foreground text-xs">{d.name}</span>
                  <span className="font-semibold ml-auto text-xs">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Projects Overview</h3>
          <Link href="/projects" className="btn-secondary btn-sm">View All</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Epics</th>
                <th>Test Cases</th>
                <th>Members</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => {
                const pEpics = store.epics.filter(e => e.project_id === p.id)
                const pEpicIds = new Set(pEpics.map(e => e.id))
                const pFeatures = store.features.filter(f => pEpicIds.has(f.epic_id))
                const pFeatureIds = new Set(pFeatures.map(f => f.id))
                const pStories = store.userStories.filter(s => pFeatureIds.has(s.feature_id))
                const pStoryIds = new Set(pStories.map(s => s.id))
                const pTCs = testCases.filter(tc => pStoryIds.has(tc.story_id))
                const pMembers = store.projectMembers.filter(m => m.project_id === p.id)
                
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="font-medium text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                    </td>
                    <td className="text-muted-foreground">{pEpics.length}</td>
                    <td className="text-muted-foreground">{pTCs.length}</td>
                    <td className="text-muted-foreground">{pMembers.length}</td>
                    <td>
                      <Link href={`/projects/${p.id}/hierarchy`} className="btn-secondary btn-sm">Open</Link>
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
