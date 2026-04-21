'use client'

import { useState } from 'react'
import { inviteUser, toggleUserStatus } from './actions'
import { Plus, Users } from 'lucide-react'
import type { Profile } from '@/types'
import { getInitials } from '@/lib/utils'

export default function AdminClient({ profiles }: { profiles: Profile[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    
    const formData = new FormData(e.currentTarget)
    const result = await inviteUser(formData)
    
    if (result?.error) {
      setErrorMsg(result.error)
      setLoading(false)
    } else {
      setIsModalOpen(false)
      setLoading(false)
    }
  }

  async function handleToggleStatus(userId: string, isCurrentlyActive: boolean) {
    // Only administrators can perform this. They shouldn't disable themselves.
    setLoading(true)
    try {
      const targetState = !isCurrentlyActive
      await toggleUserStatus(userId, targetState)
    } catch(err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create user accounts and configure Role-Based Access Control (RBAC).
          </p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create New User
        </button>
      </div>

      <div className="card">
        <div className="card-header border-b flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="card-title">Registered Workforce</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Email</th>
                <th>Joined Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(profile => (
                <tr key={profile.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-sm">
                        {getInitials(profile.full_name)}
                      </div>
                      <div className="font-medium text-foreground">{profile.full_name}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      profile.global_role === 'ADMIN' ? 'bg-red-50 text-red-700 border-red-200' :
                      profile.global_role === 'MANAGER' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      profile.global_role === 'QA_LEAD' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {profile.global_role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-muted-foreground text-sm">{profile.email}</td>
                  <td className="text-muted-foreground text-sm">
                    {new Date(profile.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td>
                    <button 
                      onClick={() => handleToggleStatus(profile.id, profile.status === 'ACTIVE')}
                      disabled={loading || profile.global_role === 'ADMIN'}
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                        profile.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200' 
                          : 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200'
                      } ${profile.global_role === 'ADMIN' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer transition-colors'}`}
                    >
                      {profile.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4" onClick={() => !loading && setIsModalOpen(false)}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="card-header border-b">
              <h2 className="card-title">Create New User</h2>
            </div>
            <form onSubmit={handleInvite} className="card-body space-y-4">
              {errorMsg && (
                <div className="p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-100">
                  {errorMsg}
                </div>
              )}
              
              <div>
                <label className="form-label" htmlFor="fullName">Full Name</label>
                <input id="fullName" name="fullName" type="text" required className="form-input" placeholder="e.g. Jane Smith" />
              </div>

              <div>
                <label className="form-label" htmlFor="email">Email Address</label>
                <input id="email" name="email" type="email" required className="form-input" placeholder="jane@company.com" />
              </div>

              <div>
                <label className="form-label" htmlFor="password">Temporary Password</label>
                <input id="password" name="password" type="text" required className="form-input" placeholder="SuperSecure123!" minLength={6}/>
                <p className="text-xs text-muted-foreground mt-1">Share this password with the user. They can log in immediately.</p>
              </div>

              <div>
                <label className="form-label" htmlFor="global_role">System Role</label>
                <select id="global_role" name="global_role" className="form-input" required>
                  <option value="QA_ENGINEER">QA Engineer (Write Tests, Execute)</option>
                  <option value="QA_LEAD">QA Lead (Review/Approve, Assign)</option>
                  <option value="MANAGER">Manager (Read-Only Reports)</option>
                  <option value="ADMIN">Administrator (Full Access)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" className="btn-secondary flex-1" onClick={() => setIsModalOpen(false)} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
