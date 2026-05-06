# E2E Tests (Playwright)

## Ejecutar

```bash
pnpm exec playwright install chromium
$env:TEST_USER_EMAIL="admin@example.com"
$env:TEST_USER_PASSWORD="..."
$env:TEST_ADMIN_EMAIL="superadmin@example.com"
$env:TEST_ADMIN_PASSWORD="..."
pnpm test:e2e
```

Por defecto usa `http://localhost:3000` y arranca/reutiliza `pnpm dev`.
Para apuntar a otro entorno:

```bash
$env:PLAYWRIGHT_BASE_URL="https://crm-trivia1.vercel.app"
pnpm test:e2e
```

## Cobertura actual

Ultima validacion completa registrada: 2026-05-06.

Resultado observado:

```text
pnpm test:e2e -- tests/e2e/tenant-provisioning.spec.ts tests/e2e/multi-tenant-isolation.spec.ts tests/e2e/admin-authorization.spec.ts tests/e2e/role-matrix.spec.ts tests/e2e/role-mutation-guards.spec.ts tests/e2e/crm-flows.spec.ts tests/e2e/daily-user-journey.spec.ts tests/e2e/daily-advanced-ui.spec.ts tests/e2e/auth-security.spec.ts --reporter=line
51 passed
```

- Login autenticado por API con storage state separado para usuario real y superadmin.
- Usuario real con organización activa sin bloqueo de trial.
- Superadmin limitado a pruebas de administración sin bloqueo de trial.
- Carga de módulos principales de usuario sin redirect, 404 ni errores de consola.
- Bloqueo de rutas admin para usuario no platform-admin.
- Smoke GET autenticado de APIs principales.
- Flujo CRM real: cuenta -> contacto -> producto -> inventario -> oportunidad -> tarea -> ticket -> cotización -> reglas de cierre/estado -> cleanup.
- Flujo diario de usuario real: cuenta, contacto, lead, producto, inventario, tarea, ticket, formulario y webhook.
- Matriz de roles de organización: owner, admin, manager, member y viewer.
- Permisos por rol en contacts, opportunities, products, quotes, invoices, tickets, campaigns, workflows y calendar events.
- `global-setup.ts` normaliza cuentas E2E antes de generar storage states, para evitar tokens invalidos cuando se actualizan contrasenas/metadata.

## Notas

- No documentar passwords aqui. Usar variables de entorno locales.
- `global-setup.ts` provisiona usuarios de rol `e2e.owner.crm@example.com`, `e2e.admin.crm@example.com`, `e2e.manager.crm@example.com`, `e2e.member.crm@example.com` y `e2e.viewer.crm@example.com`.
