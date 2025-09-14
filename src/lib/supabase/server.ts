import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

export async function getSupabaseFromCookies() {
  const store = await cookies()
  return createServerClient(
    supabaseUrl!,
    supabaseAnon!,
    {
      cookies: {
        get: async (name: string) => store.get(name)?.value,
        set: async (name: string, value: string, options: CookieOptions) => {
          store.set({ name, value, ...options })
        },
        remove: async (name: string, options: CookieOptions) => {
          store.delete({ name, ...options })
        },
      },
    }
  )
}

