# Analisis de modulos y plan de mejoras

Este documento es el backlog documental y tecnico principal. Ordena el trabajo en fases para que las mejoras sigan una secuencia razonable: primero verdad documental, luego seguridad, luego pruebas, contratos y UX.

## Fase 0 - Orden documental

Objetivo: que `docs/` deje de mezclar historia, claims no verificados y fuentes duplicadas.

Acciones:

- Mantener solo documentos vivos.
- Borrar auditorias historicas contradictorias.
- Reemplazar `DOCUMENTACION.md` por documentos pequenos y verificables.
- Usar `PROJECT_STATUS.md` como estado actual.
- Usar `GO_LIVE_CHECKLIST.md` como criterio de venta/produccion.
- No usar claims como "production ready" sin evidencia.

Resultado esperado:

- Cualquier persona nueva puede leer `docs/README.md` y entender donde esta cada cosa.
- Los documentos no contradicen al codigo ni a `package.json`.

## Fase 1 - Seguridad y datos

Objetivo: cerrar riesgos que pueden cruzar tenants, duplicar pagos o exponer datos.

Acciones:

- Hecho: agregar migracion `095_security_definer_hardening.sql` para el primer bloque sensible de funciones `SECURITY DEFINER`.
- Hecho: revocar `EXECUTE` amplio y `SELECT` sobre `organizations_decrypted` para `authenticated` en la migracion 095.
- Hecho: agregar validacion interna de `auth.uid()`, membership/role y tenant en stock, quote stock, reconciliacion, tokens publicos y helpers de credenciales.
- Hecho: agregar migracion `097_security_definer_rpc_hardening.sql` para RPCs expuestas: tenant helpers, contactos, chat IA, suscripciones, limites de plan y logs de workflows.
- Hecho: restringir funciones de mantenimiento, public forms y webhooks historicos a `service_role`.
- Hecho: unificar validacion de `/api/cron/*` y fallar cerrado si falta `CRON_SECRET`.
- Hecho: validar con Zod los bodies que llegan a operaciones con service role en onboarding, admin organizations/users, team invitations y subscriptions.
- Hecho: reemplazar clientes service-role ad hoc por `createSupabaseServiceClient` en esos endpoints.
- Hecho: agregar migracion con indice unico parcial para pagos por `(organization_id, gateway, transaction_id)`.
- Hecho: agregar migracion `098_atomic_public_booking.sql` para crear reservas publicas por RPC transaccional con lock por owner/dia.
- Hecho: endurecer `/api/pay/[token]` con validacion de token/body, CORS fail-closed en produccion y comprobantes HTTPS en produccion.
- Hecho: agregar migracion `099_public_payment_tokens_hardening.sql` para impedir insercion/borrado directo de payment tokens desde clientes autenticados.
- Hecho: `POST /api/payment-links` crea tokens via RPC `generate_payment_token` en vez de insertar directo en la tabla.
- Hecho: agregar migracion `100_revenue_inventory_consistency.sql` para alinear `invoice_items.product_id/tax_rate`, `sales_orders.items/order_number` y la RPC atomica de facturas.
- Hecho: agregar `pnpm production:check` para bloquear despliegues con variables/Redis/CORS/cron/migraciones faltantes.
- Hecho: agregar `supabase/verification/production-readiness.sql` para validar migraciones, RLS y contratos criticos en la base objetivo.
- Hecho: agregar migracion `101_production_readiness_verification_rpc.sql` y `pnpm production:verify-db` para ejecutar esos checks desde CI/CD con service role.
- Convertir validaciones SQL de RLS en checks que fallen con `RAISE EXCEPTION`.
- Regenerar `lib/types/database.types.ts`.
- Revisar uso de `SUPABASE_SERVICE_ROLE_KEY` en workflows y endpoints publicos.

## Fase 2 - Calidad y pruebas

Objetivo: que los claims de calidad sean medibles.

Acciones:

- Hecho: alinear versiones de `vitest` y `@vitest/coverage-v8`.
- Hecho: hacer pasar `pnpm test:coverage`.
- Hecho: mantener coverage medible en CI sin umbrales globales hasta levantar una base por modulo.
- Hecho: usar como baseline inicial observado statements/lines 4.89%, branches 25.55%, functions 13.02%.
- Hecho: ajustar `eslint.config.mjs` para ignorar `.next-build/**` y `coverage/**`.
- Hecho: cambiar CI a comandos no interactivos: `pnpm exec vitest run`, `pnpm typecheck`, `pnpm lint`.
- Hecho: tests contractuales cubren fail-closed de cron, hardening 097, orden seguro de logs de workflows y validacion previa a service role.
- Hecho: tests contractuales cubren booking publico via RPC atomica y validacion/CORS de pago publico.
- Hecho: tests contractuales cubren creacion de payment links via RPC endurecida y ownership de form submissions.
- Hecho: tests unitarios/contractuales cubren proteccion SSRF compartida para webhooks salientes.
- Hecho: tests contractuales cubren validacion de referencias en quotes/orders y contrato SQL revenue-inventory.
- Agregar pruebas API para pagos, webhooks, cron, admin, workflows y public forms.
- Agregar pruebas de middleware y tenant isolation.
- Reducir skipped tests o documentar por que existen.

## Fase 3 - Contratos UI/API

Objetivo: que cada modulo tenga una API clara y contratos estables.

Acciones:

- Unificar `events` y `calendar_events`.
- Definir si `leads` es modulo propio o vista filtrada de `contacts`.
- Definir si `inventory` es modulo propio o tab de `products`.
- Alinear `sales`, `pipeline` y `opportunities`.
- Mantener `statusUrl` de workflows/jobs cubierto por test contractual.
- Decidir si `/api/v1/version` queda como metadata o si se implementan recursos versionados reales.
- Mantener OpenAPI alineado con rutas reales no versionadas y response wrappers actuales.
- Resolver placeholders: analytics advanced y Bull Board no deben venderse como funcionales hasta conectar datos reales.
- Separar APIs publicas y privadas para booking/forms/pay.

## Fase 4 - Modulos funcionales

Objetivo: revisar UX, estados, errores y comportamiento por dominio.

Orden sugerido:

1. Auth/onboarding/admin.
2. Contacts/leads/accounts/pipeline.
3. Quotes/invoices/payments/orders.
4. Products/inventory.
5. Forms/campaigns/calendar.
6. Tasks/tickets/inbox/notifications.
7. Workflows/integrations/AI.
8. Dashboard/analytics/reports.

Para cada modulo:

- Revisar rutas UI.
- Revisar endpoints usados.
- Revisar validacion backend.
- Revisar tenant filters.
- Revisar loading/empty/error states.
- Revisar permisos por rol.
- Agregar tests minimos.

### Revision por modulo

#### 1. Auth / onboarding / admin

Estado observado:

- Login tiene rate limit y bootstrap de perfil/organizacion.
- Middleware protege paginas privadas, APIs protegidas y rutas admin.
- Platform admin se valida por `profiles.is_platform_admin` o allowlists `PLATFORM_ADMIN_EMAILS` / `PLATFORM_ADMIN_USER_IDS`.
- Onboarding usa service role despues de validar membership owner/admin.
- Admin UI tiene dashboard, organizaciones, usuarios, subscriptions, settings y queues.

Mejoras aplicadas:

- Eliminado fallback de superadmin hardcodeado en `lib/auth-helpers.ts`.
- Eliminados links rotos de `/admin/organizations/[id]/edit` y `/members` desde la lista de organizaciones.

Pendientes:

- Hecho: `companyData`, `configData` y `teamMembers` en `/api/onboarding/complete` se validan con Zod antes de usar service role.
- P1: unificar validacion de platform admin entre middleware, layout cliente y `requirePlatformAdmin`.
- P1: agregar tests API para `requirePlatformAdmin`, onboarding y team invitations.
- P1: admin queues todavia muestra Bull Board informativo; no debe presentarse como panel operativo real.
- P2: evitar `window.location.href` en login si se quiere mantener navegacion SPA y estados consistentes.

#### 2. CRM core

Estado observado:

- Contacts, leads, accounts, pipeline y opportunities existen, pero no todos tienen el mismo nivel de contrato API/UI.
- `leads` funciona en parte como vista/flujo derivado de `contacts`; falta decidir si sera modulo independiente.
- Pipeline usa `opportunities` y `pipeline_stages`, con etapas por organizacion.
- Varias pantallas dependen de paginacion y estados vacios compartidos.

Mejoras aplicadas:

- `PATCH /api/opportunities/[id]` ahora usa allowlist estricta de campos.
- `stage_id` y `contact_id` en oportunidades se validan contra `organization_id` antes de actualizar.
- El endpoint de oportunidades ya no permite sobrescribir campos sensibles como `organization_id`, `created_by` o `status` desde un body arbitrario.
- El Kanban de pipeline ahora abre confirmacion antes de eliminar una oportunidad.
- Pipeline solicita hasta 100 oportunidades para evitar perder columnas por el limite default de 20.
- `PaginationControls` evita estados imposibles como pagina 1 de 0 y deshabilita navegacion sin paginas.
- Se agregaron tests contractuales para rechazar campos peligrosos y etapas fuera del tenant.

Pendientes:

- P1: resolver si `leads` es tabla/modulo propio o una vista de `contacts`; hoy hay riesgo de filtros incompletos si solo se trae la primera pagina de contactos.
- P1: revisar enlaces a `/contacts/[id]` o vistas detalle que no existan.
- P1: agregar tests para conversion lead -> contact/opportunity con tenant isolation.
- P1: reemplazar fetches amplios de Kanban por paginacion por etapa o endpoint agregado si se esperan mas de 100 oportunidades.
- P2: normalizar empty/error states en contacts, products y listas paginadas.
- P2: alinear nombres `sales`, `pipeline`, `opportunities` en navegacion, docs y OpenAPI.

#### 3. Revenue

Estado observado:

- Quotes, invoices, payments y orders estan implementados, pero revenue sigue siendo dominio critico por calculos, stock, facturas y webhooks.
- `POST /api/payments` ya no hace validacion de saldo + insercion + actualizacion de factura desde la ruta; delega en la RPC `record_payment_atomic`.
- Hay RPC historica `process_payment_atomic`, pero el contrato actual de pagos manuales usa `record_payment_atomic`.

Mejoras aplicadas:

- `POST /api/payments` usa RPC transaccional con `SELECT ... FOR UPDATE`, validacion de membership, idempotency key, bloqueo de sobrepago e insercion en una sola operacion.
- Se agrego indice unico parcial por `(organization_id, gateway, transaction_id)` cuando `transaction_id IS NOT NULL`.
- El trigger historico de invoices ahora marca una factura como pagada solo cuando la suma de pagos completados cubre el total.
- `PATCH /api/payments/[id]` ahora filtra sumas/updates por `organization_id`.
- `PATCH /api/payments/[id]` bloquea aprobaciones manuales que excedan el saldo pendiente observado.
- La integracion activa de pagos queda movida a Culqi/PagoEfectivo o confirmacion manual; las rutas activas de Stripe fueron eliminadas.
- La migracion `104_remove_legacy_stripe_artifacts.sql` elimina artefactos heredados de Stripe del esquema final.
- `/api/pay/[token]` valida formato de token y comprobante antes de usar service role.
- `/api/pay/[token]` falla cerrado en CORS de produccion si `PUBLIC_PAY_ALLOWED_ORIGINS` no esta configurado.
- `POST /api/payment-links` valida exactamente un recurso (`quote_id` o `invoice_id`) y delega la verificacion de tenant a `generate_payment_token`.
- La migracion 099 revoca `INSERT`/`DELETE` y limita `UPDATE` de payment tokens a `is_active` para clientes autenticados.
- `POST /api/quotes` valida que contacto, oportunidad y productos pertenezcan al tenant antes de insertar quote/items.
- `create_invoice_with_items_atomic` queda reforzada en la migracion 100 con `auth.uid()`, membership, contacto del tenant y productos del tenant antes de crear items o descontar stock.
- `invoice_items` queda alineada con tipos/esquema al guardar `product_id` y `tax_rate`.
- `sales_orders` queda alineada con UI/API: `order_number`, `items` JSONB, estado `completed`, validacion de referencias y updates parciales sin pisar defaults.

Pendientes:

- P0: antes de aplicar en una base con datos reales, correr preflight de duplicados por `(organization_id, gateway, transaction_id)` para que el indice unico parcial no falle.
- P0: cubrir doble pago/doble webhook con tests de concurrencia o prueba SQL contra la RPC.
- P0: aplicar y validar la migracion 096 en base objetivo.
- P0: aplicar y validar la migracion 099; si existen tokens historicos con quote e invoice a la vez, limpiarlos antes de validar el constraint.
- P0: aplicar y validar la migracion 100; si existen sales orders historicas sin numero o items no-array, corregir antes de validar constraints.
- P1: `QuoteDialog` envia edicion completa, pero el endpoint de quote por id debe confirmar si acepta solo status o todos los campos.
- P1: orders aun necesita handlers reales para Nuevo/Ver/Editar y pruebas UI.
- P2: normalizar badges/estados visibles de orders contra los estados reales del enum.

#### 4. Products / inventory

Estado observado:

- `/inventory` redirige a productos, pero `/api/inventory` sigue vivo como fachada sobre `products`.
- Decidir si se mantiene como compatibilidad o se migra todo a `/api/products`.

Pendientes:

- P0: validar en base real que la migracion 100 descuenta stock de facturas con productos fisicos y no descuenta servicios.
- P1: movimientos de inventario y descuento de stock deben mantenerse atomicos cuando se originan desde quotes/invoices/orders.
- P1: documentar si `/api/inventory` queda como compatibilidad publica o si se depreca.
- P2: mejorar error states en catalogo de productos y movimientos.

#### 5. Forms / campaigns / calendar

Estado observado:

- Calendario usa `calendar_events` como contrato canonico.
- `/api/events` queda como compatibilidad legacy sobre `calendar_events`, no como tabla separada.
- Campaigns UI consume el wrapper `{ success, data, pagination }`; el contrato actual esta alineado en la lista principal.

Mejoras aplicadas:

- Booking publico valida fecha futura, dias disponibles, ventana horaria y maximo de anticipacion antes de crear eventos.
- Booking publico crea eventos mediante la RPC `book_public_calendar_slot`, que revalida reglas de agenda dentro de la transaccion.
- La migracion `098_atomic_public_booking.sql` serializa reservas por owner/dia con `pg_advisory_xact_lock` y vuelve a comprobar overlaps antes de insertar.
- Booking/public forms cierran CORS fail-open en produccion si no hay allowlist configurada.
- Public forms valida campos enviados contra la definicion del formulario: required, email, number, select, checkbox, tamano y campos no permitidos.
- Forms por id (`GET/PUT/DELETE /api/forms/[id]`) filtran por `organization_id`.
- `GET /api/forms/[id]/submissions` valida UUID/status/paginacion y verifica ownership del formulario antes de listar submissions por `organization_id`.
- `POST/PUT /api/forms` validan schema server-side para campos, colores, emails, redirect URL, tags y usuario asignado del tenant.
- Public form submit ya no devuelve CORS `*` en errores despues de validar origen y sanitiza errores de backend.
- `/calendar` lee `/api/calendar/events`, por lo que las reservas creadas por booking publico aparecen en la misma fuente.
- `EventDialog` crea/edita via `/api/calendar/events`; las rutas legacy `/api/events` escriben en `calendar_events` para compatibilidad.
- Eventos de calendario validan rango de fechas y referencias `contact_id`/`opportunity_id` contra el tenant antes de escribir.
- Campaigns ya no permite crear/activar/programar campañas sin contenido, asunto email y audiencia; la UI evita progreso `NaN` cuando no hay contactos.

Pendientes:

- P0: aplicar y validar la migracion 098 en base objetivo con prueba SQL de concurrencia.
- P1: falta revisar acciones de procesamiento/actualizacion de submissions si se agregan endpoints mutables.
- P1: decidir si la tabla historica `events` se migra/retira despues de verificar datos reales.
- P1: campaigns necesita flujo real de segmentacion/envio antes de venderse como marketing operativo.
- P2: campaigns necesita pruebas de paginacion, filtros y estados de error.

#### 6. Tasks / tickets / inbox / notifications

Estado observado:

- Tasks y tickets ya filtraban operaciones principales por `organization_id`, pero aceptaban referencias cruzadas sin verificar que pertenecieran al tenant.
- Bulk updates de tickets permitian campos que no existen en la tabla (`category`) y podian fallar en runtime.
- Tickets usaba contratos inconsistentes: DB/API escriben `title`, pero UI, busqueda global y exportacion todavia esperaban `subject`, `ticket_number` o `category`.
- Inbox tenia rutas separadas para conversaciones y mensajes; los mensajes filtraban por `organization_id`, pero no verificaban primero que la conversacion perteneciera al tenant.
- Notificaciones mezclan `notifications` y `system_notifications`; la lectura anterior podia traer notificaciones del usuario fuera de la organizacion activa.

Mejoras aplicadas:

- Nuevo helper `lib/work-item-references.ts` valida contactos, workflows, cuentas, canales, conversaciones y usuarios asignados contra la organizacion activa.
- `POST/PATCH /api/tasks` y `POST/PUT/PATCH /api/tickets` validan referencias antes de escribir.
- Bulk updates de tasks/tickets usan schemas estrictos, limite de 100 IDs, UUIDs validos, rate limit y validacion de assignee del tenant.
- `GET /api/tasks` y `GET /api/tickets` validan filtros; tickets ya aplica `search` contra `title`.
- `GET /api/tickets/[id]` existe y `PATCH /api/tickets/[id]` queda soportado para updates parciales.
- UI, busqueda global y exportacion de tickets quedan alineadas a `title`/`id` y ya no dependen de columnas inexistentes.
- Inbox valida `contact_id`/`channel_id` al crear conversaciones y verifica ownership de la conversacion antes de leer, simular o insertar mensajes.
- Notificaciones privadas filtran por `organization_id` + `user_id`; `system_notifications` se limitan a la organizacion activa y a usuario especifico o aviso global.
- Eventos que generan notificaciones incluyen `organization_id`, usan roles reales (`owner/admin/manager`) y el titulo real del ticket.
- Se agregaron tests contractuales para referencias de tasks/tickets, contrato `title` de tickets e isolation de inbox/notificaciones.

Pendientes:

- P1: `system_notifications` no tiene read-state por usuario para avisos globales; marcar como leida una global afecta la fila compartida.
- P1: inbox sigue siendo polling y simulacion local; falta decidir proveedor real de WhatsApp/email y estados de entrega.
- P1: tickets necesita flujo completo de crear/editar desde UI, no solo listar/eliminar.
- P2: tasks/tickets necesitan tests runtime de permisos por rol y estados de error en UI.

#### 7. Workflows / integrations / AI

Estado observado:

- Workflows dependen de worker/Redis o drainer.
- Webhooks con service role necesitan secretos por tenant/integracion y allowlists de acciones.
- Integrations puede devolver configuracion descifrada al cliente segun endpoint; eso debe revisarse por columna y rol.

Mejoras aplicadas:

- `GET /api/cron/process-workflows` valida `CRON_SECRET` localmente antes de drenar jobs.
- Todos los endpoints `/api/cron/*` usan `lib/cron-auth.ts` y no aceptan `Bearer undefined` si falta `CRON_SECRET`.
- `POST /api/workflows/execute` devuelve `statusUrl` contra la ruta real `/api/jobs/[id]`.
- Se agregaron tests contractuales para cron y `statusUrl`.
- `GET /api/workflows/executions/[id]/logs` verifica ownership antes de pedir logs detallados y la RPC queda protegida por tenant.
- Workflow executor filtra actualizaciones de lead score/status por `organization_id`, valida contactos/assignees para tareas y solo notifica miembros activos del tenant.
- Integrations ya no devuelve configuracion descifrada ni `config_encrypted` al listar/consultar/guardar; la UI conserva la configuracion existente si no se reemplaza.
- Webhooks salientes, test de integraciones y acciones webhook de workflows validan URL con proteccion SSRF compartida antes de ejecutar `fetch`.
- La validacion bloquea protocolos no HTTP(S), localhost, metadata hosts, IPs privadas/reservadas y hosts que resuelven por DNS a rangos privados/reservados.
- Se agregaron tests contractuales para redaccion de integraciones y scope de workflows.

Pendientes:

- Hecho: se elimino el endpoint de automatizacion externa que aceptaba tenant desde el body.
- P1: definir si produccion usa worker persistente o drainer programado.
- P1: integration test/connection debe mantener secretos solo server-side en todos los endpoints auxiliares.
- P1: decidir politica de allowlist de dominios para webhooks si se necesita un modo aun mas restrictivo por tenant.
- P2: workflows list debe mostrar error state real, no solo `console.error`.
- P2: builder de workflows debe pasar por APIs o justificar uso directo de Supabase browser.

#### 8. Dashboard / analytics / reports

Estado observado:

- `analytics/advanced` devolvia datos placeholder y no debia venderse como funcional.
- `analytics/aggregated` dependia de RPCs no presentes en migraciones.
- Report builder tenia allowlists parciales en runtime, pero `saved`/`export` aceptaban configuraciones y payloads sin el mismo contrato.

Mejoras aplicadas:

- `/api/analytics/advanced` ya no devuelve datos ficticios; responde `501` hasta conectarse a metricas reales.
- `/api/analytics/aggregated` deja de depender de RPCs inexistentes y usa queries tenant-scoped sobre contactos, facturas y `analytics_cache`.
- Analytics principal y pipeline validan `period` con schema antes de consultar.
- Campaign analytics calcula revenue solo con contactos del tenant y evita `.in()` vacio.
- Dashboard corrige "Contactos Totales" para usar total real, no contactos del mes.
- Report builder comparte contrato en `lib/report-contracts.ts`: entidades, metricas, groupBy, filtros y date ranges.
- `last_quarter` y `all_time` ya tienen comportamiento definido en reportes.
- Saved reports valida config antes de guardar y devuelve reportes serializados en el formato que la UI espera.
- Export valida formato, columnas, filas maximas y filename antes de generar CSV/XLS.

Pendientes:

- P1: dashboard/analytics deben distinguir error real, loading y vacio; hoy algunos fallos pueden verse como cero datos.
- P1: reports builder debe mantener allowlist estricta de entidades, columnas y filtros.
- P1: no vender analytics advanced como modulo operativo hasta conectar datos reales; por ahora falla explicitamente con `501`.
- P2: agregar tests para filtros invalidos y respuestas 400 en reports/analytics.

#### 9. UX / sistema compartido

Mejoras aplicadas:

- Paginacion compartida maneja total 0 sin navegacion invalida.
- Kanban tiene accion de eliminar explicita con icono y confirmacion.

Pendientes:

- P2: usar componentes compartidos de empty/error state en todas las listas criticas.
- P2: eliminar o consolidar componentes duplicados de sidebar/layout cuando ya no se usen.
- P2: retirar demos o rutas duplicadas de workflows si no tienen funcion productiva.

## Fase 5 - Operacion

Objetivo: poder correr la app con claridad fuera del entorno local.

Acciones:

- Decidir si workflows usan worker persistente o drainer externo.
- Configurar cron real o documentar scheduler externo.
- Definir politica Redis: fail open, fallback memoria o fail closed.
- Revisar warning de build de BullMQ por dependencia dinamica.
- Activar observabilidad real solo si variables/dependencias existen.
- Agregar health checks para Redis, Supabase, workers y colas.
- Documentar rollback y backup/restore.

## Prioridad inicial

1. Seguridad de funciones SQL y service role.
2. Aplicar/verificar migraciones 094, 095, 097, 098, 099 y 100 en base objetivo.
3. Coverage bajo por modulo critico.
4. Workers/cron.
5. Contratos UI/API rotos.
6. Normalizacion de docs restante.
