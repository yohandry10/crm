# Documentacion

Esta carpeta es la fuente documental activa del proyecto. La limpieza elimina auditorias historicas contradictorias y documentos con afirmaciones no verificadas. Si un documento no aparece aqui, debe tratarse como historico y recuperarse desde git si hace falta.

## Lectura recomendada

1. [PROJECT_STATUS.md](PROJECT_STATUS.md) - Estado real y verificaciones recientes.
2. [MODULE_MAP.md](MODULE_MAP.md) - Modulos UI/API y dominios.
3. [ANALISIS-MODULOS-Y-MEJORAS.md](ANALISIS-MODULOS-Y-MEJORAS.md) - Plan por fases e inconsistencias.
4. [SECURITY_AND_DATA.md](SECURITY_AND_DATA.md) - Riesgos de RLS, migraciones, tenant isolation, pagos y cifrado.
5. [TESTING.md](TESTING.md) - Comandos y huecos de cobertura.
6. [OPERATIONS.md](OPERATIONS.md) - Workers, cron, Redis, observabilidad y despliegue operativo.
7. [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - Variables requeridas y opcionales.
8. [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md) - Checklist antes de vender o publicar.
9. [BACKUP_RESTORE.md](BACKUP_RESTORE.md) - Backup y restore.
10. [CLOUDFLARE_WORKER_CRON.md](CLOUDFLARE_WORKER_CRON.md) - Scheduler externo para cron/workflows.

Verificacion adicional: `pnpm production:check` para entorno/config y `pnpm production:verify-db` para la base objetivo. La version SQL manual vive en `supabase/verification/production-readiness.sql`.

## Reglas para mantener docs

- No afirmar "production ready" si `GO_LIVE_CHECKLIST.md` tiene bloqueadores abiertos.
- No documentar scripts que no existan en `package.json`.
- No documentar archivos SQL fuera de `supabase/migrations/`.
- No duplicar auditorias historicas en `docs/`; usar git history para historial.
- Todo claim de performance, cobertura o seguridad debe indicar comando, archivo o evidencia.
- Si una decision cambia codigo y operacion, actualizar tambien `PROJECT_STATUS.md`.
