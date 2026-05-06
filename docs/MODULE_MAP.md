# Mapa de modulos

Este mapa describe el estado funcional observado desde `app/`, `components/` y `app/api/`.

| Dominio | UI principal | API asociada | Notas |
| --- | --- | --- | --- |
| Shell/Auth | `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback` | `/api/auth/*`, `/api/invitations/*`, `/api/profile` | Revisar auth, rate limit y onboarding juntos. |
| Dashboard/BI | `/dashboard`, `/analytics`, `/reports`, `/reports/builder` | `/api/dashboard`, `/api/analytics/*`, `/api/reports/*` | Reportes usan contrato compartido; advanced analytics queda deshabilitado hasta tener datos reales. |
| CRM core | `/contacts`, `/accounts`, `/leads`, `/pipeline`, `/sales` | `/api/contacts/*`, `/api/accounts/*`, `/api/opportunities/*`, `/api/pipeline-stages`, `/api/lead-sources`, `/api/activity`, `/api/activities` | Leads son contactos filtrados; pipeline/sales/opportunities deben documentarse como un solo dominio. |
| Ventas/revenue | `/quotes`, `/invoicing/*`, `/orders`, `/pay/[token]` | `/api/quotes/*`, `/api/invoices/*`, `/api/orders/*`, `/api/pay/*`, `/api/payments/*`, `/api/payment-links`, `/api/comprobantes` | Riesgo alto en pagos, tokens, idempotencia y PDF/envio. |
| Catalogo/stock | `/products`, `/inventory` | `/api/products/*`, `/api/inventory/*` | `/inventory` redirige a productos; decidir si mantener API inventory como fachada. |
| Marketing | `/campaigns`, `/forms`, `/forms/[id]/submissions`, `/f/[slug]` | `/api/campaigns/*`, `/api/forms/*`, `/api/public/forms/*` | Public forms necesitan allowlists, rate limit y antispam. |
| Calendario | `/calendar`, `/book/[configId]` | `/api/calendar/events/*`, `/api/calendar/booking`, `/api/events/*` legacy | `calendar_events` es canonico; `/api/events` queda como compatibilidad. |
| Soporte/trabajo | `/tasks`, `/tickets`, `/inbox` | `/api/tasks/*`, `/api/tickets/*`, `/api/chat/*`, `/api/notes/*`, `/api/notifications` | Inbox usa chat, no `/api/inbox`; tasks/tickets/inbox ya validan referencias de tenant antes de escribir. |
| Automatizacion/integraciones | `/workflows`, `/workflows/[id]/builder`, `/integrations`, `/settings/webhooks`, `/ai` | `/api/workflows/*`, `/api/jobs/*`, `/api/integrations/*`, `/api/webhooks/*`, `/api/ai/chat`, `/api/mcp/server`, `/api/whatsapp/send`, `/api/emails/sync` | Unificar motores workflow y operacion worker. |
| Organizacion/admin/settings | `/settings/*`, `/admin/*`, `/onboarding` | `/api/settings`, `/api/team/*`, `/api/subscriptions/*`, `/api/organizations/*`, `/api/admin/*`, `/api/onboarding/complete` | Alta sensibilidad multi-tenant y platform admin. |
| Operacional | Sin UI directa | `/api/cron/*`, `/api/health`, `/api/upload`, `/api/search`, `/api/docs`, `/api/v1/version` | Cron y diagnostico requieren proteccion y contrato claro. |

## Inconsistencias a resolver

- Existe tabla historica `events`; la UI ya consume `calendar_events` y falta decidir migracion/retiro de datos legacy.
- `/api/v1/version` solo expone metadata; los recursos siguen en rutas `/api/*` no versionadas.
- OpenAPI debe mantenerse sin `/v1` hasta que existan recursos versionados reales.
- `/sales` redirige a `/pipeline`, mientras la API real es opportunities.
- `/inventory` redirige a productos, pero la API inventory sigue viva.
- `/api/activity` y `/api/activities` son nombres demasiado cercanos para modelos distintos.
- `/api/analytics/advanced` responde `501` hasta conectarse a datos reales; `/api/admin/bull-board` tiene comportamiento placeholder/informativo.
- `system_notifications` globales no tienen lectura por usuario; falta definir si se acepta lectura global o se normaliza con tabla puente.

## Decision pendiente

Definir nombres canonicos por dominio antes de hacer mas documentacion o tests contractuales.
