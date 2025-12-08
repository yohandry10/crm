/**
 * @deprecated Este archivo está deprecado.
 * 
 * Usa en su lugar:
 * - Cliente (browser): import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
 * - Server Components: import { createSupabaseServerClient } from '@/lib/supabase-server'
 * - Route Handlers: import { createSupabaseRouteHandler } from '@/lib/supabase-server'
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }
  
  _supabase = createClient(url, key)
  return _supabase
}

export const supabase = typeof window !== 'undefined' 
  ? null 
  : (null as unknown as SupabaseClient)

export function getServiceSupabase() {
  throw new Error('getServiceSupabase() is deprecated')
}
