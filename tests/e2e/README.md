# E2E Tests (Playwright)

## Ejecutar

```bash
pnpm exec playwright install chromium
$env:TEST_USER_EMAIL="admin@example.com"
$env:TEST_USER_PASSWORD="..."
pnpm test:e2e
```

Por defecto usa `http://localhost:3000` y arranca/reutiliza `pnpm dev`.
Para apuntar a otro entorno:

```bash
$env:PLAYWRIGHT_BASE_URL="https://crm-trivia1.vercel.app"
pnpm test:e2e
```

## Cobertura

- Login autenticado por API y storage state compartido.
- Superadmin sin bloqueo de trial.
- Carga de módulos principales sin redirect, 404 ni errores de consola.
- Smoke GET autenticado de APIs principales.
- Flujo CRM real: cuenta -> contacto -> producto -> inventario -> oportunidad -> tarea -> ticket -> cotización -> reglas de cierre/estado -> cleanup.
