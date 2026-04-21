'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { TestCase, TestStep, UserStory } from '@/types'

interface Props {
  projectId: string
  editTC: TestCase | null
  stories: UserStory[]
  initialStoryId?: string
  onClose: () => void
}

const emptyStep = (): TestStep => ({ step_number: 1, action: '', test_data: '', expected_result: '' })

export default function TestCaseModal({ projectId, editTC, stories, initialStoryId, onClose }: Props) {
  const store = useAppStore()
  const [form, setForm] = useState({
    story_id: editTC?.story_id || initialStoryId || stories[0]?.id || '',
    title: editTC?.title || '',
    description: editTC?.description || '',
    preconditions: editTC?.preconditions || '',
    postconditions: editTC?.postconditions || '',
    expected_result: editTC?.expected_result || '',
    priority: (editTC?.priority || 'MEDIUM') as TestCase['priority'],
    automation_status: (editTC?.automation_status || 'MANUAL') as TestCase['automation_status'],
    status: (editTC?.status || 'DRAFT') as TestCase['status'],
  })
  const [steps, setSteps] = useState<TestStep[]>(
    editTC?.steps.length ? editTC.steps : [emptyStep()]
  )

  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  function addStep() {
    setSteps(prev => [...prev, { step_number: prev.length + 1, action: '', test_data: '', expected_result: '' }])
  }
  function removeStep(idx: number) {
    setSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_number: i + 1 })))
  }
  function updateStep(idx: number, field: keyof TestStep, value: string) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.story_id || isSubmitting) return
    setIsSubmitting(true)
    
    const validSteps = steps.filter(s => s.action.trim())

    try {
      if (editTC) {
        const { error, data } = await supabase.from('test_cases').update({
          ...form,
          steps: validSteps,
          // Note: we let Supabase handle updated_at triggers
        }).eq('id', editTC.id).select().single()
        
        if (!error && data) {
          store.updateTestCase(editTC.id, data as TestCase)
        }
      } else {
        const { error, data } = await supabase.from('test_cases').insert({
          ...form,
          steps: validSteps,
          created_by: store.currentUser.id,
          // Note: default attachments/parameters are handled via Postgres defaults or omitted here
        }).select().single()
        
        if (!error && data) {
          store.addTestCase(data as TestCase)
        }
      }
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="card-header sticky top-0 bg-card z-10">
          <h2 className="card-title">{editTC ? 'Edit Test Case' : 'Create Test Case'}</h2>
          <button className="btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="card-body space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="form-label">Title *</label>
              <input id="tc-title-input" className="form-input" placeholder="Test case title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>
            <div>
              <label className="form-label">User Story *</label>
              <select className="form-input" value={form.story_id} onChange={e => setForm(f => ({ ...f, story_id: e.target.value }))} required>
                <option value="">Select story</option>
                {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Priority</label>
              <select className="form-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TestCase['priority'] }))}>
                {['HIGH','MEDIUM','LOW'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TestCase['status'] }))}>
                {['DRAFT','IN_REVIEW','APPROVED','REJECTED'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Automation Status</label>
              <select className="form-input" value={form.automation_status} onChange={e => setForm(f => ({ ...f, automation_status: e.target.value as TestCase['automation_status'] }))}>
                {['MANUAL','AUTOMATED','SEMI_AUTOMATED'].map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Preconditions</label>
              <textarea className="form-textarea" rows={2} value={form.preconditions} onChange={e => setForm(f => ({ ...f, preconditions: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Postconditions</label>
              <textarea className="form-textarea" rows={2} value={form.postconditions} onChange={e => setForm(f => ({ ...f, postconditions: e.target.value }))} />
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="form-label mb-0">Test Steps</label>
              <button type="button" className="btn-secondary btn-sm" onClick={addStep}>
                <Plus className="w-3.5 h-3.5" /> Add Step
              </button>
            </div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="w-8 h-9 rounded bg-primary/10 text-primary font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{step.step_number}</span>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input className="form-input" placeholder="Action" value={step.action} onChange={e => updateStep(idx, 'action', e.target.value)} />
                    <input className="form-input" placeholder="Test data (optional)" value={step.test_data || ''} onChange={e => updateStep(idx, 'test_data', e.target.value)} />
                    <input className="form-input" placeholder="Expected result" value={step.expected_result} onChange={e => updateStep(idx, 'expected_result', e.target.value)} />
                  </div>
                  <button type="button" className="btn-ghost btn-icon p-1.5 mt-0.5 text-destructive/60 hover:text-destructive" onClick={() => removeStep(idx)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Overall Expected Result</label>
            <textarea className="form-textarea" rows={2} value={form.expected_result} onChange={e => setForm(f => ({ ...f, expected_result: e.target.value }))} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button id="save-tc-btn" type="submit" className="btn-primary flex-1" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : (editTC ? 'Save Changes' : 'Create Test Case')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
