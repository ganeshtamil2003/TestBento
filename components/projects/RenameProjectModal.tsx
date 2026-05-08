'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'
import { X, Save } from 'lucide-react'

interface Props {
  project: { id: string; name: string }
  onClose: () => void
}

export default function RenameProjectModal({ project, onClose }: Props) {
  const [name, setName] = useState(project.name)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()
  const store = useAppStore()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const { error, data } = await supabase
        .from('projects')
        .update({ name: name.trim() })
        .eq('id', project.id)
        .select()
        .single()

      if (error) throw error
      if (data) {
        store.updateProject(project.id, { name: data.name })
        onClose()
      }
    } catch (err: any) {
      alert('Failed to rename project: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-semibold text-lg">Rename Project</h2>
          <button className="text-muted-foreground hover:text-foreground transition-colors" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSave} className="p-4 space-y-4">
          <div>
            <label className="form-label">Project Name</label>
            <input 
              className="form-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              autoFocus
              required
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn-primary flex-1 gap-2" disabled={isSubmitting || !name.trim()}>
              <Save className="w-4 h-4" /> Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
