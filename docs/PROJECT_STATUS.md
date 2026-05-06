# Estado del proyecto

Actualizado: 2026-05-05.

## Resumen

El proyecto tiene una base funcional amplia, pero la documentacion anterior mezclaba estados historicos, claims no verificados y referencias a archivos inexistentes. Este archivo reemplaza esos veredictos dispersos.

Estado actual:

- La app tiene modulos CRM, ventas, pagos, marketing, calendario, workflows, integraciones, admin y settings.
- TypeScript pasa.
- Tests actuales pasan y coverage genera reporte, pero la cobertura global es baja.
- Hay un preflight de produccion que falla cerrado ante variables/cron/Redis/CORS/migraciones faltantes.
- La base objetivo valida con `pnpm production:verify-db` despues de aplicar migraciones 094-103.
- Workflows/BullMQ ya tienen cron drainer acotado; near-real-time requiere worker persistente externo.

## Validacion ejecutada

Ultima ejecucion manual local registrada: 2026-05-05.

```bash
pnpm exec vitest run --reporter=basic
pnpm typecheck
pnpm lint
pnpm production:check
pnpm production:verify-db
pnpm test:coverage
pnpm build
```

Resultado observado:

- Tests: 193 passed, 4 skipped.
- Typecheck: OK.
- Lint: OK con 73 warnings.
- Production preflight: OK con 0 failures y 0 warnings locales en `BILLING_PROVIDER=manual`.
- Production DB verify: OK contra Supabase objetivo con 0 failures y 75 checks.
- Coverage: genera reporte real; baseline global observado: statements/lines 4.99%, branches 26.78%, functions 13.5%. No tiene umbrales globales obligatorios mientras se sube la base por modulo.
- Build: OK. BullMQ queda externalizado del bundle Next; los warnings de dependencias server-only quedan filtrados en `next.config.mjs`.

## Claims revocados

Estos claims no deben repetirse hasta corregirlos:

- "Production ready" como estado global.
- "Test coverage 70%+" como verificado.
- "Todas las APIs estan bajo `/api/v1`".
- "Redis fail closed en produccion" como comportamiento real.
- "Bull Board completo" si la ruta sigue siendo placeholder/informativa.
- Metrica de performance sin comando reproducible.

## Bloqueadores principales

P0:

- Continuar la revision de `SECURITY DEFINER` en funciones historicas de bajo riesgo o no expuestas como RPC.
- Configurar credenciales reales de Culqi/PagoEfectivo antes de cambiar `BILLING_PROVIDER` a `culqi`, `pagoefectivo` o `culqi_pagoefectivo`.
- Subir coverage por modulo critico y activar umbrales cuando exista una base defendible.
- Configurar worker persistente si workflows se venden como near-real-time.
- Marcar plan Vercel compatible (`VERCEL_PLAN=pro` o `enterprise`) o configurar scheduler externo para los crons frecuentes.

P1:

- Normalizar dominios duplicados pendientes: pipeline/sales/opportunities, inventory/products. Calendar ya usa `calendar_events` como contrato canonico, con `/api/events` legacy.
- Cubrir contratos corregidos con tests por modulo critico; ya hay tests para `statusUrl`, metadata de `/api/v1/version`, oportunidades, cron, integraciones, workflow lead updates, hardening de RPCs expuestas, validacion previa a service role, booking atomico, calendario, forms, campaigns, public pay, payment links, submissions, SSRF en webhooks salientes, contratos revenue-inventory, tasks/tickets, inbox/notificaciones y reportes/analytics.
- Unificar auth/tenant helpers.
- Regenerar tipos Supabase.
- Reducir logs de cuerpos sensibles.
- Resolver warnings de lint antes de endurecer CI.

P2:

- Limpiar warnings de lint.
- Completar pruebas E2E por modulo critico.
- Medir y documentar performance real.

## Fuente de verdad

- Codigo y config: repo actual.
- DB: `supabase/migrations/`.
- Comandos: `package.json`.
- Estado: este archivo y `GO_LIVE_CHECKLIST.md`.
