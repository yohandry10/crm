# Go-live checklist

Este checklist define bloqueadores antes de vender o publicar como produccion.

## Bloqueadores globales

- [x] `pnpm typecheck` pasa.
- [x] `pnpm exec vitest run` pasa.
- [x] `pnpm test:coverage` funciona y reporta cobertura real.
- [x] `pnpm build` pasa.
- [ ] Coverage tiene umbrales por modulo critico y no solo reporte global.
- [x] Warnings de dependencias server-only revisados; BullMQ externalizado y Supabase SSR Edge warning filtrado.
- [x] `pnpm lint` no incluye carpetas generadas como `.next-build` o `coverage`.
- [x] `pnpm production:check` pasa localmente con 0 failures en `BILLING_PROVIDER=manual`.
- [ ] `pnpm production:check` ejecutado en CI/proveedor con variables reales de produccion.
- [x] `pnpm production:verify-db` ejecutado contra Supabase objetivo con 0 failures.
- [ ] Supabase Auth tiene Site URL y Redirect URLs correctas.
- [x] Platform admin no depende de superadmin hardcodeado en codigo.
- [x] Operaciones con service role en onboarding/admin/team/subscriptions validan body/filtros antes de escribir.
- [ ] RLS habilitado y probado en tablas sensibles.
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
- [ ] Credenciales reales de Culqi/PagoEfectivo configuradas antes de activar `BILLING_PROVIDER=culqi_pagoefectivo`.
- [x] Migracion 095 revoca `organizations_decrypted` para `authenticated`.
- [ ] Confirmar que ningun cliente `authenticated` depende de `organizations_decrypted`.
- [x] Migracion de pagos agrega idempotencia respaldada por indice unico parcial.
- [ ] Base objetivo revisada sin duplicados historicos antes de aplicar el indice unico de pagos.
- [x] Rutas activas de Stripe eliminadas; pagos operan por Culqi/PagoEfectivo, gateway manual o payment links.
- [x] Migracion 096 aplicada y verificada en la base objetivo.
- [x] Pagos manuales son idempotentes y transaccionales via RPC.
- [x] Pagos filtran sumas y actualizaciones auxiliares por `organization_id`.
- [x] Cron jobs definidos en `vercel.json` con perfil diario compatible con Vercel Hobby.
- [x] Drainer acotado de workflows configurado por cron (`WORKFLOW_PROCESSING_MODE=cron-drainer`).
- [ ] Worker persistente configurado si workflows se venden como near-real-time (`WORKFLOW_PROCESSING_MODE=worker`).
- [x] Endpoints `/api/cron/*` validan `CRON_SECRET` con helper central y fallan cerrado si falta.
- [x] Politica Redis decidida y documentada: Redis obligatorio y `RATE_LIMIT_FAIL_OPEN=false`.
- [ ] Endpoints publicos tienen rate limit, CORS y validacion estricta en todos los flujos.
- [x] Public forms y booking fallan cerrado en CORS de produccion si no hay allowlist.
- [x] Public forms valida campos enviados contra la definicion del formulario.
- [x] Forms privados validan schema y assignee del tenant antes de escribir.
- [x] Public forms no devuelve CORS wildcard en errores despues de validar origen.
- [x] Public pay valida token, comprobante y CORS de produccion antes de usar service role.
- [x] Form submissions por id verifican ownership del formulario antes de listar.
- [x] Tasks/tickets validan referencias y assignees del tenant antes de escribir.
- [x] Inbox valida ownership de conversaciones antes de leer/escribir mensajes.
- [x] Notificaciones se filtran por organizacion activa.
- [ ] Logs no exponen secretos ni cuerpos sensibles.
- [ ] Webhooks con service role no aceptan `organization_id` libre desde el body.
- [x] Integrations no devuelve configuracion descifrada ni `config_encrypted`.

## Modulos criticos

### Auth / onboarding / admin

- [ ] Login, signup, reset y OAuth probados.
- [ ] Platform admin validado.
- [ ] Invitaciones y miembros de organizacion probados.

### CRM core

- [ ] Contacts/leads/accounts filtran por organizacion.
- [x] `PATCH /api/opportunities/[id]` valida campos permitidos y etapas/contactos por organizacion.
- [ ] Pipeline/opportunities tiene etapas por organizacion en todos los flujos de creacion, edicion y migracion.
- [ ] Conversion lead -> contact/opportunity preserva tenant.

### Revenue

- [ ] Quotes e invoices calculan totales consistentemente.
- [x] Quotes validan contacto, oportunidad y productos por organizacion antes de insertar items.
- [x] Facturas creadas por RPC validan tenant/contacto/productos antes de descontar stock.
- [x] Sales orders tienen `order_number`, `items`, estado `completed` y validacion de referencias alineados con API/UI.
- [ ] PDFs no exponen datos de otra organizacion.
- [x] Payment links se generan via RPC con validacion de tenant/recurso.
- [ ] Payment links validados contra la base objetivo despues de aplicar migracion 099.
- [x] Public pay valida formato de token antes de resolver documentos.
- [x] Pagos activos excluyen Stripe y aceptan gateways locales configurados.

### Public forms / booking

- [ ] Origen permitido configurado.
- [ ] Rate limit y antispam activos.
- [x] Booking valida horario contra reglas de agenda.
- [x] Booking evita doble reserva bajo concurrencia a nivel de RPC/migracion.
- [x] `/calendar` y booking publico usan `calendar_events` como fuente comun.
- [x] Eventos manuales validan rango de fechas y referencias de tenant.
- [ ] Booking validado contra la base objetivo despues de aplicar migracion 098.
- [ ] Campaigns conectado a segmentacion/envio real antes de venderlo como modulo operativo.

### Workflows

- [x] Drainer de workflow configurado en cron diario con limites de tiempo/jobs.
- [ ] Worker persistente operativo si se requiere procesamiento near-real-time.
- [x] Acciones principales con service role filtran por organizacion.
- [x] Webhook actions tienen proteccion SSRF compartida antes de `fetch`.
- [ ] Decidir si webhooks salientes requieren allowlist por dominio/tenant.

### Tasks / tickets / inbox

- [x] Tasks validan contacto, workflow y assignee contra la organizacion.
- [x] Tickets validan cuenta, contacto y assignee contra la organizacion.
- [x] Bulk updates de tasks/tickets usan allowlist estricta.
- [x] Tickets UI/search/export usan `title`, no columnas legacy.
- [x] Inbox valida conversacion por organizacion antes de listar/enviar mensajes.
- [ ] Tickets tiene flujo UI completo de crear/editar.
- [ ] Notificaciones globales tienen read-state por usuario o decision explicita de lectura global.

### Reports / analytics

- [x] Report builder valida entidades, metricas, agrupaciones, filtros y date ranges con contrato compartido.
- [x] Saved/export reports validan configuracion y payload antes de guardar/exportar.
- [x] Analytics advanced no devuelve datos ficticios.
- [ ] Analytics advanced conectado a metricas reales antes de venderlo.
- [ ] Errores de columnas invalidas cubiertos con tests runtime, no solo contratos estaticos.

## Smoke test manual

1. Crear usuario y organizacion.
2. Invitar miembro.
3. Crear contacto.
4. Crear lead y convertirlo.
5. Crear oportunidad y mover etapa.
6. Crear producto.
7. Crear cotizacion y factura.
8. Registrar pago manual.
9. Enviar formulario publico.
10. Crear booking publico.
11. Ejecutar workflow simple.
12. Ver dashboard/reportes.
