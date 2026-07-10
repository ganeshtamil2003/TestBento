'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { Plug, ChevronRight, Save, CheckCircle2, Loader2, Github, Gitlab, X, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { logAudit } from '@/lib/audit'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { ProjectIntegration } from '@/types'

const PROVIDERS = [
  {
    id: 'JIRA',
    name: 'Jira Software',
    description: 'Sync defects live from your Atlassian Jira workspace.',
    icon: Plug,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    fields: [
      { key: 'base_url', label: 'JIRA Base URL', type: 'url', placeholder: 'https://your-domain.atlassian.net' },
      { key: 'email', label: 'JIRA Email Address', type: 'email', placeholder: 'Your Atlassian email' },
      { key: 'api_token', label: 'JIRA API Token', type: 'password', placeholder: 'Paste API Token' },
      { key: 'target_project_key', label: 'Target Project Key', type: 'text', placeholder: 'e.g. TEST' },
    ]
  },
  {
    id: 'GITLAB',
    name: 'GitLab',
    description: 'Connect TestBento to GitLab Issues.',
    icon: Gitlab,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    fields: [
      { key: 'base_url', label: 'GitLab Host URL', type: 'url', placeholder: 'https://gitlab.com' },
      { key: 'api_token', label: 'Personal Access Token', type: 'password', placeholder: 'glpat-...' },
      { key: 'target_project_key', label: 'Project ID', type: 'text', placeholder: 'e.g. 12345678' },
    ]
  },
  {
    id: 'GITHUB',
    name: 'GitHub',
    description: 'Sync bugs directly with GitHub issues.',
    icon: Github,
    color: 'text-slate-800',
    bg: 'bg-slate-100',
    fields: [
      { key: 'base_url', label: 'GitHub API URL', type: 'url', placeholder: 'https://api.github.com' },
      { key: 'api_token', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_...' },
      { key: 'target_project_key', label: 'Repository', type: 'text', placeholder: 'owner/repo' },
    ]
  }
]

export default function IntegrationsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const store = useAppStore()
  const supabase = createClient()

  const project = store.projects.find(p => p.id === projectId)
  const allIntegrations = store.projectIntegrations.filter(pi => pi.project_id === projectId)
  
  const [selectedProvider, setSelectedProvider] = useState<typeof PROVIDERS[0] | null>(null)
  
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isActivating, setIsActivating] = useState<string | null>(null)
  
  const canEdit = can(store.currentUser?.global_role as any, 'editProject') || store.currentUser?.global_role === 'QA_LEAD'

  function handleOpenProvider(provider: typeof PROVIDERS[0]) {
    setSelectedProvider(provider)
    setShowForm(false)
    setEditingId(null)
  }

  function handleCreateNew() {
    if (!selectedProvider) return
    setEditingId(null)
    setFormData({
      name: '',
      base_url: selectedProvider.id === 'GITLAB' ? 'https://gitlab.com' : selectedProvider.id === 'GITHUB' ? 'https://api.github.com' : '',
      email: '',
      api_token: '',
      target_project_key: ''
    })
    setShowForm(true)
  }

  function handleEdit(integration: ProjectIntegration) {
    setEditingId(integration.id)
    setFormData({
      name: integration.name || '',
      base_url: integration.base_url || '',
      email: integration.email || '',
      api_token: integration.api_token || '',
      target_project_key: integration.target_project_key || ''
    })
    setShowForm(true)
  }

  async function handleActivate(integration: ProjectIntegration) {
    if (!canEdit) return
    setIsActivating(integration.id)
    try {
      // Deactivate all others
      await supabase
        .from('project_integrations')
        .update({ is_active: false })
        .eq('project_id', projectId)

      // Activate selected
      const { error } = await supabase
        .from('project_integrations')
        .update({ is_active: true })
        .eq('id', integration.id)

      if (error) throw error
      
      store.activateProjectIntegration(integration.id, projectId)
      toast.success(`Active connection set to ${integration.name}`)
      
      logAudit(supabase, {
        projectId,
        userId: store.currentUser.id,
        action: 'UPDATE',
        entityType: 'INTEGRATION',
        entityId: integration.id,
        entityTitle: integration.name,
        details: { action: 'activated' }
      })
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to activate connection")
    } finally {
      setIsActivating(null)
    }
  }

  async function handleDeactivate(integration: ProjectIntegration) {
    if (!canEdit) return
    
    setIsActivating(integration.id)
    try {
      const { error } = await supabase
        .from('project_integrations')
        .update({ is_active: false })
        .eq('id', integration.id)

      if (error) throw error
      
      store.deactivateProjectIntegration(integration.id)
      toast.success(`${integration.name} disconnected`)
      
      logAudit(supabase, {
        projectId,
        userId: store.currentUser.id,
        action: 'UPDATE',
        entityType: 'INTEGRATION',
        entityId: integration.id,
        entityTitle: integration.name,
        details: { action: 'deactivated' }
      })
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to deactivate connection")
    } finally {
      setIsActivating(null)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit || !selectedProvider) return

    setIsSaving(true)
    try {
      const payload: Partial<ProjectIntegration> = {
        project_id: projectId,
        provider: selectedProvider.id as any,
        name: formData.name || `${selectedProvider.name} Connection`,
        base_url: formData.base_url || 'https://api.github.com',
        email: formData.email || 'N/A', // Send N/A if email is blank to satisfy legacy NOT NULL if not migrated
        api_token: formData.api_token,
        target_project_key: formData.target_project_key,
        updated_at: new Date().toISOString()
      }

      if (editingId) {
        const { error } = await supabase
          .from('project_integrations')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error
        
        store.updateProjectIntegration(editingId, payload)
        toast.success(`Connection profile updated`)
      } else {
        // First connection is automatically active
        if (allIntegrations.length === 0) payload.is_active = true
        else payload.is_active = false

        const { data, error } = await supabase
          .from('project_integrations')
          .insert([payload])
          .select()
          .single()

        if (error) throw error
        
        store.addProjectIntegration(data)
        toast.success(`Connection profile created`)
      }
      setShowForm(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to save integration")
    } finally {
      setIsSaving(false)
    }
  }

  if (!project) return <div className="p-8 text-muted-foreground">Project not found.</div>

  const providerIntegrations = selectedProvider ? allIntegrations.filter(i => i.provider === selectedProvider.id) : []

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Link href="/projects" className="hover:text-foreground">Projects</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">{project.name}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Integrations</span>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <Plug className="w-6 h-6 text-indigo-500" />
            Integration Hub
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROVIDERS.map(provider => {
          const isConnected = allIntegrations.some(i => i.provider === provider.id)
          const activeCount = allIntegrations.filter(i => i.provider === provider.id && i.is_active).length
          const Icon = provider.icon
          
          return (
            <div key={provider.id} className="card p-5 hover:border-indigo-300 transition-colors flex flex-col h-full">
              <div className="flex items-start justify-between mb-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", provider.bg)}>
                  <Icon className={cn("w-6 h-6", provider.color)} />
                </div>
                {activeCount > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> ACTIVE
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">{provider.name}</h3>
              <p className="text-xs text-muted-foreground mb-6 flex-grow">{provider.description}</p>
              
              <button 
                onClick={() => handleOpenProvider(provider)}
                className={cn("w-full h-9 rounded-lg text-sm font-semibold transition-colors", 
                  isConnected ? "bg-accent hover:bg-accent/80 text-foreground" : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600")}
              >
                {isConnected ? 'Manage Profiles' : 'Connect'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Provider Details Modal */}
      {selectedProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <selectedProvider.icon className={cn("w-5 h-5", selectedProvider.color)} />
                <h3 className="font-bold text-foreground">
                  {showForm ? (editingId ? 'Edit Profile' : 'New Profile') : `Manage ${selectedProvider.name}`}
                </h3>
              </div>
              <button onClick={() => showForm ? setShowForm(false) : setSelectedProvider(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto">
              {!showForm ? (
                <div className="space-y-4">
                  {providerIntegrations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                      <selectedProvider.icon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No profiles configured yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {providerIntegrations.map(integration => (
                        <div key={integration.id} className={cn("p-4 rounded-xl border flex items-center justify-between gap-4 transition-colors", integration.is_active ? 'border-emerald-500 bg-emerald-50/30' : 'border-border hover:border-indigo-300')}>
                          <div>
                            <div className="font-bold text-sm text-foreground flex items-center gap-2">
                              {integration.name || 'Unnamed Profile'}
                              {integration.is_active && <span className="text-[10px] uppercase font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Active</span>}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono mt-1">{integration.target_project_key}</div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {integration.is_active ? (
                              <button 
                                onClick={() => handleDeactivate(integration)}
                                disabled={isActivating !== null || !canEdit}
                                className="btn-secondary text-xs h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              >
                                {isActivating === integration.id ? '...' : 'Deactivate'}
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleActivate(integration)}
                                disabled={isActivating !== null || !canEdit}
                                className="btn-secondary text-xs h-8 px-3"
                              >
                                {isActivating === integration.id ? '...' : 'Activate'}
                              </button>
                            )}
                            <button 
                              onClick={() => handleEdit(integration)}
                              disabled={!canEdit}
                              className="btn-secondary text-xs h-8 px-3"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {canEdit && (
                    <button 
                      onClick={handleCreateNew}
                      className="w-full h-10 border-2 border-dashed border-indigo-200 hover:border-indigo-400 text-indigo-600 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add New {selectedProvider.name} Profile
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSave} className="space-y-4 pb-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Connection Name</label>
                    <input
                      type="text"
                      required
                      disabled={!canEdit}
                      placeholder="e.g. Production Environment"
                      className="input w-full font-medium"
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  {selectedProvider.fields.map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-foreground mb-1">{field.label}</label>
                      <input
                        type={field.type}
                        required={field.key !== 'email'} // Because email is made optional
                        disabled={!canEdit}
                        placeholder={field.placeholder}
                        className={cn("input w-full", field.key === 'target_project_key' ? 'uppercase' : '')}
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          [field.key]: field.key === 'target_project_key' ? e.target.value.toUpperCase() : e.target.value 
                        }))}
                      />
                    </div>
                  ))}
                  
                  <div className="pt-6 flex items-center justify-end gap-3 border-t border-border mt-6">
                    <button 
                      type="button" 
                      onClick={() => setShowForm(false)}
                      className="btn-secondary h-10 px-4"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={!canEdit || isSaving}
                      className="btn-primary h-10 px-6 flex items-center gap-2"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Profile
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
