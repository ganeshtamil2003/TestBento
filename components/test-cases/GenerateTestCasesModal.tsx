'use client'

import { useState } from 'react'
import { Sparkles, CheckSquare, Square, ChevronDown, ChevronRight, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'
import type { TestCase, UserStory, GeneratedTestCase } from '@/types'
import { STATUS_COLORS, STATUS_LABELS, cn } from '@/lib/utils'

interface Props {
  stories: UserStory[]
  initialStoryId?: string
  onClose: () => void
}

export default function GenerateTestCasesModal({ stories, initialStoryId, onClose }: Props) {
  const store = useAppStore()
  const [step, setStep] = useState<1 | 2>(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Step 1 Form
  const [form, setForm] = useState({
    story_id: initialStoryId || stories[0]?.id || '',
    requirement: '',
    acceptanceCriteria: '',
    count: 5,
  })

  // Step 2 State
  const [generatedCases, setGeneratedCases] = useState<GeneratedTestCase[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const selectedStory = stories.find(s => s.id === form.story_id)

  const supabase = createClient()

  const allowedStories = store.currentUser.global_role === 'QA_ENGINEER' 
    ? stories.filter(s => s.assignee_id === store.currentUser.id) 
    : stories

  // Pre-fill acceptance criteria if it changes and we haven't typed manually
  const handleStoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const s_id = e.target.value
    const s = stories.find(x => x.id === s_id)
    setForm(f => ({
      ...f,
      story_id: s_id,
      acceptanceCriteria: s?.acceptance_criteria || '',
      // Only swap description if we haven't typed a custom requirement yet or if it was the old description
      requirement: f.requirement ? f.requirement : (s?.description || '')
    }))
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.requirement.trim() || !form.story_id || isGenerating) return
    
    setIsGenerating(true)
    try {
      const res = await fetch('/api/generate-test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement: form.requirement,
          storyTitle: selectedStory?.title || '',
          acceptanceCriteria: form.acceptanceCriteria,
          count: form.count
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate')
      
      setGeneratedCases(data.testCases || [])
      setStep(2)
    } catch (err: any) {
      alert(err.message || 'An error occurred during generation.')
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSave() {
    const toSave = generatedCases.filter(tc => tc.isSelected)
    if (!toSave.length || isSaving) return
    setIsSaving(true)

    const payload = toSave.map(tc => {
      // Omit `isSelected` for payload
      const { isSelected, ...rest } = tc
      return {
        ...rest,
        story_id: form.story_id,
        status: 'DRAFT',
        created_by: store.currentUser.id,
      }
    })

    try {
      const { data, error } = await supabase.from('test_cases').insert(payload).select()
      if (error) throw error
      if (data) {
        store.addTestCases(data as TestCase[])
        onClose()
      }
    } catch (err: any) {
      alert('Failed to save test cases: ' + err.message)
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleSelectAll = () => {
    const allSelected = generatedCases.every(tc => tc.isSelected)
    setGeneratedCases(prev => prev.map(tc => ({ ...tc, isSelected: !allSelected })))
  }

  const toggleSelect = (idx: number) => {
    setGeneratedCases(prev => prev.map((tc, i) => i === idx ? { ...tc, isSelected: !tc.isSelected } : tc))
  }

  const selectedCount = generatedCases.filter(c => c.isSelected).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        
        <div className="card-header shrink-0 flex items-center justify-between border-b border-border/50 bg-card z-10 p-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="card-title text-base">Generate Test Cases (AI)</h2>
              <p className="text-xs text-muted-foreground">{step === 1 ? 'Step 1: Provide Requirements' : 'Step 2: Review and Save'}</p>
            </div>
          </div>
          <button className="btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 ? (
            <form id="gen-req-form" onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="form-label">Context / User Story *</label>
                <select className="form-input" value={form.story_id} onChange={handleStoryChange} required>
                  <option value="">Select a user story</option>
                  {allowedStories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
                {store.currentUser.global_role === 'QA_ENGINEER' && allowedStories.length === 0 && (
                  <div className="text-xs text-destructive mt-1">You are not assigned to any user stories.</div>
                )}
              </div>
              <div>
                <label className="form-label">Requirement Description *</label>
                <textarea 
                  className="form-textarea" 
                  rows={4} 
                  placeholder="Describe what needs to be tested..." 
                  value={form.requirement} 
                  onChange={e => setForm(f => ({ ...f, requirement: e.target.value }))} 
                  required 
                />
              </div>
              <div>
                <label className="form-label">Acceptance Criteria (Optional)</label>
                <textarea 
                  className="form-textarea bg-muted/20" 
                  rows={3} 
                  placeholder="e.g. Must handle invalid inputs, must return 200..." 
                  value={form.acceptanceCriteria} 
                  onChange={e => setForm(f => ({ ...f, acceptanceCriteria: e.target.value }))} 
                />
              </div>
              <div>
                <label className="form-label">Number of Test Cases to Generate</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="number" 
                    min="1" max="20" 
                    className="form-input w-24" 
                    value={form.count || ''} 
                    onChange={e => {
                      let val = parseInt(e.target.value);
                      if (isNaN(val)) val = 1;
                      if (val > 20) val = 20;
                      if (val < 1) val = 1;
                      setForm(f => ({ ...f, count: val }));
                    }} 
                  />
                  <span className="text-xs text-muted-foreground">Maximum: 20 test cases</span>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button className="text-sm text-primary hover:underline" onClick={toggleSelectAll}>
                  {generatedCases.every(tc => tc.isSelected) ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm font-medium text-muted-foreground">{selectedCount} of {generatedCases.length} selected</span>
              </div>
              
              <div className="space-y-3">
                {generatedCases.map((tc, idx) => (
                  <div key={idx} className={cn("border rounded-xl overflow-hidden transition-all", tc.isSelected ? "border-primary/50 bg-primary/[0.02]" : "border-border/50 bg-card opacity-70")}>
                    <div className="p-4 flex gap-3 cursor-pointer" onClick={() => toggleSelect(idx)}>
                      <button type="button" className="mt-0.5 text-primary">
                        {tc.isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-muted-foreground" />}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-sm text-foreground">{tc.title}</h4>
                          <div className="flex gap-1 shrink-0">
                            <span className={cn('badge text-[10px] px-1.5 py-0', STATUS_COLORS[tc.priority])}>{tc.priority}</span>
                            <span className={cn('badge text-[10px] px-1.5 py-0', STATUS_COLORS[tc.automation_status])}>
                              {STATUS_LABELS[tc.automation_status as keyof typeof STATUS_LABELS] || tc.automation_status}
                            </span>
                          </div>
                        </div>
                        {tc.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tc.description}</p>}
                      </div>
                      
                      <button 
                        type="button" 
                        className="btn-ghost btn-icon p-1"
                        onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === idx ? null : idx) }}
                      >
                        {expandedId === idx ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </div>

                    {expandedId === idx && (
                      <div className="px-12 pb-4 pt-1 border-t border-border/30 text-xs space-y-3 animate-fade-in bg-muted/10">
                        {tc.preconditions && <div><span className="font-semibold text-muted-foreground">Pre:</span> {tc.preconditions}</div>}
                        
                        <div className="space-y-2">
                           <span className="font-semibold text-muted-foreground block mb-1">Steps:</span>
                           {tc.steps?.map((s, s_idx) => (
                             <div key={s.step_number || s_idx} className="flex gap-2">
                               <span className="w-5 h-5 rounded bg-primary/10 text-primary font-bold flex items-center justify-center flex-shrink-0 text-[10px]">{s.step_number || (s_idx + 1)}</span>
                               <div className="flex-1">
                                 <div>{s.action}</div>
                                 {s.test_data && <div className="font-mono text-[10px] text-muted-foreground mt-0.5">Data: {s.test_data}</div>}
                               </div>
                               <div className="w-1/3 text-muted-foreground">{s.expected_result}</div>
                             </div>
                           ))}
                        </div>

                        {tc.expected_result && <div><span className="font-semibold text-muted-foreground">Expected:</span> {tc.expected_result}</div>}
                        {tc.postconditions && <div><span className="font-semibold text-muted-foreground">Post:</span> {tc.postconditions}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border/50 bg-muted/10 flex gap-3 shrink-0">
          <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={isGenerating || isSaving}>Cancel</button>
          
          {step === 1 ? (
             <button type="submit" form="gen-req-form" className="btn-primary flex-1 group" disabled={isGenerating}>
               {isGenerating ? (
                 <span className="flex items-center justify-center gap-2">
                   <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin"/> Generating...
                 </span>
               ) : (
                 <span className="flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> Generate {form.count}</span>
               )}
             </button>
          ) : (
             <button type="button" onClick={handleSave} className="btn-primary flex-1 group" disabled={isSaving || selectedCount === 0}>
               {isSaving ? 'Saving...' : <span className="flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save {selectedCount} to Project</span>}
             </button>
          )}
        </div>

      </div>
    </div>
  )
}
