'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'
import { X, AlertTriangle, Trash2 } from 'lucide-react'

interface Props {
  project: { id: string; name: string }
  onClose: () => void
}

export default function DeleteProjectModal({ project, onClose }: Props) {
  const [confirmName, setConfirmName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const supabase = createClient()
  const store = useAppStore()

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    if (confirmName !== project.name || isDeleting) return

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id)

      if (error) throw error
      
      // Remove from store
      store.deleteProject(project.id)
      onClose()
    } catch (err: any) {
      alert('Failed to delete project: ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-destructive/20" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4 bg-destructive/5">
          <h2 className="font-semibold text-lg text-destructive flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Delete Project
          </h2>
          <button className="text-muted-foreground hover:text-foreground transition-colors" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleDelete} className="p-4 space-y-4">
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
            <p className="font-semibold mb-1">Warning: This action is permanent!</p>
            <p>Deleting this project will permanently delete all associated test cases, defects, execution cycles, and audit logs. This cannot be undone.</p>
          </div>

          <div>
            <label className="form-label text-sm">
              Please type <span className="font-bold text-foreground select-all">{project.name}</span> to confirm.
            </label>
            <input 
              className="form-input" 
              value={confirmName} 
              onChange={e => setConfirmName(e.target.value)} 
              placeholder={project.name}
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={isDeleting}>Cancel</button>
            <button 
              type="submit" 
              className="btn-primary bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent flex-1 gap-2" 
              disabled={isDeleting || confirmName !== project.name}
            >
              <Trash2 className="w-4 h-4" /> {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
