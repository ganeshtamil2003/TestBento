'use client'

import { STATUS_COLORS, STATUS_LABELS, cn } from '@/lib/utils'
import type { TestCase } from '@/types'

interface Props {
  viewTC: TestCase
  onClose: () => void
}

export default function ViewTestCaseModal({ viewTC, onClose }: Props) {
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
        </div>
      </div>
    </div>
  )
}
