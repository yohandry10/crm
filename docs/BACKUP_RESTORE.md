# Backups y Restore (Supabase / Postgres)

## Backups
- Programa un dump diario de la base de datos:
  ```bash
  pg_dump "$SUPABASE_DB_URL" --format=custom --file=backup_$(date +%Y%m%d).dump
  ```
- Guarda los dumps en almacenamiento duradero (S3/GCS) con retención mínima de 30 días.
- Incluye los storage assets si los usas (`supabase storage`) con `aws s3 sync`.

## Restore
- Restaura en un entorno aislado antes de producción:
  ```bash
  pg_restore --clean --no-owner --dbname="$RESTORE_DB_URL" backup_YYYYMMDD.dump
  ```
- Verifica que las migraciones se hayan aplicado (drizzle/supabase migration status).
- Ejecuta smoke tests (login, contactos, facturación/pagos, workflows).

## Cron de limpieza de logs/cache
- Ejecuta semanalmente las funciones (cron/vercel cron/supabase scheduled):
  ```sql
  select cleanup_auditoria(90);
  select cleanup_analytics_cache_ttl(30);
  ```
- Define `CRON_SECRET` (ej. un UUID v4 o 256 bits random) en tu entorno y configúralo en Vercel/Supabase. Llama a los cron endpoints con header `Authorization: Bearer $CRON_SECRET`.
- Programa un job (cron/vercel cron/supabase scheduled function) que llame a estas funciones.

## Checklist antes de restaurar en prod
- Confirmar origen del backup y fecha.
- Verificar claves/env vars actualizadas (anon/service role).
- Pausar tareas programadas durante el restore.
- Tras restore: validar RLS habilitado y `040_validate_rls.sql`.
