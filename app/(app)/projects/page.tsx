'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { Plus, Search, FolderKanban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { can } from '@/lib/permissions'
import type { Project } from '@/types'

export default function ProjectsPage() {
  const { projects, addProject, currentUser } = useAppStore()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || isSubmitting) return
    
    setIsSubmitting(true)
    
    // Insert into Postgres (Supabase auto-generates the UUID and timestamps)
    const { data, error } = await supabase.from('projects').insert({
      name: form.name,
      description: form.description,
      created_by: currentUser.id
    }).select().single()

    if (error) {
      console.error('Failed to create project:', error)
      setIsSubmitting(false)
      return
    }

    // Update Zustand instantly for the UI cache
    addProject({ ...data, _counts: { epics: 0, test_cases: 0, members: 1 } } as Project)
    
    setForm({ name: '', description: '' })
    setShowModal(false)
    setIsSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{projects.length} projects total</p>
        </div>
        {can(currentUser?.global_role, 'createProject') && (
          <button id="new-project-btn" className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Project
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          id="project-search"
          className="form-input pl-9"
          placeholder="Search projects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p => (
          <ProjectCard key={p.id} project={p} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-muted-foreground">
            <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No projects found.</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Create New Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="form-label">Project Name *</label>
                <input id="project-name-input" className="form-input" placeholder="e.g. E-Commerce Platform" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea id="project-desc-input" className="form-textarea" rows={3} placeholder="Brief description of the project" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
                <button id="create-project-submit" type="submit" className="btn-primary flex-1">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const store = useAppStore()
  const gradients = ['gradient-primary', 'gradient-info', 'gradient-success', 'gradient-warning']
  const g = gradients[project.name.charCodeAt(0) % gradients.length]
  
  const epicIds = new Set(store.epics.filter(e => e.project_id === project.id).map(e => e.id))
  const featureIds = new Set(store.features.filter(f => epicIds.has(f.epic_id)).map(f => f.id))
  const storyIds = new Set(store.userStories.filter(s => featureIds.has(s.feature_id)).map(s => s.id))
  const testCaseCount = store.testCases.filter(tc => storyIds.has(tc.story_id)).length

  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      <div className={`h-2 ${g} rounded-t-xl`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-foreground text-base">{project.name}</h3>
        </div>
        <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{project.description || 'No description'}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: 'Epics', val: epicIds.size },
            { label: 'Test Cases', val: testCaseCount },
          ].map(s => (
            <div key={s.label} className="text-center p-2 bg-muted/50 rounded-lg">
              <div className="font-bold text-foreground text-lg">{s.val}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/projects/${project.id}/hierarchy`} className="btn-secondary text-center text-xs py-2">Hierarchy</Link>
          <Link href={`/projects/${project.id}/test-cases`} className="btn-primary text-center text-xs py-2">Test Cases</Link>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          <Link href={`/projects/${project.id}/reviews`} className="btn-ghost text-center text-xs py-1.5 text-muted-foreground">Reviews</Link>
          <Link href={`/projects/${project.id}/execution`} className="btn-ghost text-center text-xs py-1.5 text-muted-foreground">Execution</Link>
          <Link href={`/projects/${project.id}/rtm`} className="btn-ghost text-center text-xs py-1.5 text-muted-foreground">RTM</Link>
          <Link href={`/projects/${project.id}/reports`} className="btn-ghost text-center text-xs py-1.5 text-muted-foreground">Reports</Link>
        </div>
      </div>
    </div>
  )
}
