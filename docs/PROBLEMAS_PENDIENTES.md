# Estado del Proyecto CRM - Actualizado
## Última Auditoría QA: 7 de Diciembre 2025 (Auditoría Exhaustiva Completada - Sesión 3)

### Estado General: ✅ LISTO PARA PRODUCCIÓN
### Tests: 87 pasando | 4 skipped
### Correcciones totales: 34 (UX + eventos + conversión de leads + validaciones + rate limiting + inventario)

---

## 🔧 CORRECCIONES QA - 6 Diciembre 2025

### 0. ✅ Archivo auth-context.ts FALTANTE (CRÍTICO - CORREGIDO)
**Problema:** 14 archivos API importaban `@/lib/auth-context` pero el archivo NO EXISTÍA.
- **Archivos afectados:** 
  - `app/api/notes/route.ts`
  - `app/api/notes/[id]/route.ts`
  - `app/api/contacts/bulk/route.ts`
  - `app/api/contacts/import/route.ts`
  - `app/api/contacts/duplicates/route.ts`
  - `app/api/invoices/bulk/route.ts`
  - `app/api/invoices/[id]/send/route.ts`
  - `app/api/products/bulk/route.ts`
  - `app/api/products/import/route.ts`
  - `app/api/opportunities/bulk/route.ts`
  - `app/api/tasks/bulk/route.ts`
  - `app/api/tickets/bulk/route.ts`
  - `app/api/favorites/route.ts`
  - `app/api/activity/route.ts`
- **Solución:** Creado `lib/auth-context.ts` como wrapper de `supabase-auth.ts` con `userId` para compatibilidad

### 1. ✅ Lead Status Inconsistency (CRÍTICO - CORREGIDO)
**Problema:** `components/leads/lead-dialog.tsx` usaba estados diferentes al resto del sistema.
- **Antes:** `["new", "contacted", "qualified", "unqualified"]`
- **Después:** `["cold", "warm", "hot", "converted", "lost"]`
- **Archivos corregidos:** `components/leads/lead-dialog.tsx`
- **Sincronizado con:** `lib/schemas.ts`, `components/contacts/contact-dialog.tsx`

### 2. ✅ Pipeline Page - API Inexistente (CRÍTICO - CORREGIDO)
**Problema:** `app/pipeline/page.tsx` llamaba a `/api/users` que no existe.
- **Solución:** Cambiado a `/api/team` con transformación de datos
- **Archivo corregido:** `app/pipeline/page.tsx`

### 3. ✅ Pipeline Page - Método HTTP Incorrecto (CRÍTICO - CORREGIDO)
**Problema:** Usaba `PUT` con `{ stage: newStage }` pero API espera `PATCH`.
- **Solución:** Cambiado a `PATCH` y actualizado manejo de respuesta
- **Archivo corregido:** `app/pipeline/page.tsx`

### 4. ✅ Opportunity Dialog - Método HTTP Incorrecto (CRÍTICO - CORREGIDO)
**Problema:** `components/opportunities/opportunity-dialog.tsx` usaba `PUT` para actualizar.
- **Solución:** Cambiado a `PATCH` para consistencia con API
- **Archivo corregido:** `components/opportunities/opportunity-dialog.tsx`

### 5. ✅ Edit Invoice Page - VERIFICADO EXISTENTE
**Verificación:** `app/invoicing/[id]/edit/page.tsx` SÍ EXISTE y funciona correctamente.
- Solo permite editar facturas en estado `draft`
- Carga datos existentes correctamente
- Usa método `PUT` para actualización completa (correcto para este caso)

### 6. ✅ Funciones RPC Faltantes (CRÍTICO - CORREGIDO)
**Problema:** Varias funciones RPC usadas en el código NO existían en las migraciones.
- **Funciones faltantes:**
  - `check_quote_stock_availability` - Verificación de stock para cotizaciones
  - `cleanup_auditoria` - Limpieza de logs de auditoría
  - `cleanup_analytics_cache_ttl` - Limpieza de cache de analytics
  - `cleanup_analytics_cache` - Alias de limpieza
  - `expire_old_quotes` - Expiración de cotizaciones
  - `get_workflow_execution_logs` - Logs de ejecución de workflows
- **Solución:** Creadas migraciones:
  - `supabase/migrations/047_check_quote_stock.sql`
  - `supabase/migrations/048_cleanup_functions.sql`

### 7. ✅ Migraciones con Número Duplicado (CORREGIDO)
**Problema:** Existían dos archivos con el mismo número de migración `045_`:
- `045_activity_logs.sql`
- `045_new_features_tables.sql`
**Solución:** Renombrado `045_new_features_tables.sql` a `049_new_features_tables.sql`

### 8. ✅ Inconsistencia de Campos stage vs stage_id (CRÍTICO - CORREGIDO)
**Problema:** Los componentes de opportunities usaban `stage` pero la API espera `stage_id`.
- **Archivos corregidos:**
  - `components/opportunities/kanban-board.tsx` - Cambiado `stage` a `stage_id`
  - `components/opportunities/opportunity-dialog.tsx` - Cambiado `stage` a `stage_id`
  - `app/pipeline/page.tsx` - Cambiado `stage` a `stage_id` en handleStageChange

### 9. ✅ Inconsistencia de Campos value vs expected_revenue (CORREGIDO)
**Problema:** Los componentes usaban `value` pero la API devuelve `expected_revenue`.
- **Solución:** Actualizado `components/opportunities/kanban-board.tsx` para soportar ambos campos
- **Actualizado:** Interface `Opportunity` con `expected_revenue` como campo principal

### 10. ✅ Formato de Params en Next.js 15 (CORREGIDO)
**Problema:** Algunos archivos API usaban el formato antiguo de params `{ params: { id: string } }`.
- **Archivos corregidos:**
  - `app/api/notes/[id]/route.ts` - Cambiado a `Promise<{ id: string }>`
  - `app/api/invoices/[id]/send/route.ts` - Cambiado a `Promise<{ id: string }>`

### 11. ✅ Leads Page - Estados Antiguos (CORREGIDO)
**Problema:** `app/leads/page.tsx` usaba estados antiguos en `getStatusColor` y bulk actions.
- **Antes:** `new`, `contacted`, `qualified`, `unqualified`
- **Después:** `cold`, `warm`, `hot`, `converted`, `lost`
- **Archivo corregido:** `app/leads/page.tsx`

### 12. ✅ Accounts Table - URL Incorrecta para PUT (CORREGIDO)
**Problema:** `app/components/accounts/accounts-table.tsx` enviaba PUT a `/api/accounts` (ruta base) en lugar de `/api/accounts/${id}`.
- **Antes:** `fetch("/api/accounts", { method: editing ? "PUT" : "POST" })`
- **Después:** `fetch(editing ? \`/api/accounts/${editing.id}\` : "/api/accounts", { method: editing ? "PUT" : "POST" })`
- **Archivo corregido:** `app/components/accounts/accounts-table.tsx`

### 13. ✅ Workflow Dialog - Trigger Types Inválidos (CORREGIDO)
**Problema:** `components/workflows/workflow-dialog.tsx` usaba trigger_types que no coincidían con el schema.
- **Antes:** `lead_score_change`, `interaction_added`, `time_based`
- **Después:** `contact.created`, `contact.updated`, `invoice.sent`, `invoice.paid`, `payment.completed`, `opportunity.created`, `opportunity.updated`, `manual`, `schedule`
- **Archivo corregido:** `components/workflows/workflow-dialog.tsx`
- **Sincronizado con:** `lib/schemas.ts` trigger_type enum

### 14. ✅ Automation Workflows - Trigger Types Inválidos (CORREGIDO)
**Problema:** `components/workflows/automation-workflows.tsx` usaba trigger_types antiguos en la UI de demostración.
- **Antes:** `lead_score_change`, `interaction_added`, `time_based`, `status_change`
- **Después:** `contact.created`, `contact.updated`, `invoice.sent`, `invoice.paid`, `payment.completed`, `opportunity.created`, `opportunity.updated`, `manual`, `schedule`
- **Archivo corregido:** `components/workflows/automation-workflows.tsx`
- **Actualizado:** Interface Workflow, ejemplos de workflows, getTriggerIcon, getTriggerDescription, opciones del select

### 15. ✅ Workflows List - UX Inconsistente (CORREGIDO - Sesión 3)
**Problema:** `components/workflows/workflows-list.tsx` usaba `confirm()` y `alert()` nativos.
- **Antes:** `confirm("¿Estás seguro...")` y `alert("Error...")`
- **Después:** `ConfirmDialog` component y `toast.error()`
- **Archivo corregido:** `components/workflows/workflows-list.tsx`
- **Mejoras:** Consistencia UX con el resto de la aplicación

### 16. ✅ getEmailTemplate Faltante (CORREGIDO - Sesión 3)
**Problema:** `lib/events.ts` usaba `getEmailTemplate` pero no estaba exportada en `lib/email.ts`.
- **Solución:** Agregada función `getEmailTemplate` con templates para:
  - `welcome` - Bienvenida a nuevos usuarios
  - `task_assigned` - Notificación de tarea asignada
  - `order_completed` - Pedido completado
  - `invoice_reminder` - Recordatorio de factura
  - `lead_converted` - Lead convertido a cliente
  - Template genérico para otros casos
- **Archivo corregido:** `lib/email.ts`

### 17. ✅ Integration Dialog - alert() nativo (CORREGIDO - Sesión 3)
**Problema:** `components/integrations/integration-dialog.tsx` usaba `alert()` nativo.
- **Antes:** `alert("✅ ...")` y `alert("⚠️ ...")` y `alert("Error: ...")`
- **Después:** `toast.success()`, `toast.warning()`, `toast.error()`
- **Archivo corregido:** `components/integrations/integration-dialog.tsx`

### 18. ✅ Integrations Grid - confirm() y alert() nativos (CORREGIDO - Sesión 3)
**Problema:** `components/integrations/integrations-grid.tsx` usaba `confirm()` y `alert()` nativos.
- **Solución:** Reemplazado con `ConfirmDialog` y `toast`
- **Archivo corregido:** `components/integrations/integrations-grid.tsx`

### 19. ✅ Settings Team - confirm() nativo (CORREGIDO - Sesión 3)
**Problema:** `app/settings/team/page.tsx` usaba `confirm()` nativo para eliminar miembros.
- **Solución:** Reemplazado con `ConfirmDialog`
- **Archivo corregido:** `app/settings/team/page.tsx`

### 20. ✅ Settings Billing - confirm() nativo (CORREGIDO - Sesión 3)
**Problema:** `app/settings/billing/page.tsx` usaba `confirm()` nativo para cancelar suscripción.
- **Solución:** Reemplazado con `ConfirmDialog`
- **Archivo corregido:** `app/settings/billing/page.tsx`

### 21. ✅ Settings Webhooks - confirm() nativo (CORREGIDO - Sesión 3)
**Problema:** `app/settings/webhooks/page.tsx` usaba `confirm()` nativo para eliminar webhooks.
- **Solución:** Reemplazado con `ConfirmDialog`
- **Archivo corregido:** `app/settings/webhooks/page.tsx`

### 22. ✅ Pipeline Page - confirm() nativo (CORREGIDO - Sesión 3)
**Problema:** `app/pipeline/page.tsx` usaba `confirm()` nativo para eliminar oportunidades.
- **Solución:** Reemplazado con `ConfirmDialog`
- **Archivo corregido:** `app/pipeline/page.tsx`

### 23. ✅ Eventos no emitidos en Tasks API (CORREGIDO - Sesión 3)
**Problema:** `app/api/tasks/route.ts` no emitía evento `task.created`.
- **Solución:** Agregada emisión de evento con `emitEvent()`
- **Archivo corregido:** `app/api/tasks/route.ts`

### 24. ✅ Eventos no emitidos en Tickets API (CORREGIDO - Sesión 3)
**Problema:** `app/api/tickets/route.ts` no emitía evento `ticket.created`.
- **Solución:** Agregada emisión de evento con `emitEvent()`
- **Archivo corregido:** `app/api/tickets/route.ts`

### 25. ✅ Eventos no emitidos en Campaigns API (CORREGIDO - Sesión 3)
**Problema:** `app/api/campaigns/route.ts` no emitía evento `campaign.created`.
- **Solución:** Agregada emisión de evento con `emitEvent()`
- **Archivo corregido:** `app/api/campaigns/route.ts`

### 26. ✅ Eventos no emitidos en Quotes API (CORREGIDO - Sesión 3)
**Problema:** `app/api/quotes/route.ts` no emitía evento `quote.created`.
- **Solución:** Agregada emisión de evento con `emitEvent()`
- **Archivo corregido:** `app/api/quotes/route.ts`

### 27. ✅ Handlers de eventos faltantes (CORREGIDO - Sesión 3)
**Problema:** `lib/events.ts` no tenía handlers para los nuevos eventos.
- **Solución:** Agregados handlers para:
  - `task.created`, `task.completed`
  - `ticket.created`, `ticket.resolved`
  - `campaign.created`
  - `quote.created`
- **Archivo corregido:** `lib/events.ts`

### 28. ✅ Trigger types faltantes en schema (CORREGIDO - Sesión 3)
**Problema:** `lib/schemas.ts` no incluía los nuevos trigger_types.
- **Solución:** Agregados trigger_types:
  - `task.created`, `task.completed`
  - `ticket.created`, `ticket.resolved`
  - `campaign.created`, `quote.created`
- **Archivo corregido:** `lib/schemas.ts`

### 29. ✅ UI de workflows sin nuevos triggers (CORREGIDO - Sesión 3)
**Problema:** `components/workflows/workflow-dialog.tsx` no mostraba los nuevos triggers.
- **Solución:** Agregados SelectItems para todos los nuevos trigger_types
- **Archivo corregido:** `components/workflows/workflow-dialog.tsx`

### 30. ✅ Eventos sin user_id (CORREGIDO - Sesión 3)
**Problema:** Varios eventos no incluían `user_id` en el payload, causando que los workflows no se ejecutaran.
- **Archivos corregidos:**
  - `app/api/contacts/route.ts` - contact.created
  - `app/api/contacts/[id]/route.ts` - contact.updated
  - `app/api/payments/route.ts` - payment.completed
  - `app/api/invoices/[id]/route.ts` - invoice.sent
  - `app/api/opportunities/route.ts` - opportunity.created

### 31. ✅ API de Conversión de Leads (NUEVO - Sesión 3)
**Problema:** No existía una API para convertir leads a clientes de forma completa.
- **Solución:** Creada API `/api/contacts/[id]/convert` que:
  - Actualiza lead_status a "converted"
  - Opcionalmente crea cuenta empresarial
  - Opcionalmente crea oportunidad en pipeline
  - Emite evento para workflows
- **Archivos creados:**
  - `app/api/contacts/[id]/convert/route.ts`
  - `components/leads/convert-lead-dialog.tsx`
- **Archivo modificado:** `app/leads/page.tsx` - Agregado botón "Convertir"

### 32. ✅ Rate Limiting faltante en APIs (CORREGIDO - Sesión 4)
**Problema:** Varias APIs no tenían rate limiting implementado.
- **Archivos corregidos:**
  - `app/api/search/route.ts` - Agregado rate limiting
  - `app/api/team/route.ts` - Agregado rate limiting
  - `app/api/team/invite/route.ts` - Agregado rate limiting
  - `app/api/subscriptions/checkout/route.ts` - Agregado rate limiting

### 33. ✅ N+1 Query en Email Sync (CORREGIDO - Sesión 4)
**Problema:** `app/api/emails/sync/route.ts` hacía un upsert por cada email en un loop.
- **Antes:** Loop con `await supabase.upsert()` individual
- **Después:** Batch upsert con array de emails
- **Archivo corregido:** `app/api/emails/sync/route.ts`

### 34. ✅ Órdenes no actualizaban inventario (CORREGIDO - Sesión 4)
**Problema:** Al completar una orden, el stock de productos no se decrementaba.
- **Solución:** Agregada lógica para decrementar stock cuando orden cambia a "completed"
- **Archivos:**
  - `app/api/orders/[id]/route.ts` - Agregada actualización de inventario
  - `supabase/migrations/050_decrement_stock_function.sql` - Función RPC para decremento seguro

---

## ✅ COMPLETADO

### 1. Migración de Supabase Deprecado
Todos los archivos migrados de `@supabase/auth-helpers-nextjs` a `@supabase/ssr`:
- ✅ `components/subscription/subscription-modal.tsx`
- ✅ `components/subscription/trial-banner.tsx`
- ✅ `components/notifications/notification-bell.tsx`
- ✅ `components/layout/dashboard-layout.tsx`
- ✅ `app/profile/page.tsx`
- ✅ `app/onboarding/page.tsx`
- ✅ `app/admin/page.tsx`
- ✅ `app/admin/layout.tsx`
- ✅ `components/leads/lead-dialog.tsx`

### 2. Security Fix - Lead Dialog Multi-Tenant
- ✅ `components/leads/lead-dialog.tsx` ahora usa APIs en lugar de Supabase directo
- ✅ Creada API `/api/lead-sources` con filtro de organización

### 3. PWA / Offline
- ✅ `public/manifest.json` - Manifest de PWA
- ✅ `public/sw.js` - Service Worker con cache strategies
- ✅ `app/offline/page.tsx` - Página offline
- ✅ `hooks/use-online-status.ts` - Hook para detectar conexión
- ✅ `hooks/use-service-worker.ts` - Hook para SW
- ✅ `components/pwa/offline-indicator.tsx` - Indicador de offline
- ✅ `components/pwa/update-prompt.tsx` - Prompt de actualización
- ✅ `app/layout.tsx` - Integrado PWA meta tags y componentes

### 4. Dashboard Personalizable
- ✅ `lib/dashboard-config.ts` - Configuración y tipos
- ✅ `components/dashboard/widget-renderer.tsx` - Renderizador de widgets (memoizado)
- ✅ `components/dashboard/dashboard-customizer.tsx` - Panel de personalización
- ✅ `components/dashboard/customizable-dashboard.tsx` - Dashboard principal

### 5. Memoización de Componentes
- ✅ `components/contacts/contacts-table.tsx` - useCallback, useMemo agregados
- ✅ `components/contacts/contact-row.tsx` - Fila memoizada
- ✅ `components/dashboard/widget-renderer.tsx` - Widgets memoizados
- ✅ `hooks/use-memoized-callback.ts` - Hooks de memoización

### 6. Tests Automatizados
- ✅ `vitest.config.ts` - Configuración de Vitest
- ✅ `tests/setup.ts` - Setup global
- ✅ Tests unitarios y de API (79+ tests pasan)

### 7. 🆕 8 Nuevas Funcionalidades CRM

#### 7.1 Email Integration (Gmail/Outlook)
- ✅ `lib/email-sync.ts` - Clientes Gmail y Outlook
- ✅ `app/api/emails/sync/route.ts` - API de sincronización
- ✅ Tabla `email_accounts` y `synced_emails` en BD

#### 7.2 WhatsApp Business API
- ✅ `lib/whatsapp.ts` - Integración Meta Cloud API
- ✅ `app/api/whatsapp/send/route.ts` - API de envío
- ✅ `components/contacts/whatsapp-button.tsx` - Botón con mensajes rápidos
- ✅ Tabla `whatsapp_messages` en BD

#### 7.3 Calendario con Booking
- ✅ `lib/calendar.ts` - Google Calendar client + booking system
- ✅ `app/api/calendar/events/route.ts` - CRUD de eventos
- ✅ `app/api/calendar/events/[id]/route.ts` - Evento individual
- ✅ `app/api/calendar/booking/route.ts` - Sistema de reservas
- ✅ `app/book/[configId]/page.tsx` - Página pública de booking
- ✅ Tablas `calendar_events` y `booking_configs` en BD

#### 7.4 Pipeline Kanban
- ✅ `components/opportunities/kanban-board.tsx` - Board drag & drop
- ✅ `components/opportunities/opportunity-dialog.tsx` - Diálogo CRUD
- ✅ `app/pipeline/page.tsx` - Página de pipeline
- ✅ Navegación actualizada en sidebar

#### 7.5 Lead Scoring con IA
- ✅ `lib/lead-scoring.ts` - Algoritmo de scoring
- ✅ `app/api/contacts/[id]/score/route.ts` - API de cálculo
- ✅ `components/contacts/lead-score-badge.tsx` - Badge visual
- ✅ Campo `lead_score` agregado a contacts

#### 7.6 Generador de PDFs
- ✅ `lib/pdf-generator.ts` - Generador HTML para cotizaciones/facturas
- ✅ `app/api/pdf/quote/route.ts` - API de generación

#### 7.7 API Documentada (OpenAPI)
- ✅ `lib/openapi-spec.ts` - Especificación OpenAPI 3.0
- ✅ `app/api/docs/route.ts` - Swagger UI + JSON/YAML

#### 7.8 Reportes Avanzados
- ✅ `app/reports/builder/page.tsx` - Constructor de reportes
- ✅ `app/api/reports/run/route.ts` - Ejecución de reportes
- ✅ `app/api/reports/saved/route.ts` - Reportes guardados
- ✅ Tabla `saved_reports` en BD

#### 7.9 Sistema de Webhooks
- ✅ `app/api/webhooks/route.ts` - CRUD de webhooks
- ✅ `app/api/webhooks/[id]/route.ts` - Webhook individual + test
- ✅ `app/settings/webhooks/page.tsx` - UI de configuración
- ✅ Tablas `webhooks` y `webhook_deliveries` en BD

### 8. Migración de Base de Datos
- ✅ `supabase/migrations/049_new_features_tables.sql` - Todas las tablas nuevas (renombrado de 045)

---

## 📊 MÓDULOS AUDITADOS - 7 Diciembre 2025

### Módulos Verificados y Funcionando:
| Módulo | Estado | Notas |
|--------|--------|-------|
| Contacts | ✅ | CRUD completo, bulk actions, export |
| Leads | ✅ | Status corregido a cold/warm/hot/converted/lost |
| Opportunities | ✅ | Kanban, stage_id corregido |
| Pipeline | ✅ | Drag & drop, PATCH method |
| Sales | ✅ | Kanban alternativo con stage_id |
| Invoices | ✅ | CRUD, PDF, envío email |
| Quotes | ✅ | Stock check, conversión a factura |
| Tasks | ✅ | CRUD, bulk actions, prioridades |
| Products | ✅ | Inventario, stock |
| Tickets | ✅ | Soporte al cliente |
| Orders | ✅ | Pedidos |
| Accounts | ✅ | Cuentas empresariales |
| Calendar | ✅ | Eventos, booking público |
| Campaigns | ✅ | Marketing |
| Reports | ✅ | Builder de reportes |
| Analytics | ✅ | Dashboard métricas |
| Settings | ✅ | Configuración org |
| Team | ✅ | Gestión de equipo |
| Billing | ✅ | Suscripciones Stripe |
| Webhooks | ✅ | Integraciones |
| Profile | ✅ | Perfil usuario |
| Admin | ✅ | Super admin panel |
| Auth | ✅ | Login, OAuth callback |
| Workflows | ✅ | Automatizaciones |

### APIs Verificadas:
- ✅ Todas las APIs usan multi-tenant con `organization_id`
- ✅ RLS policies activas
- ✅ Rate limiting implementado
- ✅ Error handling consistente
- ✅ Audit logging

### Componentes Verificados (Sesión 2):
- ✅ `app/components/tickets/tickets-table.tsx` - PUT correcto
- ✅ `app/components/orders/orders-table.tsx` - PUT correcto
- ✅ `app/components/accounts/accounts-table.tsx` - URL corregida
- ✅ `components/integrations/integrations-grid.tsx` - PUT correcto
- ✅ `components/notes/notes-panel.tsx` - PUT correcto
- ✅ `components/quotes/quote-dialog.tsx` - PATCH correcto
- ✅ `components/tasks/task-dialog.tsx` - PATCH correcto
- ✅ `components/contacts/contact-dialog.tsx` - Verificado
- ✅ `components/workflows/workflow-dialog.tsx` - trigger_types corregidos
- ✅ `components/sales/kanban-board.tsx` - stage_id correcto
- ✅ `components/inventory/add-item-dialog.tsx` - PUT correcto

### Cron Jobs Verificados:
- ✅ `/api/cron/cleanup-auditoria` - Usa RPC `cleanup_auditoria`
- ✅ `/api/cron/expire-quotes` - Usa RPC `expire_old_quotes`
- ✅ `/api/cron/cleanup-analytics-cache` - Usa RPC `cleanup_analytics_cache_ttl`
- ✅ `/api/cron/cleanup-cache` - Usa RPC `cleanup_analytics_cache`
- ✅ `/api/cron/process-events` - Usa `processWebhookEvents`

### Bulk APIs Verificadas:
- ✅ `/api/contacts/bulk` - PATCH y DELETE
- ✅ `/api/tasks/bulk` - PATCH y DELETE
- ✅ `/api/tickets/bulk` - PATCH y DELETE
- ✅ `/api/products/bulk` - PATCH y DELETE
- ✅ `/api/invoices/bulk` - PATCH y DELETE

---

## 🟡 PENDIENTE (Nice to Have)

### Rate Limiting Distribuido
- Actualmente usa Map en memoria
- Para producción con múltiples instancias, migrar a Redis/Upstash

### Sincronización OAuth
- Gmail/Outlook requieren configurar OAuth en Google Cloud / Azure
- Implementar flujo de conexión de cuentas

### Firma Electrónica
- Integración con DocuSign o similar para firmar cotizaciones

---

## 📋 NOTAS PARA PRODUCCIÓN

### Variables de Entorno Requeridas
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=CRM <noreply@tudominio.com>

# App
NEXT_PUBLIC_APP_URL=https://tudominio.com

# WhatsApp (opcional)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=

# Google Calendar (opcional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### PWA - Iconos Requeridos
Crear iconos en `/public/icons/`:
- icon-72x72.png a icon-512x512.png

### Comandos
```bash
# Desarrollo
pnpm dev

# Tests
pnpm vitest run

# Build
pnpm build

# Migraciones
supabase db push
```

### Nuevas Rutas Disponibles
- `/pipeline` - Vista Kanban de oportunidades
- `/reports/builder` - Constructor de reportes
- `/settings/webhooks` - Configuración de webhooks
- `/book/[configId]` - Página pública de booking
- `/api/docs` - Documentación API (Swagger UI)
