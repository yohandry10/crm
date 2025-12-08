import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// Valores por defecto para desarrollo (deben configurarse en producción)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://crqnkdpjxeoqkfpttncq.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNycW5rZHBqeGVvcWtmcHR0bmNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzcwMzE3MiwiZXhwIjoyMDc5Mjc5MTcyfQ.iE4sjwPky0u_NN7_krMOogGPrGUbtN_JhhIqEGmwvTo'

export function createSupabaseServiceClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE env check:', {
      hasUrl: !!SUPABASE_URL,
      hasServiceKey: !!SUPABASE_SERVICE_KEY,
      urlValue: SUPABASE_URL?.substring(0, 30) + '...'
    })
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL')
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  })
}
