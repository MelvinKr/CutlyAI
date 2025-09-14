import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

export async function createSupabaseServer() {
  const cookieStore = await cookies()

  return createServerClient(
    supabaseUrl!,
    supabaseAnon!,
    {
      cookies: {
        get: async (name: string) => cookieStore.get(name)?.value,
        set: async (name: string, value: string, options: CookieOptions) => {
          cookieStore.set({ name, value, ...options })
        },
        remove: async (name: string, options: CookieOptions) => {
          cookieStore.delete({ name, ...options })
        },
      },
    }
  )
}

