'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { Settings, Plug, ChevronRight, Save, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { logAudit } from '@/lib/audit'
import { can } from '@/lib/permissions'

export default function IntegrationsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const store = useAppStore()
  const supabase = createClient()

  const project = store.projects.find(p => p.id === projectId)
  const existingIntegration = store.projectIntegrations.find(pi => pi.project_id === projectId && pi.provider === 'JIRA')

  const [baseUrl, setBaseUrl] = useState(existingIntegration?.base_url || '')
  const [email, setEmail] = useState(existingIntegration?.email || '')
  const [apiToken, setApiToken] = useState(existingIntegration?.api_token || '')
  const [targetProjectKey, setTargetProjectKey] = useState(existingIntegration?.target_project_key || '')
  
  const [isSaving, setIsSaving] = useState(false)
  
  // Only QA_LEAD, MANAGER, or ADMIN can edit integrations usually
  const canEdit = can(store.currentUser?.global_role as any, 'editProject') || store.currentUser?.global_role === 'QA_LEAD'

  useEffect(() => {
    if (existingIntegration) {
      setBaseUrl(existingIntegration.base_url)
      setEmail(existingIntegration.email)
      setApiToken(existingIntegration.api_token)
      setTargetProjectKey(existingIntegration.target_project_key)
    }
  }, [existingIntegration])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit) return

    setIsSaving(true)
    try {
      const payload = {
        project_id: projectId,
        provider: 'JIRA' as const,
        base_url: baseUrl,
        email,
        api_token: apiToken,
        target_project_key: targetProjectKey,
        updated_at: new Date().toISOString()
      }

      if (existingIntegration) {
        const { error } = await supabase
          .from('project_integrations')
          .update(payload)
          .eq('id', existingIntegration.id)

        if (error) throw error
        
        store.updateProjectIntegration(existingIntegration.id, payload)
        toast.success("JIRA integration updated")
        
        logAudit(supabase, {
          projectId,
          userId: store.currentUser.id,
          action: 'UPDATE',
          entityType: 'INTEGRATION',
          entityId: existingIntegration.id,
          entityTitle: 'JIRA Integration',
        })
      } else {
        const { data, error } = await supabase
          .from('project_integrations')
          .insert([payload])
          .select()
          .single()

        if (error) throw error
        
        store.addProjectIntegration(data)
        toast.success("JIRA integration created")
        
        logAudit(supabase, {
          projectId,
          userId: store.currentUser.id,
          action: 'CREATE',
          entityType: 'INTEGRATION',
          entityId: data.id,
          entityTitle: 'JIRA Integration',
        })
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to save integration")
    } finally {
      setIsSaving(false)
    }
  }

  if (!project) return <div className="p-8 text-muted-foreground">Project not found.</div>

  return (
    <div className="space-y-6 max-w-4xl">
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
            Project Integrations
          </h1>
        </div>
      </div>

      <div className="card p-6 border-l-4 border-l-indigo-500">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Settings className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">JIRA Configuration</h2>
            <p className="text-sm text-muted-foreground">Connect TestBento to your Atlassian JIRA workspace to sync defects live.</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">JIRA Base URL</label>
            <input
              type="url"
              required
              disabled={!canEdit}
              placeholder="e.g. https://your-domain.atlassian.net"
              className="input w-full"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">JIRA Email Address</label>
            <input
              type="email"
              required
              disabled={!canEdit}
              placeholder="Your Atlassian email"
              className="input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">JIRA API Token</label>
            <input
              type="password"
              required
              disabled={!canEdit}
              placeholder="Paste your JIRA API Token here"
              className="input w-full"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Generate this from your Atlassian Account Security settings.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Target Project Key</label>
            <input
              type="text"
              required
              disabled={!canEdit}
              placeholder="e.g. TEST (from TEST-123)"
              className="input w-full uppercase"
              value={targetProjectKey}
              onChange={(e) => setTargetProjectKey(e.target.value.toUpperCase())}
            />
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-border">
            {existingIntegration && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> Integration Active
              </span>
            )}
            {!existingIntegration && <span />}
            
            <button
              type="submit"
              disabled={!canEdit || isSaving}
              className="btn-primary flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {existingIntegration ? 'Update Configuration' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
