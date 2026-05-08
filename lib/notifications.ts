import { SupabaseClient } from '@supabase/supabase-js'
import { AppNotification } from '@/types'

interface CreateNotificationParams {
  userId: string
  title: string
  message: string
  link?: string
}

export async function createNotification(
  supabase: SupabaseClient,
  storeAddNotification: (n: AppNotification) => void,
  params: CreateNotificationParams
) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: params.userId,
        title: params.title,
        message: params.message,
        link: params.link,
      })
      .select()
      .single()

    if (!error && data) {
      storeAddNotification(data as AppNotification)
    }
  } catch (err) {
    console.error('Failed to create notification:', err)
  }
}
