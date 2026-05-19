'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { ChevronRight, Plus, ChevronDown, FolderOpen, Layers, BookOpen, TestTube2, Trash2, FileText, AlertTriangle, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { can } from '@/lib/permissions'
import type { Epic, Feature, UserStory } from '@/types'

export default function HierarchyPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const store = useAppStore()
  const project = store.projects.find(p => p.id === projectId)
  const epics = store.epics.filter(e => e.project_id === projectId)
  const currentUser = store.currentUser
  const qaEngineers = store.projectMembers.filter(m => m.project_id === projectId && m.role === 'QA_ENGINEER')

  const supabase = createClient()

  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set([epics[0]?.id]))
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<{ type: 'epic' | 'feature' | 'story'; parentId?: string } | null>(null)
  const [viewAC, setViewAC] = useState<UserStory | null>(null)
  const [form, setForm] = useState({ title: '', description: '', acceptance_criteria: '' })
  const [deletePrompt, setDeletePrompt] = useState<{ type: 'epics'|'features'|'user_stories', id: string, name: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function toggleEpic(id: string) {
    setExpandedEpics(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleFeature(id: string) {
    setExpandedFeatures(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !modal || isSubmitting) return
    setIsSubmitting(true)
    
    try {
      if (modal.type === 'epic') {
        const { data, error } = await supabase.from('epics').insert({
          project_id: projectId, title: form.title, description: form.description
        }).select().single()
        if (!error && data) store.addEpic({ ...data, _counts: { features: 0 } } as Epic)
      } else if (modal.type === 'feature') {
        const { data, error } = await supabase.from('features').insert({
          epic_id: modal.parentId!, title: form.title, description: form.description
        }).select().single()
        if (!error && data) store.addFeature({ ...data, _counts: { user_stories: 0 } } as Feature)
      } else {
        const { data, error } = await supabase.from('user_stories').insert({
          feature_id: modal.parentId!, title: form.title, description: form.description, acceptance_criteria: form.acceptance_criteria
        }).select().single()
        if (!error && data) store.addUserStory({ ...data, _counts: { test_cases: 0 } } as UserStory)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setForm({ title: '', description: '', acceptance_criteria: '' })
      setModal(null)
      setIsSubmitting(false)
    }
  }

  async function handleDelete(type: 'epics'|'features'|'user_stories', id: string) {
    const { error } = await supabase.from(type).delete().eq('id', id)
    if (!error) {
      if (type === 'epics') store.deleteEpic(id)
      if (type === 'features') store.deleteFeature(id)
      if (type === 'user_stories') store.deleteUserStory(id)
    }
  }

  async function handleAssignStory(storyId: string, assigneeId: string) {
    const { error } = await supabase.from('user_stories').update({ assignee_id: assigneeId || null }).eq('id', storyId)
    if (!error) {
      store.updateUserStory(storyId, { assignee_id: assigneeId || undefined })
      if (assigneeId) {
        const story = store.userStories.find(s => s.id === storyId)
        const { data: nData } = await supabase.from('notifications').insert({
          user_id: assigneeId,
          title: 'New Story Assignment',
          message: `You have been assigned to write test cases for: ${story?.title}`,
          link: `/projects/${projectId}/test-cases?story=${storyId}`
        }).select().single()
        if (nData) store.addNotification(nData)
      }
    }
  }

  if (!project) return <div className="text-muted-foreground p-8">Project not found.</div>

  const canCreate = can(currentUser?.global_role, 'createHierarchy')
  const canDelete = can(currentUser?.global_role, 'deleteHierarchy')

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Link href="/projects" className="hover:text-foreground">Projects</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">{project.name}</span>
          </div>
          <h1 className="page-title">Hierarchy</h1>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setModal({ type: 'epic' })}>
            <Plus className="w-4 h-4 mr-2" /> Add Epic
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-body space-y-2">
          {epics.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No epics yet. Add your first epic to get started.</p>
            </div>
          )}
          {epics.map(epic => {
            const features = store.features.filter(f => f.epic_id === epic.id)
            const isEpicOpen = expandedEpics.has(epic.id)
            return (
              <div key={epic.id} className="border rounded-lg overflow-hidden">
                {/* Epic Row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-accent/40 cursor-pointer hover:bg-accent/60 transition-colors" onClick={() => toggleEpic(epic.id)}>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isEpicOpen ? '' : '-rotate-90'}`} />
                  <FolderOpen className="w-4 h-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">{epic.title}</div>
                    {epic.description && <div className="text-xs text-muted-foreground truncate">{epic.description}</div>}
                  </div>
                  <span className="badge bg-primary/10 text-primary text-xs">{features.length} features</span>
                  
                  {canCreate && (
                    <button className="btn-ghost btn-sm btn-icon p-1" onClick={e => { e.stopPropagation(); setModal({ type: 'feature', parentId: epic.id }); setExpandedEpics(p => new Set([...p, epic.id])) }}>
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button className="btn-ghost btn-sm btn-icon p-1 text-destructive/70 hover:text-destructive" onClick={e => { e.stopPropagation(); setDeletePrompt({ type: 'epics', id: epic.id, name: epic.title }) }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Features */}
                {isEpicOpen && features.map(feature => {
                  const stories = store.userStories.filter(s => s.feature_id === feature.id)
                  const isFeatOpen = expandedFeatures.has(feature.id)
                  return (
                    <div key={feature.id} className="border-t">
                      <div className="flex items-center gap-3 pl-8 pr-4 py-2.5 bg-background cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => toggleFeature(feature.id)}>
                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isFeatOpen ? '' : '-rotate-90'}`} />
                        <Layers className="w-3.5 h-3.5 text-purple-500" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground text-sm truncate">{feature.title}</div>
                          {feature.description && <div className="text-xs text-muted-foreground truncate mt-0.5">{feature.description}</div>}
                        </div>
                        <span className="badge bg-purple-100 text-purple-700 text-xs">{stories.length} stories</span>
                        
                        {canCreate && (
                          <button className="btn-ghost btn-sm btn-icon p-1" onClick={e => { e.stopPropagation(); setModal({ type: 'story', parentId: feature.id }); setExpandedFeatures(p => new Set([...p, feature.id])) }}>
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                        {canDelete && (
                          <button className="btn-ghost btn-sm btn-icon p-1 text-destructive/70 hover:text-destructive" onClick={e => { e.stopPropagation(); setDeletePrompt({ type: 'features', id: feature.id, name: feature.title }) }}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Stories */}
                      {isFeatOpen && stories.map(story => {
                        const tcCount = store.testCases.filter(tc => tc.story_id === story.id).length
                        return (
                          <div key={story.id} className="flex items-center gap-3 pl-14 pr-4 py-2 border-t bg-muted/20 hover:bg-muted/40 transition-colors">
                            <BookOpen className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground text-sm">{story.title}</div>
                              {story.description && <div className="text-xs text-muted-foreground truncate mt-0.5">{story.description}</div>}
                              {story.acceptance_criteria && (
                                <button 
                                  className="btn-ghost btn-sm text-[10px] h-6 px-2 mt-1 bg-accent/40 hover:bg-accent/80 text-muted-foreground border border-border/50 rounded flex items-center gap-1.5 transition-colors" 
                                  onClick={(e) => { e.stopPropagation(); setViewAC(story); }}
                                >
                                  <FileText className="w-3 h-3" /> View Acceptance Criteria
                                </button>
                              )}
                            </div>
                            <span className="badge bg-green-100 text-green-700 text-xs flex items-center gap-1">
                              <TestTube2 className="w-2.5 h-2.5" />{tcCount} TCs
                            </span>
                            
                            {canCreate && (
                              <div className="flex items-center gap-1 ml-2 border border-border/50 rounded bg-background px-1.5 py-0.5" onClick={e => e.stopPropagation()}>
                                <User className="w-3 h-3 text-muted-foreground" />
                                <select 
                                  className="bg-transparent text-xs text-muted-foreground focus:outline-none appearance-none cursor-pointer max-w-[100px] truncate"
                                  value={story.assignee_id || ''}
                                  onChange={(e) => handleAssignStory(story.id, e.target.value)}
                                >
                                  <option value="">Unassigned</option>
                                  {qaEngineers.map(member => (
                                    <option key={member.user_id} value={member.user_id}>
                                      {member.profile?.full_name || 'QA Engineer'}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <Link href={`/projects/${projectId}/test-cases?story=${story.id}`} className="btn-secondary btn-sm text-xs ml-2">View TCs</Link>
                            {canDelete && (
                              <button className="btn-ghost btn-sm btn-icon p-1 text-destructive/70 hover:text-destructive" onClick={() => setDeletePrompt({ type: 'user_stories', id: story.id, name: story.title })}>
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={() => !isSubmitting && setModal(null)}>
          <div className="bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">
              Add {modal.type === 'epic' ? 'Epic' : modal.type === 'feature' ? 'Feature' : 'User Story'}
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="form-label">Title *</label>
                <input className="form-input" placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea className="form-textarea" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {modal.type === 'story' && (
                <div>
                  <label className="form-label">Acceptance Criteria</label>
                  <textarea className="form-textarea" rows={2} placeholder="Given... When... Then..." value={form.acceptance_criteria} onChange={e => setForm(f => ({ ...f, acceptance_criteria: e.target.value }))} />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setModal(null)} disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewAC && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={() => setViewAC(null)}>
          <div className="bg-card rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Acceptance Criteria
            </h2>
            <div className="text-sm text-foreground mb-4 font-medium">{viewAC.title}</div>
            <div className="bg-muted/30 border border-border/50 rounded-lg p-4 text-sm max-h-[60vh] overflow-y-auto leading-relaxed text-muted-foreground">
              {viewAC.acceptance_criteria && (
                <ul className="list-disc pl-4 space-y-1.5 marker:text-muted-foreground/50">
                  {viewAC.acceptance_criteria.split('\n').filter(line => line.trim() !== '').map((line, i) => (
                    <li key={i}>{line.trim().replace(/^- /g, '')}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button className="btn-secondary" onClick={() => setViewAC(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {deletePrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={() => setDeletePrompt(null)}>
          <div className="bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5" /> Delete {deletePrompt.type === 'epics' ? 'Epic' : deletePrompt.type === 'features' ? 'Feature' : 'User Story'}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete <span className="font-semibold text-foreground">"{deletePrompt.name}"</span>? 
              This will permanently delete all child items associated with it. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setDeletePrompt(null)}>Cancel</button>
              <button 
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700 text-white" 
                onClick={async () => {
                  await handleDelete(deletePrompt.type, deletePrompt.id)
                  setDeletePrompt(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

