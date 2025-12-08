# E2E Tests (Playwright)

## Prerrequisitos
- Node 20+
- pnpm
- Variables de entorno para entorno de pruebas:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - TEST_USER_EMAIL / TEST_USER_PASSWORD (credenciales de prueba)

## Ejecutar
```bash
pnpm dlx playwright install
pnpm test:e2e
```

## Escenarios cubiertos
- Login con credenciales válidas (flujo Supabase con email/password).
- Acceso a dashboard tras login.
- CRUD básico de cuentas (crear y ver en listado).
