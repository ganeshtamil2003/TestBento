import { SupabaseClient } from '@supabase/supabase-js'

interface LogAuditParams {
  projectId: string
  userId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | string
  entityType: 'TEST_CASE' | 'EPIC' | 'FEATURE' | 'USER_STORY' | 'EXECUTION_CYCLE' | string
  entityId: string
  entityTitle?: string
  details?: Record<string, any>
}

/**
 * Helper to record an action into the audit_logs table.
 */
export async function logAudit(
  supabase: SupabaseClient,
  params: LogAuditParams
) {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      project_id: params.projectId,
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      entity_title: params.entityTitle,
      details: params.details,
    })

    if (error) {
      console.error('Failed to insert audit log:', error)
    }
  } catch (err) {
    console.error('Error logging audit:', err)
  }
}
