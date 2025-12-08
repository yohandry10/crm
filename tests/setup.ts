/**
 * Vitest Setup File
 * Configuración global para todos los tests
 */
import { vi } from 'vitest'

// Mock de variables de entorno
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.RESEND_API_KEY = 're_test_123'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

// Mock global de fetch
global.fetch = vi.fn()

// Mock de console para tests más limpios
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
