import { supabase } from '@/lib/supabase'

interface Result {
  ok: boolean
  error?: string
}

export async function adminUpdateEmail(userId: string, newEmail: string): Promise<Result> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Not authenticated' }

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_id: userId, new_email: newEmail }),
      }
    )

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, error: body.error ?? `HTTP ${response.status}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
