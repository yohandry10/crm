# CODEX.md

Actualizado: 2026-05-06.

Este archivo es la bitacora de continuidad para futuras sesiones de Codex. Debe mantenerse corto, factual y actualizado cuando cambien arquitectura, seguridad, pruebas, despliegue o contrato de producto.

## Contexto del producto

CRM SaaS multi-tenant para venta B2B.

Contrato de negocio actual:

- El superadmin/platform admin vende accesos y provisiona organizaciones.
- Cada organizacion es un tenant.
- Usuarios regulares solo operan dentro de organizaciones donde tienen membership activa.
- No hay creacion self-service de organizaciones desde signup/login/bootstrap.
- `/api/organizations POST` esta bloqueado para usuarios regulares.
- Creacion/administracion de tenants vive en rutas de plataforma como `/api/admin/organizations`.
- Roles de tenant: `owner`, `admin`, `manager`, `member`, `viewer`.
- Platform admin no equivale a owner/admin de tenant; son fronteras distintas.

## Proveedores y decisiones externas

- Base: Supabase proyecto CRM, region us-west-2.
- Hosting: Vercel proyecto `trivia1/crm`.
- Billing activo: `manual`.
- Stripe no se usa.
- Culqi/PagoEfectivo quedan como destino de pasarela cuando existan credenciales reales.
- No usar proveedores externos de automatizacion fuera de los workflows internos del CRM.
- IA configurada por variables Gemini; no introducir flujos nuevos dependientes de OpenAI.
- No documentar secretos ni credenciales en archivos del repo.

## Estado local verificado

Ultima validacion registrada: 2026-05-06.

- `pnpm typecheck`: OK.
- `pnpm lint`: OK; solo aviso externo de `baseline-browser-mapping`.
- `pnpm test -- --reporter=basic`: 220 passed, 4 skipped.
- `pnpm production:check`: 0 failures, 0 warnings.
- `pnpm production:verify-db`: 0 failures, 335 checks.
- Seguridad produccion: headers/CSP, CSRF/content-type y uploads endurecidos; preflight cubre `security:headers`, `security:csrf` y `security:uploads`.
- Backups/restore: scripts `pnpm db:backup` y `pnpm db:restore:test` agregados; workflow diario de backup + restore staging versionado.
- Backup local probado con `PG_DUMP_BIN=C:\Program Files\PostgreSQL\17\bin\pg_dump.exe`; dump generado con manifest SHA-256.
- `pnpm test:coverage -- --reporter=basic`: ultima corrida previa 207 passed, 4 skipped; coverage gate activo con statements 5, branches 27, functions 13, lines 5.
- E2E focal RBAC/admin/local: 28 passed para frontera platform admin y endpoint `/api/admin/audit-logs`; corrida previa ampliada 39 passed.
- E2E focal error handling/modulos/local: 29 passed.
- E2E critico local `tests/e2e/critical-regression.spec.ts`: 4 passed para login/registro, pagos, workflow usuario-admin y regresiones edge.
- Auditoria visual de modulos incompletos: se eliminaron inputs fake de credenciales en admin settings, se alineo el detector de cambios de settings con medios de pago/notificaciones, se agrego guardado visible de notificaciones, se reemplazaron alerts nativos de workflows por toasts y se bloqueo guardar workflows visuales con acciones sin parametros validos.
- Guardrail unitario `tests/unit/visual-completeness.test.ts`: cubre credenciales no persistidas, campos editables de settings, alerts nativos y `SelectItem` vacio.
- Infraestructura real de despliegue/observabilidad agregada: workflow `deploy.yml` para preview/production/rollback, plantillas `.env.example`, `.env.preview.example`, `.env.production.example`, endpoint autenticado `/api/health/deep`, script `pnpm health:post-deploy`, Vercel Web Analytics y Speed Insights montados.
- `pnpm production:check` valida tambien CI/CD, health profundo, alertas post-deploy, env templates y observabilidad RUM.
- E2E focal RBAC/admin/remoto contra produccion: 39 passed.
- E2E focal ampliado seguridad/RBAC/multi-tenant/provisionamiento/flujos previo: 51 passed.
- `pnpm build`: OK.
- Produccion Vercel `https://crm-trivia1.vercel.app`: deployment `dpl_DK5eZk75XsaxDZJUA7DgvmiYDa3j` Ready, health database/auth/redis healthy.
- E2E remoto contra produccion: 51 passed.
- Browser local `http://localhost:3000/dashboard`: carga autenticada sin trial gate y sin errores de consola observados.
- Health local `/api/health`: database/auth/redis healthy.
- Code-vs-DB scan: 0 tablas faltantes y 0 RPC faltantes.

## Cambios importantes ya hechos

- Se corrigio el bloqueo indebido de trial para platform admin.
- Se reforzo login, forgot-password, reset/cambio de password, redirect interno y rate limit.
- Se separo platform admin de usuarios de tenant.
- Se centralizaron permisos con `lib/role-permissions.ts`.
- `lib/role-permissions.ts` ahora valida permisos por recurso y propiedad del registro para cerrar escalamiento horizontal.
- Se agregaron pruebas E2E para usuario diario, UI avanzada, matriz de roles, guards de mutacion, admin smoke, auth security, multi-tenant, tenant provisioning y regresion critica.
- Se corrigio el cache de `getAuthenticatedContext`: `x-organization-id` ya no puede contaminar la organizacion por defecto de usuarios multi-tenant.
- Header `x-organization-id` ahora exige membership activa y devuelve 403 si es forjado.
- Login, OAuth callback y `/api/auth/bootstrap` ya no crean tenants automaticamente.
- `/api/organizations POST` devuelve 403 para usuarios regulares.
- Se agrego `tests/e2e/multi-tenant-isolation.spec.ts`.
- Se agrego `tests/e2e/tenant-provisioning.spec.ts`.
- Se agrego `tests/e2e/critical-regression.spec.ts`.
- Se agrego `tests/unit/visual-completeness.test.ts` para evitar regresiones de UI incompleta o falsa en configuracion/admin/workflows.
- Configuracion de plataforma ya no muestra inputs editables para claves de Culqi/PagoEfectivo/Resend si no existe persistencia segura; muestra estado gestionado por variables de entorno.
- Configuracion de organizacion ahora detecta cambios en medios de pago y notificaciones, y notificaciones tiene accion de guardado visible.
- Workflow builder valida trigger, accion conectada y parametros requeridos antes de persistir `definition/actions/trigger_type`; no guarda nodos visualmente incompletos.
- `.github/workflows/deploy.yml` separa validacion, preview deployment, production deployment y rollback manual con Vercel CLI pinneado.
- `/api/health/deep` requiere `MONITORING_SECRET` o `CRON_SECRET` y reporta DB, Redis, colas, memoria, CPU, region, entorno, commit y uptime sin exponer secretos.
- `scripts/post-deploy-healthcheck.ts` valida `/api/health` y `/api/health/deep`, y puede avisar por `ALERT_WEBHOOK_URL`.
- `docs/INFRASTRUCTURE.md` documenta CI/CD, variables por entorno, healthchecks, alertas, logs centralizados y rollback.
- Se agrego `supabase/migrations/112_tenant_provisioning_and_schema_alignment.sql`.
- La migracion 112 crea `user_settings` con RLS, revoca inserts directos en `organizations` para `anon/authenticated` y amplia `verify_production_readiness()`.
- Migraciones 094-117 estan aplicadas/registradas en la base Supabase objetivo usada para validacion.
- Migracion 113 agrega cobertura RBAC de `accounts`, `activities`, `orders`, `pipeline_stages` y `lead_sources`.
- Se corrigio `emitEvent()` para escribir `organization_id` como columna top-level en `webhook_events`; la politica RLS 111 ya no bloquea eventos internos autenticados con payload multi-tenant valido.
- Se agrego auditoria/trazabilidad centralizada: login exitoso/fallido/bloqueado, logout, pagos, exportaciones, edicion/borrado de productos y cuentas, y consulta admin de auditoria.
- `lib/audit.ts` captura IP, user-agent, dispositivo aproximado, request id, usuario, organizacion, categoria, severidad, exito/fallo y metadata redactada.
- `/api/admin/audit-logs` permite a platform admin consultar logs con filtros por categoria, severidad, exito, usuario, organizacion, accion, request id y rango temporal.
- Migracion 114 agrega columnas/indexes de trazabilidad a `auditoria` y restringe lectura por RLS a platform admin, admins/owners del tenant y logs propios globales.
- Migracion 115 corrige cascadas peligrosas de historial de negocio y agrega `verify_data_integrity()` para FK huérfanas, duplicados, cascadas y consistencia multi-tenant.
- Migracion 116 agrega indices de performance para listados por tenant, busquedas trigrama y membership activa; tambien agrega `get_dashboard_metrics()` y `verify_performance_indexes()`.
- Migracion 117 alinea `integrations` y `webhooks` con la matriz RBAC centralizada en `role_permissions`; owner/admin gestionan, manager/viewer leen y member no accede.
- `/api/dashboard` usa RPC agregada en Postgres para metricas/pipeline/actividad; ya no trae listas completas para agregarlas en Node.
- Se agrego pipeline de backups automaticos: `.github/workflows/database-backup-restore.yml` ejecuta `pg_dump` diario, sube artefacto con retencion 30 dias y prueba restore completo/parcial en staging.
- Se agregaron scripts `scripts/db-backup.ts` y `scripts/db-restore-test.ts`; el restore test exige `verify_production_readiness`, `verify_security_hardening` y `verify_data_integrity` sin fallos.
- Se endurecio la superficie HTTP: CSP con `base-uri`, `object-src`, `form-action` y `upgrade-insecure-requests`; headers HSTS, content-type, referrer, permissions policy, COOP y CORP.
- `/api/upload` queda autenticado, rate-limited, protegido por validacion de `multipart/form-data`, sin SVG publico, con validacion de magic bytes, extension derivada de MIME y path scoped por usuario/tenant.
- Se agrego `lib/upload-security.ts` y `tests/unit/upload-security.test.ts` para bloquear path traversal, extensiones falsas, firmas invalidas y acceso fuera del prefijo permitido.
- Se agrego manejo global de errores frontend/backend: `ErrorBoundary` montado en layout, `app/error.tsx`, `global-error.tsx`, listeners de `window.error/unhandledrejection`, reporter `/api/client-errors` protegido por CSRF/rate limit y `instrumentation.onRequestError` para excepciones request-level.
- SWR ahora devuelve mensajes amigables y conserva reporte de errores del cliente sin tumbar la UI.
- Se elimino documentacion desactualizada de analisis previo y se actualizo el indice documental.
- Se corrigio `tests/e2e/global-setup.ts` para normalizar cuentas E2E antes de generar storage states; evita tokens invalidos despues de actualizar password/metadata.
- Se corrigio `tests/e2e/global-setup.ts` para marcar el tour de bienvenida como visto en storage state E2E; evita falsos bloqueos de modales al validar seguridad/perfil en produccion.
- Se corrigio el catalogo de productos para ordenar por `created_at desc` y mostrar inmediatamente el producto creado con la respuesta de `/api/products`.
- Ultimo despliegue manual de produccion: `dpl_DK5eZk75XsaxDZJUA7DgvmiYDa3j`, alias `https://crm-trivia1.vercel.app` y `https://crm-iota-inky.vercel.app`, aplicado el 2026-05-06.

## Seguridad y base de datos

- RLS verificado en tablas sensibles.
- `organizations_decrypted` queda solo para `service_role`, sin `SELECT` para `authenticated`.
- RPC sensibles no son ejecutables por `anon` ni `public`.
- Funciones `SECURITY DEFINER` verificadas tienen `search_path`.
- `organizations` no acepta inserts directos de `anon/authenticated`.
- `user_settings` existe y tiene RLS de propietario.
- `webhook_events` no acepta inserts anonimos; usuarios autenticados solo emiten eventos dentro de su organizacion y `emitEvent()` persiste `organization_id` explicitamente.
- `auditoria` almacena trazas operativas con metadata sensible redactada y columnas queryables para soporte/debugging (`event_category`, `severity`, `success`, `request_id`, `ip_address`, `user_agent`).
- Service role debe usarse solo despues de autorizacion de aplicacion verificable.

## Documentos fuente

- Estado: `docs/PROJECT_STATUS.md`.
- Checklist go-live: `docs/GO_LIVE_CHECKLIST.md`.
- Pruebas: `docs/TESTING.md`.
- Seguridad/datos: `docs/SECURITY_AND_DATA.md`.
- Mapa de modulos: `docs/MODULE_MAP.md`.
- Auditoria producto: `docs/PRODUCT_READINESS_AUDIT.md`.
- Indice documental: `docs/README.md`.

## Comandos recomendados antes de cerrar cambios

```bash
pnpm typecheck
pnpm lint
pnpm test -- --reporter=basic
pnpm production:check
pnpm production:verify-db
HEALTHCHECK_BASE_URL=https://crm-trivia1.vercel.app pnpm health:post-deploy
pnpm db:backup
BACKUP_FILE=backups/<archivo>.dump pnpm db:restore:test
pnpm test:e2e -- tests/e2e/role-matrix.spec.ts tests/e2e/role-mutation-guards.spec.ts tests/e2e/admin-authorization.spec.ts --reporter=line
pnpm test:e2e -- tests/e2e/critical-regression.spec.ts --reporter=line
pnpm test:e2e -- tests/e2e/tenant-provisioning.spec.ts tests/e2e/multi-tenant-isolation.spec.ts tests/e2e/admin-authorization.spec.ts tests/e2e/role-matrix.spec.ts tests/e2e/role-mutation-guards.spec.ts tests/e2e/crm-flows.spec.ts tests/e2e/daily-user-journey.spec.ts tests/e2e/daily-advanced-ui.spec.ts tests/e2e/auth-security.spec.ts --reporter=line
pnpm build
```

## Pendientes reales

Produccion remota quedo desplegada y validada manualmente el 2026-05-06. Pendientes no cerrados:

- Ejecutar CI/pipeline remoto con la misma matriz como compuerta automatica.
- Confirmar Supabase Auth Site URL y Redirect URLs del dominio final desde el dashboard.
- Configurar en GitHub Actions `BACKUP_DATABASE_URL` y `STAGING_DATABASE_URL`, y confirmar primera corrida remota del workflow `Database backup and restore test`.
- Restore test real queda pendiente hasta disponer de `STAGING_DATABASE_URL`; Docker local no estaba disponible en esta maquina para crear staging descartable.
- Configurar worker persistente si se promete workflow near-real-time.
- Probar Culqi/PagoEfectivo cuando existan credenciales reales.
- Subir coverage por modulo critico y activar umbrales gradualmente.
- Conectar mas mutaciones CRUD al logger central cuando se profundice cada modulo, manteniendo redaccion de secretos.
- Decidir limpieza de tabla legacy `events` y nombres canonicos `/sales`/`pipeline`/`opportunities`, `/inventory`/`products`, `/api/activity`/`activities`.

## Reglas para futuras sesiones

- No reactivar Stripe, proveedores externos de automatizacion ni creacion self-service de tenants.
- No escribir secretos en docs, tests o logs.
- La rotacion de secretos se hace en proveedor/Vercel/GitHub Actions; no persistir valores reales en repo ni en bitacora.
- No revertir cambios locales no propios.
- Si se toca auth, roles, tenant, RLS, pagos o service role, ejecutar los comandos de validacion recomendados.
- Mantener este archivo actualizado cuando cambie el estado real del proyecto.
