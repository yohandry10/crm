/**
 * Script de prueba para verificar Rate Limiting con Redis
 *
 * Uso:
 *   node test-rate-limit.js
 */

const BASE_URL = 'http://localhost:3000'

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(color, ...args) {
  console.log(color, ...args, colors.reset)
}

async function testAuthRateLimit() {
  log(colors.cyan, '\n🔐 TEST 1: Auth Rate Limiting (5 intentos máximo)')
  log(colors.blue, '=' .repeat(60))

  const testEmail = 'test@example.com'
  const wrongPassword = 'wrong-password'

  for (let i = 1; i <= 7; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: wrongPassword })
      })

      const data = await response.json()

      if (response.status === 429) {
        log(colors.red, `❌ Intento ${i}: BLOQUEADO (429)`)
        log(colors.yellow, `   Mensaje: ${data.error}`)
        break
      } else if (response.status === 401) {
        log(colors.yellow, `⚠️  Intento ${i}: Credenciales inválidas (esperado)`)
        if (data.remainingAttempts !== undefined) {
          log(colors.blue, `   Intentos restantes: ${data.remainingAttempts}`)
        }
        if (data.warning) {
          log(colors.yellow, `   Warning: ${data.warning}`)
        }
      } else {
        log(colors.green, `✓ Intento ${i}: Status ${response.status}`)
      }

      // Esperar 100ms entre intentos
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      log(colors.red, `❌ Error en intento ${i}:`, error.message)
    }
  }
}

async function testGeneralRateLimit() {
  log(colors.cyan, '\n📊 TEST 2: General API Rate Limiting (100 req/min para lectura)')
  log(colors.blue, '=' .repeat(60))
  log(colors.yellow, 'Haciendo 110 requests al endpoint /api/health...')

  let successCount = 0
  let rateLimitedCount = 0

  for (let i = 1; i <= 110; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`, {
        headers: {
          'Cache-Control': 'no-cache',
          'X-Test-Request': i.toString()
        }
      })

      if (response.status === 429) {
        rateLimitedCount++
        if (rateLimitedCount === 1) {
          const data = await response.json()
          log(colors.red, `\n❌ Rate limit alcanzado en request #${i}`)
          log(colors.yellow, `   Mensaje: ${data.message || data.error}`)

          const retryAfter = response.headers.get('Retry-After')
          const rateLimit = response.headers.get('X-RateLimit-Limit')
          const remaining = response.headers.get('X-RateLimit-Remaining')

          if (retryAfter) log(colors.blue, `   Retry-After: ${retryAfter}s`)
          if (rateLimit) log(colors.blue, `   Rate Limit: ${rateLimit}`)
          if (remaining) log(colors.blue, `   Remaining: ${remaining}`)
        }
      } else {
        successCount++
      }

      // Mostrar progreso cada 10 requests
      if (i % 10 === 0) {
        process.stdout.write(`\r   Progreso: ${i}/110 requests (✓ ${successCount} | ❌ ${rateLimitedCount})`)
      }
    } catch (error) {
      log(colors.red, `\n❌ Error en request ${i}:`, error.message)
    }
  }

  console.log('\n')
  log(colors.green, `✓ Requests exitosos: ${successCount}`)
  log(colors.red, `❌ Requests bloqueados: ${rateLimitedCount}`)
}

async function testRedisConnection() {
  log(colors.cyan, '\n🔌 TEST 3: Verificar conexión a Redis')
  log(colors.blue, '=' .repeat(60))

  try {
    const response = await fetch(`${BASE_URL}/api/health`)

    if (response.ok) {
      log(colors.green, '✓ Servidor Next.js respondiendo correctamente')

      // Hacer varias requests rápidas para forzar uso de Redis
      log(colors.blue, 'Haciendo 5 requests consecutivas...')

      for (let i = 1; i <= 5; i++) {
        await fetch(`${BASE_URL}/api/health`)
        process.stdout.write(`\r   Request ${i}/5...`)
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      console.log('')
      log(colors.green, '✓ Todas las requests procesadas')
      log(colors.cyan, '\nSi Redis está funcionando, las requests fueron registradas en Redis')
      log(colors.cyan, 'Puedes verificarlo con: docker exec -it crm-redis redis-cli')
      log(colors.cyan, 'Luego ejecuta: KEYS ratelimit:*')
    } else {
      log(colors.red, '❌ Error: El servidor no responde correctamente')
    }
  } catch (error) {
    log(colors.red, '❌ Error conectando al servidor:', error.message)
    log(colors.yellow, '\nAsegúrate de que el servidor esté corriendo:')
    log(colors.yellow, '  pnpm dev')
  }
}

async function runAllTests() {
  log(colors.cyan, '\n╔══════════════════════════════════════════════════════════════╗')
  log(colors.cyan, '║       TEST DE RATE LIMITING CON REDIS                       ║')
  log(colors.cyan, '╚══════════════════════════════════════════════════════════════╝')

  await testRedisConnection()
  await testAuthRateLimit()
  await testGeneralRateLimit()

  log(colors.cyan, '\n╔══════════════════════════════════════════════════════════════╗')
  log(colors.cyan, '║                 TESTS COMPLETADOS                            ║')
  log(colors.cyan, '╚══════════════════════════════════════════════════════════════╝\n')

  log(colors.yellow, '💡 Próximos pasos:')
  log(colors.blue, '   1. Verifica las claves en Redis: docker exec -it crm-redis redis-cli')
  log(colors.blue, '   2. Ejecuta: KEYS auth:ratelimit:* para ver intentos de login')
  log(colors.blue, '   3. Ejecuta: KEYS ratelimit:* para ver rate limiting general')
  log(colors.blue, '   4. Para borrar una clave: DEL nombre_de_la_clave\n')
}

// Ejecutar tests
runAllTests().catch(console.error)
