# Backups y restore

Estado actualizado: 2026-05-06.

## Estrategia activa

El CRM usa backups logicos de Postgres con `pg_dump --format=custom`.

Automatizacion versionada:

- Workflow diario: `.github/workflows/database-backup-restore.yml`.
- Backup: `pnpm db:backup`.
- Restore test: `pnpm db:restore:test`.
- Retencion de artefactos: 30 dias.

Secretos requeridos en GitHub Actions:

- `BACKUP_DATABASE_URL`: URL Postgres de produccion con permisos suficientes para `pg_dump`.
- `STAGING_DATABASE_URL`: URL Postgres de staging. Este entorno se sobrescribe durante la prueba de restore.

No guardar dumps en git. El repo ignora `/backups`, `*.dump` y manifests locales.

## Backup manual

```bash
pnpm db:backup
```

Variables aceptadas:

- `BACKUP_DATABASE_URL`, `DATABASE_URL` o `SUPABASE_DB_URL`.
- `BACKUP_DIR`, por defecto `backups`.
- `BACKUP_RETENTION_DAYS`, por defecto `30`.
- `PG_DUMP_BIN`, si `pg_dump` no esta en PATH.

El cliente debe ser compatible con la version del servidor. Supabase objetivo esta en PostgreSQL 17; en Windows usar, por ejemplo:

```powershell
$env:PG_DUMP_BIN="C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
pnpm db:backup
```

Salida:

- `backups/crm-postgres-<timestamp>.dump`.
- `backups/crm-postgres-<timestamp>.dump.manifest.json`.

El manifest contiene host, fecha, tamano y SHA-256 para verificar integridad del artefacto.

## Restore test total

```bash
BACKUP_FILE=backups/crm-postgres-YYYY-MM-DD.dump pnpm db:restore:test
```

Requiere:

- `STAGING_DATABASE_URL`.
- `BACKUP_FILE`, salvo que se use `CREATE_BACKUP_BEFORE_RESTORE=true`.
- `pg_restore` y `psql` compatibles con PostgreSQL 17; usar `PG_RESTORE_BIN` y `PSQL_BIN` si PATH apunta a otra version.

El restore test ejecuta:

- `pg_restore --clean --if-exists --no-owner --no-privileges` contra staging.
- `verify_production_readiness()`.
- `verify_security_hardening()`.
- `verify_data_integrity()`.

Si cualquier check devuelve fallos, el job falla.

## Recuperacion parcial

`pnpm db:restore:test` tambien prueba recuperacion parcial con una transaccion de probe:

- Crea schema temporal `restore_probe`.
- Materializa una muestra de `organizations`.
- Verifica que puede leer datos restaurados.
- Hace `rollback` para no dejar residuos.

Esto valida que el dump permite extraer subconjuntos sin hacer restore directo sobre produccion.

## Restore en produccion

Pasos obligatorios:

1. Confirmar fecha y SHA-256 del manifest.
2. Restaurar primero en staging y exigir `pnpm db:restore:test` OK.
3. Pausar crons/workers.
4. Hacer backup nuevo de seguridad antes del restore.
5. Restaurar con `pg_restore` en ventana de mantenimiento.
6. Ejecutar:

```bash
pnpm production:verify-db
pnpm production:check
```

7. Rehabilitar crons/workers.

Nunca probar restore directamente contra produccion.
