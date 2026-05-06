# Testing

## Comandos reales

```bash
pnpm exec vitest run
pnpm typecheck
pnpm lint
pnpm production:check
pnpm production:verify-db
pnpm test:e2e
pnpm test:coverage
```

`pnpm test` ejecuta Vitest una vez. Para desarrollo interactivo usar `pnpm test:watch`.

## Estado observado

Ultima ejecucion manual local registrada: 2026-05-05.

Validacion reciente:

- Unit/integration: 193 passed, 4 skipped.
- Typecheck: OK.
- Lint: OK con 73 warnings.
- Production preflight: OK con 0 failures y 0 warnings locales en `BILLING_PROVIDER=manual`.
- Production DB verify: OK contra Supabase objetivo con 0 failures y 75 checks.
- Coverage: OK como comando; cobertura global observada: statements/lines 4.99%, branches 26.78%, functions 13.5%.

## Estado de coverage

`pnpm test:coverage` usa `@vitest/coverage-v8` alineado con `vitest@1.6.x`.

Decision actual:

- CI puede generar reporte de cobertura.
- No hay umbrales globales obligatorios hasta subir una base por modulo.
- El objetivo sigue siendo llevar los modulos criticos a umbrales verificables antes de go-live.

## Huecos importantes

- Solo hay una suite API dedicada fuerte para contacts.
- Hay muchos `app/api/**/route.ts` sin tests directos.
- Los contratos estaticos cubren booking atomico, calendario canonico sobre `calendar_events`, forms privados, public pay, payment links, submissions, campaigns, SSRF de webhooks salientes, revenue-inventory, tasks/tickets, inbox/notificaciones y reportes/analytics, pero faltan pruebas runtime/concurrencia contra DB.
- `middleware*.ts`, `instrumentation.ts` y `scripts/**` estan excluidos de coverage.
- E2E actual cubre poco frente a la superficie funcional.
- La verificacion DB de produccion (`pnpm production:verify-db`) aun debe ejecutarse contra la base objetivo despues de aplicar migraciones.

Prioridad de nuevos tests:

1. Payments con Culqi/PagoEfectivo, confirmacion manual y payment links.
2. Facturas/orders con stock y productos de varios tenants.
3. Public forms y booking.
4. Admin/platform admin.
5. Cron y workers.
6. Tasks/tickets/inbox con permisos por rol y UI.
7. Workflows.
8. Middleware, CORS, CSRF y rate limit.
9. Tenant isolation.

## Pruebas manuales

Estas pruebas no sustituyen Vitest/Playwright. Son utilidades locales para validar integraciones puntuales:

```bash
node scripts/manual/test-rate-limit.js
```

Para CORS, abrir manualmente:

```text
scripts/manual/test-cors.html
```
