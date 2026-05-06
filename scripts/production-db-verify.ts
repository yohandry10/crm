import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { config as loadDotenv } from "dotenv"

interface DbReadinessCheck {
  check_name: string
  pass: boolean
  details: string | null
}

function loadProductionEnvFiles(cwd = process.cwd()) {
  for (const fileName of [".env.production.local", ".env.production", ".env.local", ".env"]) {
    const envPath = path.join(cwd, fileName)
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath, override: false })
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

function printChecks(checks: DbReadinessCheck[]) {
  for (const check of checks) {
    const label = check.pass ? "PASS" : "FAIL"
    console.log(`[${label}] ${check.check_name}${check.details ? ` - ${check.details}` : ""}`)
  }

  const failures = checks.filter((check) => !check.pass)
  console.log(`\nProduction DB verification: ${failures.length} failure(s), ${checks.length} check(s)`)
}

export async function verifyProductionDatabase() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await supabase.rpc("verify_production_readiness")
  if (error) {
    throw new Error(
      `verify_production_readiness failed. Apply migration 101 first. Supabase error: ${error.message}`
    )
  }

  const checks = (data || []) as DbReadinessCheck[]

  const { data: securityData, error: securityError } = await supabase.rpc("verify_security_hardening")
  if (securityError) {
    checks.push({
      check_name: "security_hardening_rpc",
      pass: false,
      details: `verify_security_hardening failed. Apply migration 109 first. Supabase error: ${securityError.message}`,
    })
    return checks
  }

  return checks.concat((securityData || []) as DbReadinessCheck[])
}

const currentFile = fileURLToPath(import.meta.url)
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : ""

if (invokedFile === currentFile) {
  loadProductionEnvFiles()
  verifyProductionDatabase()
    .then((checks) => {
      printChecks(checks)
      process.exitCode = checks.some((check) => !check.pass) ? 1 : 0
    })
    .catch((error) => {
      console.error(`[FAIL] production-db-verify: ${error.message}`)
      process.exitCode = 1
    })
}
