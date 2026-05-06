import { existsSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { config as loadDotenv } from "dotenv"
import { createDatabaseBackup, readBackupManifest } from "./db-backup"

type SqlCheck = {
  name: string
  sql: string
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

function requireEnv(name: string) {
  const value = env(name)
  if (!value) throw new Error(`${name} is required`)
  return value
}

function run(command: string, args: string[], options: { input?: string } = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input: options.input,
    stdio: ["pipe", "pipe", "pipe"],
  })

  if (result.error) {
    throw new Error(`${command} failed to start: ${result.error.message}`)
  }

  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}: ${result.stderr}`)
  }

  return result.stdout
}

function restoreFullBackup(stagingDatabaseUrl: string, backupFile: string) {
  const pgRestore = env("PG_RESTORE_BIN") || "pg_restore"
  run(pgRestore, [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--dbname",
    stagingDatabaseUrl,
    backupFile,
  ])
}

function runSql(stagingDatabaseUrl: string, sql: string) {
  const psql = env("PSQL_BIN") || "psql"
  return run(psql, [
    "--dbname",
    stagingDatabaseUrl,
    "--set",
    "ON_ERROR_STOP=1",
    "--no-align",
    "--tuples-only",
    "--command",
    sql,
  ])
}

function assertSqlCheck(stagingDatabaseUrl: string, check: SqlCheck) {
  const output = runSql(stagingDatabaseUrl, check.sql).trim()
  if (output !== "0") {
    throw new Error(`${check.name} failed: ${output}`)
  }
}

function verifyFullRecovery(stagingDatabaseUrl: string) {
  const checks: SqlCheck[] = [
    {
      name: "production_readiness_after_restore",
      sql: "select count(*) from public.verify_production_readiness() where pass is not true;",
    },
    {
      name: "security_hardening_after_restore",
      sql: "select count(*) from public.verify_security_hardening() where pass is not true;",
    },
    {
      name: "data_integrity_after_restore",
      sql: "select count(*) from public.verify_data_integrity() where pass is not true;",
    },
  ]

  for (const check of checks) {
    assertSqlCheck(stagingDatabaseUrl, check)
  }
}

function verifyPartialRecovery(stagingDatabaseUrl: string) {
  const sql = `
    begin;
    create schema if not exists restore_probe;
    drop table if exists restore_probe.organizations;
    create table restore_probe.organizations as
      select id, name, created_at from public.organizations limit 10;
    do $$
    begin
      if not exists (select 1 from restore_probe.organizations) then
        raise exception 'partial recovery probe found no organizations';
      end if;
    end $$;
    rollback;
  `
  runSql(stagingDatabaseUrl, sql)
}

export async function testDatabaseRestore(cwd = process.cwd()) {
  loadEnvFiles(cwd)

  const stagingDatabaseUrl = requireEnv("STAGING_DATABASE_URL")
  const backupFile =
    env("BACKUP_FILE") ||
    (env("CREATE_BACKUP_BEFORE_RESTORE") === "true"
      ? (await createDatabaseBackup(cwd)).outputFile
      : undefined)

  if (!backupFile) {
    throw new Error("BACKUP_FILE is required unless CREATE_BACKUP_BEFORE_RESTORE=true")
  }

  const absoluteBackupFile = path.resolve(cwd, backupFile)
  if (!existsSync(absoluteBackupFile)) {
    throw new Error(`Backup file does not exist: ${absoluteBackupFile}`)
  }

  const manifest = readBackupManifest(absoluteBackupFile)
  restoreFullBackup(stagingDatabaseUrl, absoluteBackupFile)
  verifyFullRecovery(stagingDatabaseUrl)
  verifyPartialRecovery(stagingDatabaseUrl)

  console.log(JSON.stringify({
    success: true,
    backup_file: absoluteBackupFile,
    manifest_sha256: manifest?.sha256 || null,
    full_restore: "verified",
    partial_restore: "verified",
  }, null, 2))
}

const currentFile = fileURLToPath(import.meta.url)
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : ""

if (invokedFile === currentFile) {
  testDatabaseRestore().catch((error) => {
    console.error(`[FAIL] db:restore:test: ${error.message}`)
    process.exitCode = 1
  })
}
