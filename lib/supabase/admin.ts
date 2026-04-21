import { createClient } from '@supabase/supabase-js'

/**
 * WARNING: This client uses the SERVICE ROLE KEY.
 * It bypasses all Row Level Security (RLS) policies.
 * It MUST ONLY be used in secure Server Actions or Server Contexts.
 * NEVER expose this key to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
