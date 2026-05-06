# Operacion

## Workers

BullMQ necesita Redis y un worker persistente para procesar colas de forma confiable.

Comando local:

```bash
pnpm worker
```

Riesgo:

- Vercel no mantiene procesos persistentes.
- Si no hay worker externo, workflows deben ocultarse, degradarse o procesarse con drainer controlado.

Opciones:

- Worker persistente en VPS, Railway, Render u otro runtime.
- Vercel Cron como drainer acotado de respaldo en perfil diario compatible con Hobby.
- Scheduler externo que invoque endpoints de drenado con limites claros si no se usa Vercel.

Estado actual:

- `vercel.json` registra dos cron diarios: `daily-maintenance` y `process-workflows`.
- `/api/cron/daily-maintenance` ejecuta `process-events`, `expire-quotes`, `cleanup-analytics-cache` y `cleanup-auditoria`.
- `/api/cron/process-workflows` fuerza runtime Node.js y limita duracion/jobs.
- Produccion actual por defecto: `WORKFLOW_PROCESSING_MODE=cron-drainer`.
- Para workflows vendidos como near-real-time, configurar tambien `pnpm worker` como proceso persistente, usar `WORKFLOW_PROCESSING_MODE=worker` y marcar `WORKER_PROCESS_CONFIGURED=true`.
- Los cron subdiarios requieren un plan Vercel compatible (`VERCEL_PLAN=pro` o `enterprise`) o un scheduler externo (`EXTERNAL_CRON_CONFIGURED=true`).

## Cron

`vercel.json` define cron jobs de produccion. En el plan actual se usa un perfil diario. Los endpoints `/api/cron/*` requieren `CRON_SECRET`.

Compatibilidad esperada:

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>`

Riesgo actual:

- Si `CRON_SECRET` no esta configurado, los endpoints deben fallar cerrado.
- Los cron de mantenimiento requieren service role despues de autenticar el secreto.

Accion:

- Hecho: `lib/cron-auth.ts` centraliza la validacion.
- Hecho: los handlers `/api/cron/*` usan la misma validacion.
- Hecho: `vercel.json` contiene los cron jobs minimos para mantenimiento y drenado acotado.

## Redis y rate limit

El codigo usa Redis si esta configurado y fallback en memoria si no lo esta.

Decision de produccion:

- `RATE_LIMIT_FAIL_OPEN=false`.
- Redis configurado es obligatorio.
- Si Redis no responde, el codigo usa fallback en memoria por instancia; si ese fallback falla, responde 503.
- `pnpm production:check` falla si Redis falta o si `RATE_LIMIT_FAIL_OPEN=true`.

## Observabilidad

OpenTelemetry solo arranca si:

```env
OTEL_ENABLED=true
```

Sentry aparece como opcional, pero debe verificarse que las dependencias y variables existan antes de documentarlo como activo.

Estado versionado:

- Vercel Web Analytics y Speed Insights estan montados en `app/layout.tsx`.
- Logs backend salen en JSON mediante `lib/logger.ts` y son aptos para Vercel Logs/Drains.
- `/api/health/deep` esta autenticado por `MONITORING_SECRET` o `CRON_SECRET` y reporta DB, Redis, colas, memoria, CPU, region, entorno y commit.
- `pnpm health:post-deploy` valida `/api/health` y `/api/health/deep`; si `ALERT_WEBHOOK_URL` esta configurado, envia notificacion de exito/error.
- Para centralizar fuera de Vercel, configurar Log Drains o integracion de observabilidad en el dashboard de Vercel.

## Build

`pnpm build` pasa.

Decisiones aplicadas:

- `bullmq` esta en `serverExternalPackages`, junto con `ioredis`, para no empaquetar internamente el worker/cola en Next.
- Las rutas que consultan/encolan jobs usan import dinamico y runtime Node cuando aplica.
- Se filtra el warning conocido de `@supabase/ssr`/Realtime en middleware Edge porque procede de checks internos de la dependencia, no de uso directo de APIs Node propias.
- No mover BullMQ a Edge Runtime.

## Preflight

Ejecutar antes de go-live y en CI/CD:

```bash
pnpm production:check
pnpm production:verify-db
```

`production:check` verifica variables, Redis, CORS publico, crons, migraciones criticas y referencias removidas. `production:verify-db` valida la base objetivo via RPC despues de aplicar migraciones. La alternativa manual es `supabase/verification/production-readiness.sql`.

## Backups y restore

Estado actual:

- `.github/workflows/database-backup-restore.yml` ejecuta backup diario y restore test en staging.
- `pnpm db:backup` crea dump Postgres custom con manifest SHA-256.
- `pnpm db:restore:test` restaura en staging, valida recuperacion total con RPCs de produccion/seguridad/integridad y ejecuta probe de recuperacion parcial.
- Secretos requeridos en GitHub Actions: `BACKUP_DATABASE_URL` y `STAGING_DATABASE_URL`.
- Los artefactos se retienen 30 dias y no se versionan en git.

Comprobacion local:

```bash
pnpm db:backup
BACKUP_FILE=backups/<archivo>.dump pnpm db:restore:test
```

`STAGING_DATABASE_URL` debe apuntar a una base descartable porque el restore usa `--clean --if-exists`.

## Health checks recomendados

- Supabase.
- Redis.
- Workers.
- Queue depth.
- Webhooks.
- Email provider.

Implementado:

- Publico: `GET /api/health`.
- Profundo autenticado: `GET /api/health/deep`.
- CI/CD post-deploy: `pnpm health:post-deploy`.

## Despliegue y rollback

`.github/workflows/deploy.yml` define:

- Preview deployments para PR/manual con `vercel build` + `vercel deploy --prebuilt`.
- Production deployments desde `main` con `vercel build --prod` + `vercel deploy --prebuilt --prod`.
- Healthcheck post-deploy con alertas.
- Scan temprano de logs de error.
- Rollback manual por `workflow_dispatch` usando `vercel rollback`.

Secretos requeridos:

```env
VERCEL_TOKEN=
VERCEL_ORG_ID=
VERCEL_PROJECT_ID=
MONITORING_SECRET=
ALERT_WEBHOOK_URL=
```

Runbook completo: [INFRASTRUCTURE.md](INFRASTRUCTURE.md).
- Cron last run.
