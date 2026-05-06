# Documentacion

Esta carpeta es la fuente documental activa del proyecto. La limpieza elimina auditorias historicas contradictorias y documentos con afirmaciones no verificadas. Si un documento no aparece aqui, debe tratarse como historico y recuperarse desde git si hace falta.

## Lectura recomendada

1. [PROJECT_STATUS.md](PROJECT_STATUS.md) - Estado real y verificaciones recientes.
2. [TESTING.md](TESTING.md) - Comandos, resultados actuales, E2E y matriz de roles.
3. [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md) - Checklist antes de vender o publicar.
4. [MODULE_MAP.md](MODULE_MAP.md) - Modulos UI/API y dominios.
5. [PRODUCT_READINESS_AUDIT.md](PRODUCT_READINESS_AUDIT.md) - Auditoria de producto vendible y posicionamiento.
6. [SECURITY_AND_DATA.md](SECURITY_AND_DATA.md) - Estado de RLS, migraciones, tenant isolation, pagos y cifrado.
7. [OPERATIONS.md](OPERATIONS.md) - Workers, cron, Redis, observabilidad y despliegue operativo.
8. [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - Variables requeridas y opcionales.
9. [BACKUP_RESTORE.md](BACKUP_RESTORE.md) - Backup y restore.
10. [CLOUDFLARE_WORKER_CRON.md](CLOUDFLARE_WORKER_CRON.md) - Scheduler externo para cron/workflows.

Para continuidad entre sesiones, leer primero [`../CODEX.md`](../CODEX.md). Ese archivo resume el contrato SaaS, decisiones que no deben revertirse, estado verificado y proximos pasos.

## Estado rapido 2026-05-06

- Typecheck, unit/contracts, lint, production preflight, DB verify, E2E focal y build pasan localmente.
- Produccion Vercel `https://crm-trivia1.vercel.app` esta Ready; `/api/health` responde database/auth/redis healthy.
- Unit/contracts: 207 passed, 4 skipped.
- E2E focal seguridad/RBAC/multi-tenant/provisionamiento y flujos diarios/API: 51 passed local y 51 passed remoto contra produccion.
- Production DB verify: 0 failures, 109 checks.
- Roles probados: owner, admin, manager, member, viewer.
- Supabase objetivo tiene aplicadas y registradas las migraciones 094-112.
- La base esta alineada con el codigo: 0 tablas faltantes y 0 RPC faltantes en el cruce codigo-BD del 2026-05-06.
- El contrato SaaS vigente es: superadmin/platform admin provisiona organizaciones; usuarios regulares solo operan dentro de tenants con membresia activa.
- Localhost validado en `http://localhost:3000` con `/api/health` healthy.
- Pendiente operativo: CI con la misma matriz, Supabase Auth URLs finales, worker persistente si se vende near-real-time, y elevar coverage por modulo.

Verificacion adicional: `pnpm production:check` para entorno/config y `pnpm production:verify-db` para la base objetivo. La version SQL manual vive en `supabase/verification/production-readiness.sql`.

## Reglas para mantener docs

- No afirmar "production ready" si `GO_LIVE_CHECKLIST.md` tiene bloqueadores abiertos.
- No documentar scripts que no existan en `package.json`.
- No documentar archivos SQL fuera de `supabase/migrations/`.
- No duplicar auditorias historicas en `docs/`; usar git history para historial.
- Todo claim de performance, cobertura o seguridad debe indicar comando, archivo o evidencia.
- Si una decision cambia codigo y operacion, actualizar tambien `PROJECT_STATUS.md`.
