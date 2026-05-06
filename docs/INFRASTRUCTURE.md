# Infraestructura de despliegue y observabilidad

Actualizado: 2026-05-06.

## CI/CD

Workflows versionados:

- `.github/workflows/ci.yml`: lint, typecheck, tests, coverage, audit productivo, preflight, build y smoke E2E remoto cuando existen secretos `TEST_*`.
- `.github/workflows/deploy.yml`: despliegue Preview para PR/manual, despliegue Production desde `main`, healthcheck post-deploy, scan temprano de logs y rollback manual.
- `.github/workflows/database-backup-restore.yml`: backup diario y restore test contra staging.

Secretos GitHub Actions requeridos para despliegue:

```env
VERCEL_TOKEN=
VERCEL_ORG_ID=
VERCEL_PROJECT_ID=
MONITORING_SECRET=
ALERT_WEBHOOK_URL=
```

Secretos E2E opcionales:

```env
TEST_USER_EMAIL=
TEST_USER_PASSWORD=
TEST_ADMIN_EMAIL=
TEST_ADMIN_PASSWORD=
```

## Variables por entorno

Plantillas versionadas:

- `.env.example`: local/desarrollo.
- `.env.preview.example`: preview.
- `.env.production.example`: producción.

Regla operativa: los valores reales viven en Vercel/GitHub Actions o `.env.local`; no se versionan.

Comandos Vercel recomendados:

```bash
vercel env pull .env.local --environment=development --yes
vercel env pull .env.preview.local --environment=preview --yes
vercel env pull .env.production.local --environment=production --yes
```

## Healthchecks

Endpoints:

- `GET /api/health`: público, no expone detalles sensibles, útil para uptime checks.
- `GET /api/health/deep`: autenticado con `Authorization: Bearer <MONITORING_SECRET>` o `x-monitoring-secret`; valida DB, Redis, colas y runtime.

Script post-deploy:

```bash
HEALTHCHECK_BASE_URL=https://crm-trivia1.vercel.app \
MONITORING_SECRET=... \
pnpm health:post-deploy
```

El script puede enviar alertas si se configura:

```env
ALERT_WEBHOOK_URL=https://...
```

## Monitoreo

Se cubre en tres capas:

- Frontend real-user monitoring: Vercel Web Analytics y Speed Insights montados en `app/layout.tsx`.
- Backend/runtime: logs JSON estructurados en `lib/logger.ts`, `instrumentation.ts` para errores request-level y OpenTelemetry opcional.
- Infra: `/api/health/deep` reporta latencia DB/Redis/colas, memoria RSS/heap, CPU acumulada, región, entorno, commit y uptime.

Variables de observabilidad:

```env
OTEL_ENABLED=false
OTEL_SERVICE_NAME=crm-ai-peru
OTEL_EXPORTER_OTLP_ENDPOINT=
HONEYCOMB_API_KEY=
HONEYCOMB_DATASET=crm-production
LOG_LEVEL=info
MONITORING_SECRET=
ALERT_WEBHOOK_URL=
```

Para logs centralizados fuera de Vercel, configurar Vercel Log Drains o una integración como Datadog/Honeycomb/Sentry desde el dashboard del proveedor. El repo ya emite logs estructurados y trazas OTEL opcionales para que el drain tenga payload útil.

## Rollback

Rollback manual desde GitHub Actions:

1. Abrir workflow `Deploy`.
2. Ejecutar `workflow_dispatch`.
3. Completar `rollback_deployment` con URL o id del deployment sano.
4. El job ejecuta `vercel rollback <deployment> --yes`.

Rollback CLI:

```bash
vercel rollback <deployment-url-or-id>
```

Despues del rollback:

```bash
HEALTHCHECK_BASE_URL=https://crm-trivia1.vercel.app pnpm health:post-deploy
vercel logs https://crm-trivia1.vercel.app --level error --since 1h
```

## Comp puerta de producción

Antes de promover:

```bash
pnpm typecheck
pnpm exec vitest run tests/unit/visual-completeness.test.ts tests/api/contracts.test.ts --reporter=basic
pnpm production:check
pnpm production:verify-db
pnpm build
```

`pnpm production:check` ahora falla si faltan los artefactos de CI/CD, health profundo, alertas post-deploy, plantillas env o montaje de Analytics/Speed Insights.
