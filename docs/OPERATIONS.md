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

## Health checks recomendados

- Supabase.
- Redis.
- Workers.
- Queue depth.
- Webhooks.
- Email provider.
- Cron last run.
