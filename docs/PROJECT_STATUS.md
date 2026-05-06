# Estado del proyecto

Actualizado: 2026-05-06.

## Resumen ejecutivo

El CRM quedo desplegado y verificable en produccion: build de produccion OK, Supabase objetivo verificado, health remoto OK y E2E focal pasando contra Vercel con usuario real, superadmin, aislamiento multi-tenant y matriz de roles de organizacion.

Estado actual:

- Multi-tenant operativo por organizacion activa, con RLS verificado en tablas sensibles por `pnpm production:verify-db`.
- Roles de organizacion probados: `owner`, `admin`, `manager`, `member`, `viewer`.
- Platform admin separado del usuario regular y sin bloqueo de trial.
- Usuario regular con organizacion activa sin bloqueo de trial.
- Modulos principales renderizan sin redirect a login, sin 404 y sin trial gate inesperado.
- APIs principales autenticadas responden correctamente.
- Permisos de lectura/escritura reforzados en rutas criticas mediante `role_permissions`.
- Auditoria RBAC ampliada: APIs de negocio y configuracion revisadas contra permisos reales por rol y propiedad del registro.
- Auditoria operativa centralizada agregada para soporte/debugging: auth, pagos, exportaciones, ediciones, borrados y consultas admin quedan trazados con IP, user-agent, dispositivo, usuario, organizacion, timestamp, request id, categoria, severidad y exito/fallo.
- Manejo global de errores agregado para evitar pantallas rotas: boundaries de Next/React, reporter global de errores del navegador, endpoint `/api/client-errors`, mensajes SWR amigables y captura backend con `instrumentation.onRequestError`.
- Integridad de base validada con `verify_data_integrity()`: 0 FKs huérfanas, 0 duplicados de claves de negocio auditadas, 0 cruces multi-tenant y 0 cascadas peligrosas.
- Auditoria de seguridad de BD reforzada: privilegios peligrosos revocados, RPC sensibles cerradas a anon/public y verificador de hardening activo.
- Billing configurado como `manual`; no se usa Stripe. Culqi/PagoEfectivo quedan condicionados a credenciales reales.
- No hay proveedor externo de automatizaciones activo fuera de los workflows internos del CRM.
- IA configurada para Gemini por variables de entorno.
- Redis requerido y health local OK.
- Workflows corren con drainer acotado por cron; near-real-time requiere worker persistente externo.
- Auditoria de producto vendible documentada en `docs/PRODUCT_READINESS_AUDIT.md`.
- Se corrigieron riesgos de calidad de producto/produccion: politica de contrasena duplicada en Settings, logging de cuerpos con posibles secretos, Origin check para mutaciones autenticadas sin token CSRF y mutaciones admin en memoria bloqueadas en produccion sin opt-in.
- La logica de cotizaciones quedo separada en pasos vendibles: enviada/aceptada/facturada/pagada. Aceptar ya no crea factura ni descuenta stock; convertir a factura hace esa operacion explicita.
- Tareas desempata por `created_at` para que el trabajo recien creado sea visible en la primera pagina del modulo diario.
- La frontera platform admin quedo auditada: usuarios de organizacion, incluso `owner/admin`, no pueden entrar ni mutar APIs de superadmin.
- La frontera tenant quedo revalidada como contrato de negocio: el superadmin vende organizaciones y cada organizacion aisla datos, permisos, cotizaciones y enlaces de pago.
- La base de datos quedo alineada con las tablas/RPC usadas por el codigo: se agrego `user_settings`, se amplio el verificador de produccion y se bloqueo la creacion self-service de organizaciones.

## Cambios recientes importantes

### Auth, trial y roles

- Se corrigio el bloqueo indebido por trial para platform admin.
- Se mantuvo la separacion entre platform admin y usuarios de organizacion.
- Se endurecio login con redirect interno obligatorio para evitar open redirects.
- Recuperacion de contraseña pasa por `/api/auth/forgot-password` con rate limit y respuesta generica anti-enumeracion.
- Cambio de contraseña desde perfil exige contraseña actual y usa `/api/auth/change-password`; ya no actualiza password directamente desde el cliente.
- Login mantiene rate limit por email/IP y regeneracion de sesion.
- Signup usa la misma politica fuerte de contrasenas que reset/perfil y muestra errores propios sin depender de validacion HTML nativa.
- Signup ya no escribe `profiles` directamente desde el cliente; usa bootstrap autenticado cuando hay sesion disponible.
- Auth callback sanitiza `redirect` con el mismo contrato que login para evitar redirecciones externas.
- Se provisionaron usuarios E2E por rol de organizacion en `tests/e2e/global-setup.ts`.
- La suite E2E genera storage states separados para usuario regular, superadmin y roles `owner/admin/manager/member/viewer`.

### Permisos por rol

- Se agrego `lib/role-permissions.ts` como helper central para consultar `role_permissions`.
- `lib/role-permissions.ts` ahora tambien expone validacion de propiedad para impedir escalamiento horizontal cuando el rol no tiene `can_manage_all`.
- Se reforzaron permisos en APIs de:
  - settings
  - integrations
  - webhooks
  - contacts
  - products
  - tasks
  - tickets
  - opportunities
  - quotes
  - invoices
  - campaigns
  - workflows
  - calendar events
- Se reforzaron tambien operaciones `PUT/PATCH/DELETE` de registros existentes para cerrar saltos por API directa.
- Se reforzaron rutas adicionales de `accounts`, `activities`, `orders`, `inventory`, `lead_sources` y `pipeline_stages` con permisos explicitos.
- Se agregaron checks de propietario en contactos, oportunidades, tareas, tickets, productos, campanas, cotizaciones, facturas, pedidos y cuentas cuando el rol solo puede gestionar registros propios.
- Se agregaron permisos explicitos para `payments`; `viewer/member` no pueden registrar pagos y `manager` puede registrar pagos manuales.
- Modulos sensibles quedan limitados a `owner/admin` cuando corresponde.
- `viewer` queda validado como rol de solo lectura en flujos diarios.
- Las APIs de plataforma usan el helper comun `requirePlatformAdmin`; se elimino autorizacion duplicada en `admin/plans`.
- El envio/reenvio de invitaciones de organizacion desde platform admin valida email, organizacion, token, pertenencia del token, expiracion y aceptacion previa.
- Se agrego `tests/e2e/admin-authorization.spec.ts` para probar que `user`, `owner`, `admin`, `manager`, `member` y `viewer` no puedan acceder a paginas `/admin` ni a lecturas/mutaciones de `/api/admin`.

### Aislamiento multi-tenant

- Se corrigio el cache de `getAuthenticatedContext`: una solicitud con header `x-organization-id` ya no puede contaminar la organizacion por defecto de un usuario multi-organizacion.
- Si un usuario envia `x-organization-id` de una organizacion donde no es miembro activo, la API responde 403.
- Login, OAuth callback y `/api/auth/bootstrap` ya no crean organizaciones automaticamente; solo garantizan perfil y membresia existente.
- `/api/organizations` mantiene lectura de organizaciones del usuario, pero `POST` queda bloqueado para usuarios regulares. La creacion de tenants queda en `/api/admin/organizations`.
- Se agrego `tests/e2e/multi-tenant-isolation.spec.ts` para probar aislamiento real con dos organizaciones independientes y un usuario multi-tenant.
- Se agrego `tests/e2e/tenant-provisioning.spec.ts` para probar que un usuario normal no pueda autoprovicionar organizaciones y que bootstrap no cree tenants fuera del flujo de plataforma.
- La prueba cubre lectura de contactos por tenant, intento de header forjado, acceso directo por ID cruzado, referencia cruzada en oportunidad, generacion de enlace de pago contra cotizacion de otro tenant y retorno correcto al tenant por defecto despues de cambiar con header.
- Las pruebas unitarias de multi-tenant quedaron alineadas con los roles reales: `owner`, `admin`, `manager`, `member`, `viewer`.

### Flujos diarios y modulos

- Se agrego `tests/e2e/daily-user-journey.spec.ts`.
- Se agrego `tests/e2e/role-matrix.spec.ts`.
- Se agrego `tests/e2e/daily-advanced-ui.spec.ts`.
- Se agrego `tests/e2e/role-mutation-guards.spec.ts`.
- El flujo diario cubre creacion real de cuenta, contacto, lead, producto, inventario, tarea, ticket, formulario y webhook.
- El flujo avanzado cubre UI real de oportunidades, cotizaciones, facturas, campanas, calendario y workflows.
- Onboarding acepta un alta mas amigable: RUC opcional, IGV ingresado como `18` se normaliza a `0.18`, roles de invitacion alineados con backend y seleccion robusta de organizacion activa.
- Calendario muestra primero eventos recien creados cuando comparten la misma hora, evitando que el evento nuevo quede oculto bajo `+ mas`.
- La matriz de roles prueba lectura de modulos y escritura/denegacion en contactos, oportunidades, productos, cotizaciones, facturas, tickets, campanas, workflows y calendario.
- Los guards de mutacion validan que `viewer/member/manager` no puedan saltarse permisos via API en contactos, productos, oportunidades, facturas, tareas, tickets, workflows y pagos.
- Se agrego smoke E2E para platform admin en `tests/e2e/admin-smoke.spec.ts`.
- Se agrego `/api/admin/audit-logs` para consulta filtrada de trazas por platform admin y se incluyo en smoke/authorization E2E.
- Se monto `ErrorBoundary` en el layout raiz y `GlobalErrorReporter` escucha `window.error` y `unhandledrejection`.
- `/api/client-errors` valida payload con Zod, exige CSRF/rate limit y registra errores frontend mediante `logError`.
- `withApiErrorHandling` queda disponible para nuevas Route Handlers con respuesta JSON sanitizada y `errorId`.

### Supabase y migraciones

- Migracion `105_webhook_secret_nullable.sql`: permite webhooks sin escribir secreto legacy plaintext.
- Migracion `106_fix_invoice_free_items.sql`: corrige la RPC `create_invoice_with_items_atomic` para facturas con items libres sin `product_id`.
- Migracion `107_add_payment_role_permissions.sql`: agrega permisos explicitos para operaciones de pagos.
- Migracion `108_ensure_payment_idempotency_column.sql`: asegura el contrato `payments.idempotency_key` usado por `record_payment_atomic`.
- Migracion `109_security_hardening_grants_and_rls_audit.sql`: revoca privilegios peligrosos (`TRUNCATE`, `REFERENCES`, `TRIGGER`) a roles anon/authenticated, cierra tablas internas y bloquea ejecucion anon/public de RPC sensibles.
- Migracion `110_security_hardening_views_and_trigger_functions.sql`: extiende el hardening a vistas publicas y funciones trigger-only de cifrado.
- Migracion `111_webhook_events_authenticated_insert_policy.sql`: restaura la emision de eventos internos para usuarios autenticados solo dentro de su organizacion, sin reabrir inserts anonimos.
- Migracion `112_tenant_provisioning_and_schema_alignment.sql`: agrega `user_settings` con RLS, revoca insert directo en `organizations` para `anon/authenticated`, amplia `verify_production_readiness()` a todas las tablas/RPC usadas por el codigo y agrega checks contra autoprovicionamiento de tenants.
- Migracion `113_rbac_resource_coverage.sql`: completa matriz `role_permissions` para `accounts`, `activities`, `orders`, `pipeline_stages` y `lead_sources`.
- Migracion `114_centralized_audit_tracing.sql`: agrega columnas/indexes de trazabilidad a `auditoria`, categorias/severidades controladas y RLS de lectura para platform admin, admins/owners del tenant y logs propios globales.
- Migracion `115_data_integrity_validation_and_safe_cascades.sql`: cambia cascadas peligrosas de historial de negocio a `SET NULL` o `RESTRICT` y agrega RPC de auditoria de integridad.
- Estas correcciones fueron aplicadas contra la base Supabase objetivo durante la validacion local y registradas en `schema_migrations`.
- `scripts/production-preflight.ts` ahora exige las migraciones 105-115.
- `scripts/production-db-verify.ts` ejecuta `verify_security_hardening()` y valida grants/RPC/search_path.

### Seguridad auditada en BD

- RLS esta habilitado en las tablas sensibles verificadas por `production:verify-db`.
- No quedan privilegios `TRUNCATE`, `REFERENCES` ni `TRIGGER` para `anon` o `authenticated` sobre tablas/vistas publicas.
- RPC sensibles como cifrado, credenciales, pagos atomicos, inventario y reconciliacion ya no son ejecutables por `anon` ni `public`.
- Las funciones `SECURITY DEFINER` publicas verificadas tienen `search_path` definido.
- `webhook_events` ya no acepta inserts anonimos; los eventos generados por modulos CRM requieren usuario autenticado con membresia activa en la organizacion.
- `emitEvent()` escribe `organization_id` como columna top-level en `webhook_events`, alineado con RLS y con el payload multi-tenant de los modulos.
- `organizations` ya no acepta inserts directos de `authenticated`; la creacion de tenants depende de funciones/rutas de plataforma con service role y auditoria.
- `user_settings` existe en la base objetivo y tiene RLS de usuario propietario.
- `auditoria` quedo preparada como tabla central de trazabilidad para acciones criticas; metadata sensible se redacta antes de persistir.
- `verify_data_integrity()` quedo integrada a `production:verify-db` para detectar huérfanos, duplicados, cascadas no permitidas y referencias cruzadas entre tenants.

### Bugs reales corregidos durante validacion

- Webhooks fallaban por columna legacy `secret` no nullable.
- CSRF interno bloqueaba endpoints de webhooks.
- Tareas enviaban `due_date` vacio en vez de `null`.
- Algunos catch blocks intentaban leer/clonar el body despues de consumirlo.
- Facturas fallaban con `record "v_product" is not assigned yet` al crear items libres.
- Facturas recien creadas no siempre aparecian en la primera pagina por ordenar solo por fecha de emision; ahora desempata por `created_at`.
- `viewer` podia obtener exito al borrar tareas por API por falta de guard de rol en `DELETE`.
- Pagos manuales fallaban porque la RPC esperaba `payments.idempotency_key` y la columna no existia en la base objetivo.
- Labels de campanas no estaban asociados a inputs, bloqueando pruebas y accesibilidad real.
- Admin APIs devolvian mapeos de error inconsistentes en algunas rutas.
- Aceptar una cotizacion creaba factura automaticamente pese a existir un flujo explicito de conversion; ahora solo valida stock y cambia estado.
- Tareas sin fecha de vencimiento podian ocultar la tarea recien creada fuera de la primera pagina por orden indefinido; ahora se ordenan de forma predecible.
- Productos recien creados podian quedar fuera de la primera pagina del catalogo cuando el tenant tenia volumen acumulado; ahora el catalogo ordena por `created_at desc` y refleja inmediatamente el registro devuelto por la API.
- Eventos internos `contact.created` y `payment.completed` quedaban bloqueados por RLS porque `webhook_events.organization_id` no se persistia fuera del payload; ahora se persiste explicitamente.

## Validacion ejecutada

Ultima ejecucion manual local registrada: 2026-05-06.

```bash
pnpm typecheck
pnpm test -- --reporter=basic
pnpm lint
pnpm production:check
pnpm production:verify-db
pnpm test:e2e -- --reporter=line
pnpm build
```

Resultado observado:

- Typecheck: OK.
- Unit/contracts: 211 passed, 4 skipped.
- Lint: OK; solo queda aviso externo de `baseline-browser-mapping`.
- Production preflight: 0 failures, 0 warnings.
- Production DB verify: 0 failures, 109 checks.
- Production DB verify con integridad de datos: 0 failures, 318 checks.
- Build: OK.
- Local health: `GET /api/health` devuelve 200 con database/auth/redis healthy.
- Coverage gate: OK con thresholds minimos activos (`statements 5`, `branches 27`, `functions 13`, `lines 5`).
- E2E focal RBAC/admin local: 28 passed para frontera platform admin y `/api/admin/audit-logs`; corrida previa ampliada 39 passed.
- E2E focal error handling/modulos local: 29 passed.
- E2E focal RBAC/admin remoto contra produccion: 39 passed.
- E2E focal seguridad/RBAC/multi-tenant/provisionamiento y flujos diarios/API previo: 51 passed.
- E2E focal cubre aislamiento tenant en contactos, oportunidades, payment links y cambio de organizacion por header.
- E2E focal cubre bloqueo de self-service tenant, bootstrap sin creacion de tenant, frontera platform admin negativa, matriz de roles y guards de mutacion.
- E2E auth security incluido en suite completa: 4 passed para redirect de login, forgot-password, rate limit y cambio de contraseña.
- Auditoria posterior de producto/codigo: dependencias productivas con 0 vulnerabilidades via `pnpm audit --prod --json`.

Ultima ejecucion remota de produccion registrada: 2026-05-06.

- Deployment Vercel: `dpl_kQF8Ftgm7d1n22ceUzUB8jdj1H4T`.
- URL production alias: `https://crm-trivia1.vercel.app`.
- `vercel inspect crm-trivia1.vercel.app`: Ready.
- `GET https://crm-trivia1.vercel.app/api/health`: database/auth/redis healthy.
- E2E remoto RBAC/admin contra produccion: 28 passed para frontera platform admin y `/api/admin/audit-logs`; corrida previa ampliada 39 passed.
- E2E remoto contra produccion previo: 51 passed.

## Estado operativo

- Dev server local fue levantado, validado y luego detenido para ejecutar build limpio.
- Endpoint de salud validado durante la prueba: `http://localhost:3000/api/health`.
- En la ultima validacion E2E se levanto servidor local explicito; `/api/health` respondio healthy antes de correr Playwright.
- Produccion Vercel esta desplegada y alias final responde healthy.
- Commit desplegado en la ultima tanda: `ad264ba`.

## Pendientes posteriores a produccion

Estos puntos no bloquean el despliegue validado, pero siguen siendo mejoras/operacion para venta:

- Ejecutar pipeline/CI con las mismas pruebas como compuerta automatica.
- Confirmar Supabase Auth Site URL y Redirect URLs contra dominio final.
- Configurar worker persistente si se promete workflow near-real-time.
- Subir coverage por modulo critico y activar umbrales gradualmente.

## Fuente de verdad

- Codigo y config: repo actual.
- DB: `supabase/migrations/`.
- Comandos: `package.json`.
- E2E: `tests/e2e/`.
- Go-live: `docs/GO_LIVE_CHECKLIST.md`.
- Testing: `docs/TESTING.md`.
