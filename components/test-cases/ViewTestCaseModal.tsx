'use client'

import { STATUS_COLORS, STATUS_LABELS, cn, formatDateTime } from '@/lib/utils'
import type { TestCase } from '@/types'
import { useAppStore } from '@/store/appStore'

interface Props {
  viewTC: TestCase
  onClose: () => void
}

export default function ViewTestCaseModal({ viewTC, onClose }: Props) {
  const store = useAppStore()
  const history = store.executionItems
    .filter(ei => ei.test_case_id === viewTC.id)
    .sort((a,b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4" onClick={onClose}>
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
          <button className="btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="card-body space-y-4">
          {viewTC.description && (
            <div>
              <p className="form-label">Description</p>
              <p className="text-sm text-muted-foreground">{viewTC.description}</p>
            </div>
          )}
          {viewTC.preconditions && (
            <div>
              <p className="form-label">Preconditions</p>
              <p className="text-sm text-muted-foreground">{viewTC.preconditions}</p>
            </div>
          )}
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
          {viewTC.expected_result && (
            <div>
              <p className="form-label">Overall Expected Result</p>
              <p className="text-sm text-muted-foreground">{viewTC.expected_result}</p>
            </div>
          )}
          {viewTC.postconditions && (
            <div>
              <p className="form-label">Postconditions</p>
              <p className="text-sm text-muted-foreground">{viewTC.postconditions}</p>
            </div>
          )}

          {/* Execution History Section */}
          <div className="border-t pt-4 mt-2">
            <p className="form-label mb-3">Execution History</p>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">This test case has not been added to any execution cycles yet.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                <table className="w-full text-left text-sm relative">
                  <thead className="bg-muted/90 backdrop-blur-sm border-b sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-2 font-medium text-muted-foreground">Cycle</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground">Executed By</th>
                      <th className="px-4 py-2 font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.map(ei => {
                      const cycle = store.executionCycles.find(c => c.id === ei.cycle_id)
                      const executor = store.profiles.find(p => p.id === ei.executed_by)
                      return (
                        <tr key={ei.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2 font-medium">{cycle?.name || 'Unknown Cycle'}</td>
                          <td className="px-4 py-2">
                            <span className={cn('badge text-[10px] px-1.5 py-0.5', STATUS_COLORS[ei.status])}>
                              {STATUS_LABELS[ei.status as keyof typeof STATUS_LABELS] || ei.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{executor?.full_name || '—'}</td>
                          <td className="px-4 py-2 text-muted-foreground">{ei.executed_at ? formatDateTime(ei.executed_at) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
