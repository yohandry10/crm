# Seguridad y datos

Este documento lista riesgos de datos y seguridad que deben resolverse antes de declarar produccion.

## Riesgos criticos

### Secretos descifrados en vistas

`supabase/migrations/080_encrypt_credentials.sql` crea `organizations_decrypted` y concedia `SELECT` a `authenticated`. Esa vista descifra credenciales SUNAT/OSE y datos bancarios.

Estado actual:

- `supabase/migrations/095_security_definer_hardening.sql` revoca `SELECT` a `PUBLIC`/`authenticated` y deja la vista solo para `service_role`.
- Sigue pendiente aplicar y validar esa migracion en cada base objetivo.

Accion esperada:

- Confirmar que ningun cliente `authenticated` depende de `organizations_decrypted`.
- Reemplazar la vista de compatibilidad por RPCs minimas con validacion explicita de membership/rol y columnas estrictas si la app necesita leer secretos descifrados.

### Funciones SECURITY DEFINER

Hay funciones SQL sensibles con `SECURITY DEFINER` que deben validar tenant internamente o limitar grants.

Revisar:

- `supabase/migrations/050_decrement_stock_function.sql`
- `supabase/migrations/047_check_quote_stock.sql`
- `supabase/migrations/084_quotes_payments_hardening.sql`
- `supabase/migrations/064_public_payment_tokens.sql`
- `supabase/migrations/080_encrypt_credentials.sql`
- RPCs expuestas por app: `search_contacts`, `get_or_create_conversation`, `add_ai_message`, `check_subscription_status`, `check_plan_limits`, `get_workflow_execution_logs`.

Accion esperada:

- Aplicar y validar `095_security_definer_hardening.sql`.
- Aplicar y validar `097_security_definer_rpc_hardening.sql`.
- Aplicar y validar `098_atomic_public_booking.sql`.
- Aplicar y validar `099_public_payment_tokens_hardening.sql`.
- Aplicar y validar `100_revenue_inventory_consistency.sql`.
- Aplicar `101_production_readiness_verification_rpc.sql` y ejecutar `pnpm production:verify-db` contra la base objetivo.
- Alternativa manual: ejecutar `supabase/verification/production-readiness.sql` en la base objetivo despues de aplicar migraciones.
- Mantener `REVOKE EXECUTE FROM PUBLIC` donde aplique.
- No conceder a `authenticated` si la funcion no verifica membership.
- Agregar checks con `auth.uid()` y membership/role en cualquier nueva RPC.
- Fijar `search_path` en funciones `SECURITY DEFINER`.

### Idempotencia de pagos

La idempotencia por `(organization_id, gateway, transaction_id)` debe estar respaldada por indice unico, no solo por `SELECT` previo.

Estado actual:

- `POST /api/payments` usa la RPC `record_payment_atomic` para validar membership, bloquear la factura con `FOR UPDATE`, verificar saldo, aplicar idempotencia e insertar el pago en una sola transaccion.
- Se agrego indice unico parcial por `(organization_id, gateway, transaction_id)` cuando `transaction_id IS NOT NULL`.
- El trigger de invoices se corrigio para marcar `paid` solo cuando la suma de pagos completados cubre el total.
- La aprobacion manual de pagos pendientes bloquea sobrepago con el saldo observado.
- La migracion debe validarse contra datos existentes porque duplicados historicos de `(organization_id, gateway, transaction_id)` pueden impedir crear el indice unico.

Accion esperada:

- Preflight/limpieza de duplicados antes de aplicar la migracion en entornos con datos reales.
- Tests de concurrencia o doble webhook contra la RPC.
- Aplicar y validar `096_stripe_event_processing_status.sql` solo como compatibilidad historica si el entorno conserva esas tablas.
- Las rutas activas de Stripe fueron eliminadas; pagos nuevos deben usar Culqi/PagoEfectivo o confirmacion manual.
- Payment links ya se crean por RPC `generate_payment_token`, que valida membership, tenant del recurso y exactamente un recurso.
- La migracion 099 impide insercion/borrado directo de payment tokens desde clientes autenticados y limita update a desactivacion.

### Tenant isolation

Riesgos a revisar:

- Header `x-organization-id` se lee en app, pero funciones SQL usan `current_setting('app.current_organization_id')`.
- Service role en workflows puede saltarse RLS.
- Se elimino el endpoint de automatizacion externa que aceptaba tenant desde el body.
- Algunas actualizaciones de workflow filtran por `id` sin `organization_id`.
- Policies con `WITH CHECK (true)` deben justificarse o restringirse.

Mitigaciones aplicadas:

- Platform admin ya no depende de un UUID hardcodeado en codigo.
- `PATCH /api/opportunities/[id]` usa allowlist estricta y valida `stage_id`/`contact_id` contra `organization_id`.
- `GET /api/cron/process-workflows` valida `CRON_SECRET` antes de procesar jobs.
- Los endpoints `/api/cron/*` usan validacion centralizada de `CRON_SECRET` y fallan cerrado si no esta configurado.
- Los cron de mantenimiento usan service role solo despues de validar `CRON_SECRET`.
- Onboarding, admin organizations/users, team invite y subscription checkout/cancel validan entrada con Zod antes de usar service role.
- Esos endpoints usan `createSupabaseServiceClient` en vez de clientes service-role ad hoc.
- Pagos manuales usan RPC transaccional con validacion de tenant, saldo e idempotencia.
- Workflow executor filtra updates de contactos por `organization_id` y valida contactos/usuarios antes de acciones con service role.
- Forms por id filtra `GET/PUT/DELETE` por `organization_id`.
- Public forms y booking requieren allowlist CORS en produccion.
- GET/POST/OPTIONS de public forms fallan cerrado en produccion si no hay allowlist.
- Public forms valida campos enviados contra la definicion del formulario.
- Forms privados validan campos/theme/emails/redirect y usuario asignado antes de escribir configuraciones del tenant.
- Public forms sanitiza errores de backend y conserva el origen permitido en respuestas de error.
- Booking publico valida slot contra reglas de agenda antes de crear eventos.
- Booking publico crea la reserva por RPC `book_public_calendar_slot`, con lock transaccional por owner/dia y revalidacion de overlaps.
- Calendario usa `calendar_events` como tabla canonica y valida contacto/oportunidad contra el tenant antes de escribir eventos manuales.
- Public pay valida formato de token, body del comprobante y CORS de produccion antes de usar service role.
- Public pay exige URL HTTPS para comprobantes en produccion.
- Form submissions por id verifican ownership del formulario y filtran submissions por `organization_id`.
- Webhooks salientes usan validacion SSRF compartida antes de `fetch`: protocolo HTTP(S), bloqueo de localhost/metadata, IPs privadas/reservadas y DNS que resuelve a rangos internos.
- Integrations devuelve configuracion redactada y no expone `config_encrypted`.
- Quotes validan contacto, oportunidad y productos contra `organization_id` antes de insertar items.
- Sales orders validan cuenta, contacto, oportunidad y productos antes de insertar/actualizar y antes de descontar stock al completar.
- Tasks validan contacto, workflow y usuario asignado contra el tenant antes de crear/actualizar, incluyendo bulk updates.
- Tickets validan cuenta, contacto y usuario asignado contra el tenant antes de crear/actualizar, incluyendo bulk updates.
- Inbox valida contacto/canal al crear conversaciones y verifica que la conversacion pertenezca a la organizacion antes de leer o escribir mensajes.
- Notificaciones privadas se leen/marcan por `organization_id` + `user_id`; notificaciones de sistema se limitan a la organizacion activa.
- Eventos que insertan notificaciones incluyen `organization_id` y usan roles reales del enum (`owner/admin/manager`).
- Reports usa contrato compartido para entidades, metricas, agrupaciones y filtros antes de ejecutar/guardar/exportar reportes.
- Analytics advanced no devuelve placeholders; responde `501` hasta conectarse a datos reales.
- Analytics aggregated ya no depende de RPCs no versionadas y consulta datos filtrados por `organization_id`.
- Facturas creadas por RPC validan `auth.uid()`, membership, contacto y productos del tenant antes de insertar `invoice_items` o generar `inventory_movements`.
- La migracion 095 endurece el primer bloque de funciones `SECURITY DEFINER`: stock, quote stock, tokens publicos, reconciliacion, cifrado y helpers de credenciales.
- La migracion 097 endurece RPCs expuestas con `SECURITY DEFINER`: tenant helpers, busqueda de contactos, chat IA, suscripciones, limites de plan, logs de workflows, cron/forms/webhooks server-only.
- La migracion 100 alinea contratos revenue-inventory y reemplaza `create_invoice_with_items_atomic` con validacion interna de tenant.
- `organizations_decrypted` queda sin `SELECT` para `authenticated` en la migracion 095.

Riesgos pendientes de endpoint:

- Booking publico requiere aplicar y validar la migracion 098 en cada base objetivo.
- Payment tokens requieren aplicar y validar la migracion 099 en cada base objetivo.
- Revenue/inventory requiere aplicar y validar la migracion 100 en cada base objetivo.
- Webhooks con service role deben limitarse a proveedores activos y con verificacion propia.
- Webhooks salientes podrian requerir allowlist por tenant/dominio si el despliegue exige una politica mas estricta que el bloqueo SSRF general.
- Endpoints auxiliares de integrations deben revisarse para confirmar redaccion en todos los flujos.
- `system_notifications` globales no tienen estado de lectura por usuario; si se requiere lectura individual hace falta tabla puente o duplicacion por usuario.
- Falta ejecutar pruebas SQL reales de las migraciones 095, 097 y 098 con usuarios de distintas organizaciones y concurrencia.

### Cifrado

Hay dos estrategias documentadas/implementadas:

- App: `lib/encryption.ts`, formato `iv:ciphertext`.
- DB: `pgcrypto` en migraciones.

Accion esperada:

- Elegir una estrategia canonica.
- No devolver texto original silenciosamente si falla decrypt.
- Redactar secretos en logs.
- Probar cifrado, migracion y rollback.

### Logging sensible

`withApiMiddleware` puede registrar cuerpos de requests. En pagos, integraciones, webhooks o credenciales esto puede filtrar secretos.

Accion esperada:

- Redactar campos sensibles.
- No loggear bodies completos por defecto.
- Agregar allowlist de campos seguros.

## Checks recomendados

- Test SQL de RLS con usuarios de distintas organizaciones.
- Test de funciones RPC con usuario sin membership.
- Test de pagos duplicados.
- Test de workflow con payload malicioso.
- Test de logs sin secretos.
