# Go-live checklist

Este checklist define bloqueadores antes de vender o publicar como produccion.

## Bloqueadores globales

- [x] `pnpm typecheck` pasa.
- [x] `pnpm exec vitest run` pasa.
- [x] `pnpm test:coverage` funciona y reporta cobertura real.
- [x] `pnpm build` pasa.
- [x] Coverage tiene compuerta minima activa en CI (`statements 5`, `branches 27`, `functions 13`, `lines 5`) y reporte `json-summary`; subir umbrales por modulo critico queda como mejora incremental.
- [x] Warnings de dependencias server-only revisados; BullMQ externalizado y Supabase SSR Edge warning filtrado.
- [x] `pnpm lint` no incluye carpetas generadas como `.next-build` o `coverage`.
- [x] `pnpm production:check` pasa localmente con 0 failures en `BILLING_PROVIDER=manual`.
- [x] Produccion Vercel desplegada y health remoto healthy en `https://crm-trivia1.vercel.app/api/health`.
- [ ] `pnpm production:check` ejecutado en CI/proveedor con variables reales de produccion.
- [x] Backup diario automatizado versionado en GitHub Actions con `pnpm db:backup`.
- [x] Restore test de staging automatizado con `pnpm db:restore:test`.
- [x] Restore test valida recuperacion total con readiness/security/integrity RPCs y recuperacion parcial con probe transaccional.
- [ ] Secretos GitHub Actions `BACKUP_DATABASE_URL` y `STAGING_DATABASE_URL` configurados en el repositorio remoto.
- [ ] Primera corrida remota del workflow `Database backup and restore test` confirmada en GitHub Actions.
- [x] `pnpm production:verify-db` ejecutado contra Supabase objetivo con 0 failures.
- [x] Headers seguros y CSP configurados y verificados por `production:check`.
- [x] CSRF/origin/content-type verificados por preflight de seguridad.
- [x] Rate limiting requerido en rutas criticas y Redis obligatorio en produccion.
- [x] Uploads endurecidos: sin SVG publico, magic bytes, path scoped y tipos/tamanos permitidos.
- [x] Runbook de rotacion de secretos/env vars documentado sin exponer valores reales.
- [ ] Supabase Auth tiene Site URL y Redirect URLs correctas.
- [x] Platform admin no depende de superadmin hardcodeado en codigo.
- [x] Operaciones con service role en onboarding/admin/team/subscriptions validan body/filtros antes de escribir.
- [x] RLS habilitado y probado en tablas sensibles via `pnpm production:verify-db`.
- [x] RPC `verify_production_readiness` ejecutada en la base objetivo con todos los checks `pass=true`.
- [x] Migracion 095 endurece el primer bloque de funciones `SECURITY DEFINER` sensibles.
- [x] Migracion 095 aplicada y verificada en la base objetivo.
- [x] Migracion 097 endurece RPCs expuestas `SECURITY DEFINER` y funciones server-only.
- [x] Migracion 097 aplicada y verificada en la base objetivo.
- [x] Migracion 098 crea booking publico atomico con lock transaccional por owner/dia.
- [x] Migracion 098 aplicada y verificada en la base objetivo.
- [x] Migracion 099 endurece permisos y constraint de `public_payment_tokens`.
- [x] Migracion 099 aplicada y verificada en la base objetivo.
- [x] Migracion 100 alinea contratos revenue-inventory y endurece la RPC atomica de facturas.
- [x] Migracion 100 aplicada y verificada en la base objetivo.
- [x] Migracion 101 agrega RPC read-only para verificacion automatizable de produccion.
- [x] Migracion 101 aplicada y `production:verify-db` ejecutado en la base objetivo.
- [x] Migraciones 102-103 aplicadas y verificadas en la base objetivo.
- [x] Produccion usa `BILLING_PROVIDER=manual`; Culqi/PagoEfectivo quedan desactivados hasta tener credenciales reales.
- [x] Checkout manual no activa planes automaticamente; registra solicitud pendiente para confirmacion admin.
- [x] Migracion 095 revoca `organizations_decrypted` para `authenticated`.
- [x] Confirmar que ningun cliente `authenticated` depende de `organizations_decrypted` mediante verificador y suite actual.
- [x] Migracion de pagos agrega idempotencia respaldada por indice unico parcial.
- [x] Base objetivo acepta el indice unico parcial de pagos y valida migraciones 094-116.
- [x] Migracion 105 aplicada: webhooks no dependen de secreto legacy plaintext obligatorio.
- [x] Migracion 106 aplicada: facturas aceptan items libres sin `product_id`.
- [x] Migracion 107 aplicada: permisos explicitos para pagos.
- [x] Migracion 108 aplicada: columna de idempotencia de pagos.
- [x] Migraciones 109-111 aplicadas: hardening de grants, vistas, funciones trigger y `webhook_events`.
- [x] Migracion 112 aplicada: `user_settings`, bloqueo de autoprovicionamiento de tenants y verificador DB ampliado.
- [x] Migracion 113 aplicada: cobertura RBAC para accounts, activities, orders, pipeline stages y lead sources.
- [x] Migracion 114 aplicada: auditoria centralizada con categorias, severidad, exito/fallo, request id e indices de soporte.
- [x] Migracion 115 aplicada: verificacion de integridad de datos y cascadas seguras para historial de negocio.
- [x] Migracion 116 aplicada: indices de performance y dashboard agregado por RPC.
- [x] Dashboard pesado optimizado: metricas/pipeline/actividad se agregan en Postgres, no en runtime Node.
- [x] `production:verify-db` valida indices/RPC de performance con `verify_performance_indexes()`.
- [x] Cruce codigo-BD validado: 0 tablas faltantes y 0 RPC faltantes.
- [x] Integridad DB validada: 0 FKs huérfanas, 0 duplicados auditados, 0 cascadas peligrosas y 0 cruces multi-tenant.
- [x] Performance DB validada: indices criticos presentes y dashboard RPC disponible.
- [x] Rutas activas de Stripe eliminadas; pagos operan por Culqi/PagoEfectivo, gateway manual o payment links.
- [x] Migracion 096 aplicada y verificada en la base objetivo.
- [x] Pagos manuales son idempotentes y transaccionales via RPC.
- [x] Pagos filtran sumas y actualizaciones auxiliares por `organization_id`.
- [x] Cron jobs definidos en `vercel.json` con perfil diario compatible con Vercel Hobby.
- [x] Drainer acotado de workflows configurado por cron (`WORKFLOW_PROCESSING_MODE=cron-drainer`).
- [ ] Worker persistente configurado si workflows se venden como near-real-time (`WORKFLOW_PROCESSING_MODE=worker`).
- [x] Endpoints `/api/cron/*` validan `CRON_SECRET` con helper central y fallan cerrado si falta.
- [x] Politica Redis decidida y documentada: Redis obligatorio y `RATE_LIMIT_FAIL_OPEN=false`.
- [x] Endpoints publicos tienen rate limit, CORS y validacion estricta en todos los flujos.
- [x] Public forms y booking fallan cerrado en CORS de produccion si no hay allowlist.
- [x] Public forms valida campos enviados contra la definicion del formulario.
- [x] Forms privados validan schema y assignee del tenant antes de escribir.
- [x] Public forms no devuelve CORS wildcard en errores despues de validar origen.
- [x] Public pay valida token, comprobante y CORS de produccion antes de usar service role.
- [x] Form submissions por id verifican ownership del formulario antes de listar.
- [x] Tasks/tickets validan referencias y assignees del tenant antes de escribir.
- [x] Inbox valida ownership de conversaciones antes de leer/escribir mensajes.
- [x] Notificaciones se filtran por organizacion activa.
- [x] Logs de errores sanitizan cuerpos sensibles en rutas auditadas.
- [x] Manejo global de errores frontend/backend: boundaries globales, reporter de navegador, `/api/client-errors`, captura request-level y mensajes amigables.
- [x] Logs de acciones criticas centralizados en `auditoria`: auth, pagos, exportaciones, edicion/borrado y consultas admin con IP, dispositivo, usuario, organizacion, timestamp y request id.
- [x] Webhooks internos pasan CSRF correctamente y el secreto legacy ya no bloquea creacion.
- [x] Webhooks con service role no aceptan `organization_id` libre desde el body en flujos auditados; usan contexto autenticado o recurso publico validado.
- [x] Integrations no devuelve configuracion descifrada ni `config_encrypted`.
- [x] `emitEvent()` persiste `organization_id` top-level para cumplir RLS de `webhook_events`.
- [x] `/api/upload` valida autenticacion, rate limit, MIME, magic bytes y ownership del path antes de listar/subir/borrar.

## Modulos criticos

### Auth / onboarding / admin

- [x] Login de usuario regular probado por E2E.
- [x] Signup, reset y OAuth callback auditados; auth bootstrap ya no crea tenants automaticamente.
- [x] Usuario regular no puede crear organizaciones por `/api/organizations POST`.
- [x] Platform admin validado por E2E sin trial gate.
- [x] Usuario regular no puede entrar a `/admin`.
- [x] Invitaciones y miembros de organizacion probados por matriz de roles para permisos de invite.
- [x] Escalamiento horizontal por API probado: roles sin `can_manage_all` no gestionan registros ajenos.
- [x] Platform admin puede consultar `/api/admin/audit-logs`; roles tenant no pueden acceder a esa API.

### CRM core

- [x] Contacts/leads/accounts renderizan y participan en flujo diario E2E.
- [x] Contacts valida permisos de creacion por rol.
- [x] Products ordena por creacion reciente y refleja inmediatamente el producto creado para que no quede oculto fuera de la primera pagina.
- [x] `PATCH /api/opportunities/[id]` valida campos permitidos y etapas/contactos por organizacion.
- [x] Pipeline/opportunities tiene etapas por organizacion en todos los flujos de creacion, edicion y bulk update.
- [x] Opportunities valida permisos de creacion por rol y referencias de contacto/etapa.
- [ ] Conversion lead -> contact/opportunity preserva tenant.

### Revenue

- [x] Quotes e invoices crean registros en flujo E2E y matriz de roles.
- [x] Facturas aceptan items libres sin producto y calculan totales via RPC.
- [x] Quotes validan contacto, oportunidad y productos por organizacion antes de insertar items.
- [x] Facturas creadas por RPC validan tenant/contacto/productos antes de descontar stock.
- [x] Sales orders tienen `order_number`, `items`, estado `completed` y validacion de referencias alineados con API/UI.
- [ ] PDFs no exponen datos de otra organizacion.
- [x] Payment links se generan via RPC con validacion de tenant/recurso.
- [x] Payment links validados contra la base objetivo despues de aplicar migracion 099.
- [x] Public pay valida formato de token antes de resolver documentos.
- [x] Pagos activos excluyen Stripe y aceptan gateways locales configurados.

### Public forms / booking

- [ ] Origen permitido configurado.
- [ ] Rate limit y antispam activos.
- [x] Booking valida horario contra reglas de agenda.
- [x] Booking evita doble reserva bajo concurrencia a nivel de RPC/migracion.
- [x] `/calendar` y booking publico usan `calendar_events` como fuente comun.
- [x] Eventos manuales validan rango de fechas y referencias de tenant.
- [x] Calendar events valida permisos de creacion por rol.
- [x] Booking validado contra la base objetivo despues de aplicar migracion 098 via `production:verify-db`.
- [ ] Campaigns conectado a segmentacion/envio real antes de venderlo como modulo operativo.
- [x] Campaigns valida permisos de creacion por rol.

### Workflows

- [x] Drainer de workflow configurado en cron diario con limites de tiempo/jobs.
- [ ] Worker persistente operativo si se requiere procesamiento near-real-time.
- [x] Acciones principales con service role filtran por organizacion.
- [x] Webhook actions tienen proteccion SSRF compartida antes de `fetch`.
- [x] Workflows valida permisos de creacion por rol.
- [ ] Decidir si webhooks salientes requieren allowlist por dominio/tenant.

### Tasks / tickets / inbox

- [x] Tasks validan contacto, workflow y assignee contra la organizacion.
- [x] Tickets validan cuenta, contacto y assignee contra la organizacion.
- [x] Tasks y tickets validan permisos de creacion por rol.
- [x] Bulk updates de tasks/tickets usan allowlist estricta.
- [x] Tickets UI/search/export usan `title`, no columnas legacy.
- [x] Inbox valida conversacion por organizacion antes de listar/enviar mensajes.
- [x] Tickets tiene flujo UI completo de crear/ver/editar/eliminar.
- [x] Notificaciones globales tienen read-state por usuario o decision explicita: la API expone solo notificaciones de sistema por usuario hasta tener tabla puente.

### Reports / analytics

- [x] Report builder valida entidades, metricas, agrupaciones, filtros y date ranges con contrato compartido.
- [x] Saved/export reports validan configuracion y payload antes de guardar/exportar.
- [x] Analytics advanced no devuelve datos ficticios.
- [ ] Analytics advanced conectado a metricas reales antes de venderlo.
- [ ] Errores de columnas invalidas cubiertos con tests runtime, no solo contratos estaticos.

## Smoke test manual

Automatizado parcialmente por E2E al 2026-05-06:

- [x] Crear contacto/cuenta/lead/producto/tarea/ticket/formulario/webhook como usuario real.
- [x] Crear oportunidad/cotizacion/factura/campana/workflow/evento de calendario por matriz de roles cuando el rol lo permite.
- [x] Ver dashboard/reportes/modulos principales sin redirect, 404 ni trial gate.
- [x] Validar platform admin.
- [x] Signup real ya no crea organizacion automaticamente; la organizacion se crea desde plataforma/admin y el usuario entra por invitacion/membresia.
- [x] E2E focal RBAC/admin local: 39 passed para admin boundary, role matrix y mutation guards.
- [x] E2E focal RBAC/admin remoto contra produccion: 39 passed.
- [x] E2E focal ampliado local previo: 51 passed para auth security, admin boundary, multi-tenant, tenant provisioning, role matrix, mutation guards, flujo CRM API, flujo diario UI y UI avanzada.
- [x] E2E focal ampliado remoto contra produccion Vercel: 51 passed.
- [ ] Convertir lead desde UI y mover etapa por drag/drop.
- [ ] Registrar pago manual desde UI.
- [ ] Enviar formulario publico completo.
- [ ] Crear booking publico completo.
- [ ] Ejecutar workflow simple end-to-end con worker/cron.
