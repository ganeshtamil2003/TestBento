'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { Users, ChevronRight, UserPlus, Shield, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/audit'
import { can } from '@/lib/permissions'
import type { ProjectMember, UserRole } from '@/types'
import { cn } from '@/lib/utils'

export default function MembersPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const store = useAppStore()
  const supabase = createClient()

  const project = store.projects.find(p => p.id === projectId)
  const members = store.projectMembers.filter(m => m.project_id === projectId)
  
  // All active users who are NOT yet members of this project
  const availableProfiles = store.profiles.filter(p => 
    p.status === 'ACTIVE' && !members.some(m => m.user_id === p.id)
  )

  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canManage = can(store.currentUser?.global_role, 'createProject') || store.currentUser?.global_role === 'QA_LEAD'

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUserId || isSubmitting) return
    setIsSubmitting(true)

    try {
      const newMember = {
        project_id: projectId,
        user_id: selectedUserId,
        role: 'QA_ENGINEER' as UserRole // Default placeholder, we rely on global_role
      }

      const { data, error } = await supabase.from('project_members').insert(newMember).select('*, profile:user_id(*)').single()

      if (!error && data) {
        store.addProjectMember(data as ProjectMember)
        
        logAudit(supabase, {
          projectId,
          userId: store.currentUser.id,
          action: 'CREATE',
          entityType: 'MEMBER',
          entityId: data.id,
          entityTitle: data.profile?.full_name || 'Unknown User'
        })

        setShowAddModal(false)
        setSelectedUserId('')
      } else {
        console.error('Failed to add member:', error)
      }
    } finally {
      setIsSubmitting(false)
    }
  }


  async function handleRemoveMember(memberId: string) {
    if (!canManage || !window.confirm('Are you sure you want to remove this member from the project?')) return
    
    const member = members.find(m => m.id === memberId)
    if (!member) return

    try {
      const { error } = await supabase.from('project_members').delete().eq('id', memberId)
      if (!error) {
        store.removeProjectMember(memberId)
        
        logAudit(supabase, {
          projectId,
          userId: store.currentUser.id,
          action: 'DELETE',
          entityType: 'MEMBER',
          entityId: memberId,
          entityTitle: member.profile?.full_name || 'Unknown User'
        })
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (!project) return <div className="p-8 text-muted-foreground">Project not found.</div>

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Link href="/projects" className="hover:text-foreground">Projects</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">{project.name}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Members</span>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Project Members
          </h1>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" /> Add Member
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Email</th>
                <th>System Role</th>
                <th>Added On</th>
                {canManage && <th className="text-center w-24">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="py-12 text-center text-muted-foreground">
                    No members have been explicitly added to this project yet.
                  </td>
                </tr>
              )}
              {members.map(member => (
                <tr key={member.id}>
                  <td>
                    <div className="font-medium flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                        {member.profile?.full_name?.substring(0, 2).toUpperCase() || 'U'}
                      </div>
                      {member.profile?.full_name || 'Unknown User'}
                    </div>
                  </td>
                  <td className="text-muted-foreground text-sm">
                    {member.profile?.email}
                  </td>
                  <td>
                    <span className="badge bg-slate-100 text-slate-700 border-slate-200 text-xs">
                      {member.profile?.global_role?.replace('_', ' ') || 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {new Date(member.created_at).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className="text-center">
                      <div className="flex justify-center">
                        <button
                          className="btn-ghost btn-icon text-muted-foreground hover:text-red-600"
                          title="Remove member"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div className="bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5 border-b pb-4">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <UserPlus className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold">Add Project Member</h2>
            </div>
            
            <form onSubmit={handleAddMember} className="space-y-5">
              <div>
                <label className="form-label">Select User</label>
                <select 
                  className="form-input" 
                  value={selectedUserId} 
                  onChange={e => setSelectedUserId(e.target.value)}
                  required
                >
                  <option value="" disabled>-- Select a user --</option>
                  {availableProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                  ))}
                  {availableProfiles.length === 0 && (
                    <option value="" disabled>No available users to add</option>
                  )}
                </select>
                {availableProfiles.length === 0 && (
                  <p className="text-xs text-orange-600 mt-1">All active users are already members of this project.</p>
                )}
              </div>


              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={!selectedUserId || isSubmitting}>
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
