import { createBrowserClient, createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

export const createClientBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

export const createClientServer = (cookies: {
  get(name: string): string | undefined
  set(name: string, value: string, options: CookieOptions): void
  remove(name: string, options: CookieOptions): void
}) =>
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies }
  )

