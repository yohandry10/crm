/**
 * Script para iniciar TODOS los Workers de BullMQ
 *
 * Este script:
 * - Carga las variables de entorno
 * - Verifica configuración
 * - Inicia TODOS los workers (workflows, emails, importaciones)
 * - Maneja señales de cierre graceful
 *
 * Ejecutar con:
 *   pnpm worker
 *   o
 *   node --loader ts-node/esm scripts/start-worker.ts
 */

import 'dotenv/config' // Cargar .env.local
import { createWorkflowWorker } from '../lib/workers/workflow-worker'
import { createEmailWorker } from '../lib/workers/email-worker'
import { createImportWorker } from '../lib/workers/import-worker'
import type { Worker } from 'bullmq'

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function redactConnectionString(value: string | undefined): string {
  if (!value) return 'No configurado'

  try {
    const url = new URL(value)
    if (url.password) url.password = '***'
    if (url.username) url.username = '***'
    return url.toString()
  } catch {
    return value.includes('@') ? value.replace(/\/\/[^@]+@/, '//***@') : value
  }
}

// Banner de inicio
console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════╗
║                                                       ║
║         🚀 CRM AI Peru - BullMQ Workers 🚀           ║
║                                                       ║
║  Procesador de Background Jobs con BullMQ            ║
║  • Workflows   • Emails   • Importaciones            ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝${colors.reset}
`)

// Verificar variables de entorno críticas
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
)

if (missingEnvVars.length > 0) {
  log('❌ ERROR: Faltan variables de entorno:', colors.red)
  missingEnvVars.forEach((varName) => {
    log(`   - ${varName}`, colors.red)
  })
  log('\n💡 Asegúrate de tener un archivo .env.local con estas variables\n', colors.yellow)
  process.exit(1)
}

// Verificar Redis
if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
  log('⚠️  ADVERTENCIA: Redis no configurado', colors.yellow)
  log('   El worker NO funcionará sin Redis en producción', colors.yellow)
  log('   Configura REDIS_URL o REDIS_HOST en .env.local\n', colors.yellow)

  if (process.env.NODE_ENV === 'production') {
    log('❌ Redis es OBLIGATORIO en producción', colors.red)
    process.exit(1)
  }
}

// Mostrar configuración
log('\n📋 Configuración:', colors.cyan)
log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
log(`   Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
log(`   Redis: ${redactConnectionString(process.env.REDIS_URL || process.env.REDIS_HOST)}`)
log(`   Concurrency: ${process.env.WORKER_CONCURRENCY || '5'} jobs simultáneos\n`)

// Iniciar todos los workers
const workers: Worker[] = []

try {
  log('🚀 Iniciando workers...', colors.green)

  // Worker 1: Workflows
  log('   📋 Iniciando worker de workflows...', colors.cyan)
  const workflowWorker = createWorkflowWorker()
  workers.push(workflowWorker)
  log('   ✅ Worker de workflows listo (concurrencia: 5)', colors.green)

  // Worker 2: Emails
  log('   📧 Iniciando worker de emails...', colors.cyan)
  const emailWorker = createEmailWorker()
  workers.push(emailWorker)
  log('   ✅ Worker de emails listo (concurrencia: 10)', colors.green)

  // Worker 3: Importaciones
  log('   📥 Iniciando worker de importaciones...', colors.cyan)
  const importWorker = createImportWorker()
  workers.push(importWorker)
  log('   ✅ Worker de importaciones listo (concurrencia: 2)', colors.green)

  log(`\n✅ ${workers.length} workers iniciados exitosamente`, colors.green)
  log('📡 Esperando jobs en las colas...\n', colors.cyan)
  log('💡 Presiona Ctrl+C para detener los workers\n', colors.yellow)

  // Mantener el proceso vivo
  process.stdin.resume()

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log(`\n⚠️  Señal ${signal} recibida, cerrando workers...`, colors.yellow)

    for (const worker of workers) {
      await worker.close()
    }

    log('✅ Workers cerrados correctamente', colors.green)
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

} catch (error: any) {
  log(`❌ Error al iniciar workers: ${error.message}`, colors.red)
  console.error(error)
  process.exit(1)
}
