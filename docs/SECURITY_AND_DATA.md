# Seguridad y datos

Actualizado: 2026-05-06.

Este documento resume el estado actual de seguridad, datos y aislamiento tenant despues de la auditoria de produccion local. Ya no lista migraciones 095-115 como pendientes: fueron aplicadas/registradas en la base Supabase objetivo y verificadas con `pnpm production:verify-db` y `pnpm production:check`.

## Estado verificado

- `pnpm production:verify-db`: 0 failures, 318 checks.
- `pnpm production:check`: 0 failures, 0 warnings.
- E2E focal RBAC/admin local: 39 passed.
- E2E focal RBAC/admin remoto contra produccion: 39 passed.
- E2E focal seguridad/RBAC/multi-tenant/provisionamiento y flujos diarios/API previo: 51 passed.
- Code-vs-DB scan: 0 tablas faltantes y 0 RPC faltantes para el codigo actual.
- Migrations objetivo requeridas por preflight: 094-115.
- RLS verificado en tablas sensibles usadas por el CRM.
- Roles de organizacion vigentes: `owner`, `admin`, `manager`, `member`, `viewer`.

## Contrato multi-tenant

El negocio es SaaS B2B:

- El superadmin/platform admin vende y provisiona organizaciones.
- Cada organizacion es un tenant.
- Usuarios regulares operan solo dentro de organizaciones donde tienen membership activa.
- Signup, login, OAuth callback y bootstrap no crean organizaciones automaticamente.
- `/api/organizations POST` esta bloqueado para usuarios regulares; la creacion de tenants queda en rutas de plataforma como `/api/admin/organizations`.
- `x-organization-id` solo puede seleccionar organizaciones donde el usuario es miembro activo.
- Una solicitud con `x-organization-id` ya no contamina el cache de organizacion por defecto del usuario multi-tenant.

## Secretos descifrados

`organizations_decrypted` fue endurecida:

- La migracion 095 revoca `SELECT` para `PUBLIC` y `authenticated`.
- La vista queda solo para `service_role`.
- La verificacion de produccion confirma que clientes autenticados no dependen de esa vista.
- Integrations devuelve configuracion redactada y no expone `config_encrypted`.

Regla vigente:

- Nuevas lecturas de secretos descifrados deben exponerse solo mediante RPC/ruta server-side minima, con validacion explicita de tenant, rol y columnas estrictas.
- No se deben loggear secretos ni credenciales.

## SECURITY DEFINER y RPC

Las migraciones 095, 097, 098, 099, 100, 101, 109, 110, 111, 112, 113, 114 y 115 endurecen funciones sensibles, grants, vistas, triggers, verificacion de produccion, cobertura RBAC, auditoria centralizada e integridad de datos.

## Integridad de datos

Estado actual:

- Migracion 115 aplicada/registrada en la base objetivo.
- `verify_data_integrity()` esta integrada en `pnpm production:verify-db`.
- No hay FKs huérfanas en las relaciones publicas auditadas.
- No hay duplicados en claves de negocio auditadas: membresias activas, emails de contacto por tenant, RUC de cuentas, SKU de productos, numeros de factura/cotizacion, slugs de formularios, posiciones de etapas y transacciones de pago.
- No hay referencias cruzadas entre tenants en contactos, cuentas, oportunidades, etapas, cotizaciones, facturas, items, pagos, tareas, tickets, calendario, pedidos, tokens publicos, campanas e inventario.
- Cascadas peligrosas corregidas: actividades, interacciones, tareas, ejecuciones de workflow y movimientos de inventario preservan historial con `SET NULL`; oportunidades bloquean borrado de contacto con `RESTRICT`.

Regla vigente:

- Nuevas FKs entre entidades de negocio no deben usar `ON DELETE CASCADE` salvo que el registro hijo sea claramente detalle efimero o pertenezca al borrado completo de tenant.

Estado actual:

- RPC sensibles de cifrado, credenciales, pagos atomicos, inventario y reconciliacion no son ejecutables por `anon` ni `public`.
- Funciones `SECURITY DEFINER` publicas verificadas tienen `search_path` definido.
- Funciones expuestas a clientes deben validar `auth.uid()`, membership y tenant internamente.
- Las rutas que necesitan service role usan `createSupabaseServiceClient` despues de autorizacion de aplicacion.

Reglas para nuevas funciones:

- Fijar `search_path`.
- Revocar `EXECUTE FROM PUBLIC` por defecto.
- Conceder a `authenticated` solo si la funcion valida tenant y rol por dentro.
- No confiar en `organization_id` recibido desde body cuando la accion es autenticada.

## Pagos e ingresos

Stripe no se usa en el producto activo. El billing esta configurado como `manual`; Culqi/PagoEfectivo quedan pendientes de credenciales reales.

Estado actual:

- Rutas activas de Stripe eliminadas.
- Artefactos legacy de Stripe removidos por migracion.
- `POST /api/payments` usa `record_payment_atomic` para validar membership, bloquear factura con `FOR UPDATE`, verificar saldo, aplicar idempotencia e insertar pago en una transaccion.
- Existe indice unico parcial para `(organization_id, gateway, transaction_id)` cuando `transaction_id IS NOT NULL`.
- `payments.idempotency_key` existe en la base objetivo.
- La aprobacion manual bloquea sobrepago con saldo observado.
- Payment links se crean por RPC `generate_payment_token`, validando membership, tenant del recurso y exactamente un recurso.
- Tokens publicos fueron endurecidos para impedir insercion/borrado directo desde clientes autenticados.

Pendiente externo:

- Conectar credenciales reales de Culqi/PagoEfectivo y ejecutar smoke de pasarela real cuando existan.

## Endpoints publicos

Estado actual:

- Public forms requiere allowlist CORS en produccion y falla cerrado si no existe.
- Public forms valida campos enviados contra la definicion del formulario.
- Booking publico usa RPC `book_public_calendar_slot`, lock transaccional por owner/dia y revalidacion de overlaps.
- Public pay valida formato de token, body de comprobante y CORS.
- En produccion, comprobantes publicos exigen URL HTTPS.
- Webhooks salientes usan validacion SSRF compartida: protocolo HTTP(S), bloqueo localhost/metadata, IPs privadas/reservadas y DNS que resuelve a rangos internos.

Riesgo residual aceptado/documentado:

- Webhooks salientes podrian requerir allowlist por tenant/dominio si se vende a clientes con politica mas estricta que bloqueo SSRF general.
- Public forms puede necesitar antispam/rate limit mas fuerte cuando haya trafico real.

## Service role y plataforma

Estado actual:

- Rutas de plataforma usan `requirePlatformAdmin`.
- Usuarios de organizacion, incluso `owner/admin`, no pueden entrar ni mutar APIs `/api/admin`.
- Webhooks/cron/service role validan secretos o autorizacion antes de usar privilegios elevados.
- `webhook_events` no acepta inserts anonimos; usuarios autenticados solo insertan eventos dentro de su organizacion.
- `emitEvent()` escribe `organization_id` como columna top-level, no solo dentro del payload, para cumplir RLS.
- `organizations` no acepta inserts directos de `anon/authenticated`.
- `user_settings` existe con RLS de usuario propietario.

## Auditoria y trazabilidad

Estado actual:

- Migracion 114 aplicada/registrada en la base objetivo.
- `auditoria` tiene columnas queryables para soporte/debugging: `event_category`, `severity`, `success`, `request_id`, `ip_address` y `user_agent`.
- Los logs centralizados guardan usuario, organizacion, timestamp, IP, user-agent, dispositivo aproximado, request id, accion, tabla/recurso, categoria, severidad, exito/fallo y metadata redactada.
- Acciones criticas conectadas: login exitoso/fallido/bloqueado, logout, pagos, exportaciones, edicion/borrado de productos y cuentas, y consulta admin del visor de auditoria.
- `/api/admin/audit-logs` esta protegido por `requirePlatformAdmin` y permite filtrar por categoria, severidad, exito, usuario, organizacion, accion, request id y rango temporal.
- RLS de `auditoria` permite lectura a platform admin, `owner/admin` del tenant correspondiente y logs propios globales cuando no hay organizacion.

Reglas vigentes:

- No persistir secretos en `datos_anteriores`, `datos_nuevos` ni `metadata`; el logger central redacta claves sensibles.
- Nuevas acciones de borrado, exportacion, pago, cambio de permisos o acceso a datos sensibles deben usar `logAuditEvent`.
- Los errores de auditoria son best-effort y no deben romper la operacion principal, pero deben quedar visibles en logs de servidor.

## RBAC y escalamiento horizontal

Estado actual:

- `role_permissions` cubre modulos core y recursos adicionales: `accounts`, `activities`, `orders`, `pipeline_stages` y `lead_sources`.
- Rutas mutables verifican permiso por recurso antes de escribir.
- Registros existentes aplican chequeo de propiedad cuando el rol no tiene `can_manage_all`.
- `owner/admin` gestionan registros de la organizacion segun matriz; `manager/member/viewer` quedan limitados por recurso y propiedad.
- E2E valida denegacion de mutaciones por rol y escalamiento horizontal en contactos, oportunidades, cotizaciones, tareas y productos.

Regla vigente:

- El service role solo debe aparecer despues de una autorizacion de aplicacion verificable, nunca como sustituto de RLS en rutas de usuario.

## Cifrado y logging

Estado actual:

- App: `lib/encryption.ts`.
- DB: `pgcrypto` en migraciones historicas.
- Logging de cuerpos con secretos fue reducido/sanitizado en rutas auditadas.
- La auditoria centralizada redacta passwords, secrets, tokens, API keys, credenciales, autorizaciones e idempotency keys antes de escribir en DB.
- Errores frontend se reportan a `/api/client-errors` con CSRF, rate limit, schema estricto y truncado de campos largos.
- Excepciones no capturadas de requests se registran como JSON estructurado desde `instrumentation.onRequestError`.
- `withApiErrorHandling` centraliza respuesta JSON sanitizada y `errorId` para nuevas Route Handlers.

Reglas vigentes:

- Redactar secretos, tokens, passwords, comprobantes y config sensible.
- No loggear bodies completos por defecto.
- Nuevas integraciones deben definir claramente si cifran en app o DB y documentar rollback/migracion.

## Riesgos pendientes reales

Estos puntos no bloquean el estado local verificado, pero si bloquean afirmar produccion remota completamente cerrada:

- Ejecutar CI/pipeline remoto con la misma suite.
- Confirmar Supabase Auth Site URL y Redirect URLs del dominio final.
- Configurar worker persistente si se promete workflow near-real-time.
- Activar umbrales de coverage gradualmente en modulos criticos.
- Probar pasarela real cuando existan credenciales de Culqi/PagoEfectivo.

## Checks recomendados al tocar seguridad

Ejecutar, como minimo:

```bash
pnpm typecheck
pnpm lint
pnpm test -- --reporter=basic
pnpm production:check
pnpm production:verify-db
pnpm test:e2e -- tests/e2e/role-matrix.spec.ts tests/e2e/role-mutation-guards.spec.ts tests/e2e/admin-authorization.spec.ts --reporter=line
pnpm test:e2e -- tests/e2e/tenant-provisioning.spec.ts tests/e2e/multi-tenant-isolation.spec.ts tests/e2e/admin-authorization.spec.ts tests/e2e/role-matrix.spec.ts tests/e2e/role-mutation-guards.spec.ts --reporter=line
pnpm build
```
