# CRM AI Peru

CRM/ERP para PYMES peruanas construido con Next.js, React, TypeScript y Supabase.

Este README es la entrada corta del proyecto. La documentacion activa vive en [docs/README.md](docs/README.md).

## Estado real

Actualizado: 2026-05-05.

El proyecto compila a nivel de tipos, las pruebas unitarias/integracion actuales pasan, Supabase objetivo valida con `pnpm production:verify-db` y el preflight de produccion pasa en modo de facturacion manual. Culqi/PagoEfectivo queda preparado para activarse cuando existan credenciales reales.

Ultima ejecucion manual local registrada durante esta revision: 2026-05-05.

```bash
pnpm exec vitest run --reporter=basic
pnpm typecheck
pnpm lint
pnpm production:check
pnpm production:verify-db
pnpm test:coverage
pnpm build
```

Resultado:

- `pnpm exec vitest run --reporter=basic`: 193 tests pasan, 4 skipped.
- `pnpm typecheck`: pasa.
- `pnpm lint`: pasa con 73 warnings.
- `pnpm production:check`: pasa con 0 failures y 0 warnings locales en `BILLING_PROVIDER=manual`.
- `pnpm production:verify-db`: pasa contra Supabase objetivo con 0 failures y 75 checks.
- `pnpm test:coverage`: pasa y genera reporte real; cobertura global observada: statements/lines 4.99%, branches 26.78%, functions 13.5%.
- `pnpm build`: pasa; BullMQ queda externalizado del bundle Next y los warnings de dependencias server-only estan filtrados.

## Stack

- Next.js 15.5.9
- React 19
- TypeScript strict
- Supabase Auth/Postgres/RLS
- Redis + BullMQ para colas/workers
- Vitest y Playwright
- Tailwind CSS y componentes UI locales

## Instalacion local

```bash
pnpm install
# Crear .env.local usando docs/ENVIRONMENT_VARIABLES.md como referencia
pnpm docker:up
pnpm dev
```

En otra terminal, si vas a probar colas:

```bash
pnpm worker
```

## Base de datos

Las migraciones reales estan en:

```text
supabase/migrations/
```

Se deben aplicar en orden lexicografico de archivo. No usar referencias antiguas como `supabase/01-schema.sql`; esos archivos no existen.

## Scripts utiles

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm production:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:coverage
pnpm worker
pnpm worker:dev
pnpm docker:up
pnpm docker:down
```

## Documentacion activa

- [Indice documental](docs/README.md)
- [Estado del proyecto](docs/PROJECT_STATUS.md)
- [Mapa de modulos](docs/MODULE_MAP.md)
- [Analisis y plan de mejoras](docs/ANALISIS-MODULOS-Y-MEJORAS.md)
- [Seguridad y datos](docs/SECURITY_AND_DATA.md)
- [Testing](docs/TESTING.md)
- [Operacion](docs/OPERATIONS.md)
- [Variables de entorno](docs/ENVIRONMENT_VARIABLES.md)
- [Backup y restore](docs/BACKUP_RESTORE.md)
- [Cron externo Cloudflare](docs/CLOUDFLARE_WORKER_CRON.md)
- [Go-live checklist](docs/GO_LIVE_CHECKLIST.md)
