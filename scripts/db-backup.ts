import { createHash } from "node:crypto"
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { config as loadDotenv } from "dotenv"

type Manifest = {
  created_at: string
  database_host: string
  file: string
  format: "pg_dump/custom"
  retention_days: number
  sha256: string
  size_bytes: number
}

function loadEnvFiles(cwd = process.cwd()) {
  for (const fileName of [".env.production.local", ".env.production", ".env.local", ".env"]) {
    const envPath = path.join(cwd, fileName)
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath, override: false })
    }
  }
}

function env(name: string) {
  return process.env[name]?.trim()
}

function requireDatabaseUrl() {
  const value = env("BACKUP_DATABASE_URL") || env("DATABASE_URL") || env("SUPABASE_DB_URL")
  if (!value) {
    throw new Error("BACKUP_DATABASE_URL, DATABASE_URL, or SUPABASE_DB_URL is required")
  }
  return value
}

function databaseHost(databaseUrl: string) {
  try {
    return new URL(databaseUrl).host
  } catch {
    return "unknown"
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function sha256File(filePath: string) {
  const hash = createHash("sha256")
  const stream = createReadStream(filePath)
  return new Promise<string>((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("error", reject)
    stream.on("end", () => resolve(hash.digest("hex")))
  })
}

function runPgDump(databaseUrl: string, outputFile: string) {
  const pgDump = env("PG_DUMP_BIN") || "pg_dump"
  const args = [
    "--format=custom",
    "--blobs",
    "--no-owner",
    "--no-privileges",
    "--verbose",
    "--file",
    outputFile,
    databaseUrl,
  ]

  const result = spawnSync(pgDump, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })

  if (result.error) {
    throw new Error(`pg_dump failed to start: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const details = `${result.stderr || result.stdout || ""}`
      .replaceAll(databaseUrl, "[REDACTED_DATABASE_URL]")
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-8)
      .join("\n")
    const versionHint =
      details.includes("no coincide la versión del servidor") ||
      details.includes("server version mismatch")
        ? "\nInstall PostgreSQL 17 client tools or set PG_DUMP_BIN to a pg_dump 17 binary."
        : ""
    throw new Error(`pg_dump failed with exit code ${result.status}${details ? `:\n${details}` : ""}${versionHint}`)
  }
}

export async function createDatabaseBackup(cwd = process.cwd()) {
  loadEnvFiles(cwd)

  const databaseUrl = requireDatabaseUrl()
  const backupDir = path.resolve(cwd, env("BACKUP_DIR") || "backups")
  const retentionDays = Number(env("BACKUP_RETENTION_DAYS") || "30")
  const fileName = `crm-postgres-${timestamp()}.dump`
  const outputFile = path.join(backupDir, fileName)

  mkdirSync(backupDir, { recursive: true })
  runPgDump(databaseUrl, outputFile)

  const stats = statSync(outputFile)
  if (stats.size <= 0) {
    throw new Error("Backup file is empty")
  }

  const sha256 = await sha256File(outputFile)
  const manifest: Manifest = {
    created_at: new Date().toISOString(),
    database_host: databaseHost(databaseUrl),
    file: fileName,
    format: "pg_dump/custom",
    retention_days: retentionDays,
    sha256,
    size_bytes: stats.size,
  }

  const manifestFile = `${outputFile}.manifest.json`
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(JSON.stringify({
    success: true,
    backup_file: outputFile,
    manifest_file: manifestFile,
    size_bytes: stats.size,
    sha256,
  }, null, 2))

  return { outputFile, manifestFile, manifest }
}

export function readBackupManifest(backupFile: string): Manifest | null {
  const manifestFile = `${backupFile}.manifest.json`
  if (!existsSync(manifestFile)) return null
  return JSON.parse(readFileSync(manifestFile, "utf8")) as Manifest
}

const currentFile = fileURLToPath(import.meta.url)
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : ""

if (invokedFile === currentFile) {
  createDatabaseBackup().catch((error) => {
    console.error(`[FAIL] db:backup: ${error.message}`)
    process.exitCode = 1
  })
}
