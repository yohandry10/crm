# Nuevas Funcionalidades CRM - Implementación Completa

## 1. Email Integration (Gmail/Outlook)

### Archivos creados:
- `lib/email-sync.ts` - Clientes para Gmail API y Microsoft Graph API
- `app/api/emails/sync/route.ts` - API para sincronizar y enviar emails

### Uso:
```typescript
// Obtener emails de un contacto
GET /api/emails/sync?contact_email=cliente@ejemplo.com

// Enviar email
POST /api/emails/sync
{
  "to": ["cliente@ejemplo.com"],
  "subject": "Asunto",
  "body": "Mensaje"
}
```

### Configuración requerida:
- Configurar OAuth en Google Cloud Console / Azure Portal
- Agregar variables de entorno para tokens

---

## 2. WhatsApp Business API

### Archivos creados:
- `lib/whatsapp.ts` - Integración con Meta Cloud API
- `app/api/whatsapp/send/route.ts` - API de envío
- `components/contacts/whatsapp-button.tsx` - Botón con mensajes rápidos

### Uso:
```typescript
// Enviar mensaje
POST /api/whatsapp/send
{
  "to": "51999999999",
  "type": "text",
  "content": "Hola, ¿cómo estás?"
}

// Generar link de WhatsApp
GET /api/whatsapp/send?phone=51999999999&message=Hola
```

### Configuración:
```env
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id
WHATSAPP_ACCESS_TOKEN=tu_access_token
```

---

## 3. Calendario con Sistema de Booking

### Archivos creados:
- `lib/calendar.ts` - Google Calendar client + booking system
- `app/api/calendar/events/route.ts` - CRUD de eventos
- `app/api/calendar/events/[id]/route.ts` - Evento individual
- `app/api/calendar/booking/route.ts` - Sistema de reservas
- `app/book/[configId]/page.tsx` - Página pública de booking

### Uso:
```typescript
// Crear evento
POST /api/calendar/events
{
  "title": "Reunión con cliente",
  "start": "2024-12-10T10:00:00Z",
  "end": "2024-12-10T11:00:00Z",
  "contact_id": "uuid"
}

// Obtener slots disponibles (público)
GET /api/calendar/booking?config_id=uuid&date=2024-12-10

// Reservar cita (público)
POST /api/calendar/booking
{
  "config_id": "uuid",
  "slot_start": "2024-12-10T10:00:00Z",
  "name": "Juan Pérez",
  "email": "juan@ejemplo.com"
}
```

### Página de booking:
- URL: `/book/[configId]`
- Pública, no requiere autenticación
- Muestra calendario y slots disponibles

---

## 4. Pipeline Kanban

### Archivos creados:
- `components/opportunities/kanban-board.tsx` - Board drag & drop
- `components/opportunities/opportunity-dialog.tsx` - Diálogo CRUD
- `app/pipeline/page.tsx` - Página de pipeline

### Características:
- Drag & drop entre etapas
- Cálculo automático de valor ponderado
- Filtros por vendedor
- Métricas en tiempo real

### Etapas predefinidas:
1. Prospección (10%)
2. Calificación (25%)
3. Propuesta (50%)
4. Negociación (75%)
5. Ganado (100%)
6. Perdido (0%)

---

## 5. Lead Scoring con IA

### Archivos creados:
- `lib/lead-scoring.ts` - Algoritmo de scoring
- `app/api/contacts/[id]/score/route.ts` - API de cálculo
- `components/contacts/lead-score-badge.tsx` - Badge visual

### Factores de scoring:
- **Demográfico (0-25)**: Email, teléfono, empresa, cargo
- **Engagement (0-35)**: Emails, visitas, reuniones
- **Comportamiento (0-25)**: Tiempo de respuesta, frecuencia
- **Fit (0-15)**: Presupuesto, decisor, timeline

### Uso:
```typescript
// Calcular score de un contacto
POST /api/contacts/{id}/score

// Respuesta
{
  "score": 75,
  "grade": "B",
  "breakdown": { "demographic": 20, "engagement": 25, ... },
  "recommendations": ["Proponer una llamada"],
  "nextBestAction": "Enviar propuesta comercial"
}
```

---

## 6. Generador de PDFs

### Archivos creados:
- `lib/pdf-generator.ts` - Generador HTML para cotizaciones/facturas
- `app/api/pdf/quote/route.ts` - API de generación

### Uso:
```typescript
// Generar PDF de cotización
GET /api/pdf/quote?quote_id=uuid

// Generar PDF de factura
GET /api/pdf/quote?invoice_id=uuid
```

### Características:
- Diseño profesional
- Datos de empresa y cliente
- Tabla de items con descuentos
- Totales con IGV
- Área de firmas

---

## 7. API Documentada (OpenAPI/Swagger)

### Archivos creados:
- `lib/openapi-spec.ts` - Especificación OpenAPI 3.0
- `app/api/docs/route.ts` - Swagger UI

### Acceso:
- **Swagger UI**: `GET /api/docs`
- **JSON spec**: `GET /api/docs?format=json`
- **YAML spec**: `GET /api/docs?format=yaml`

### Endpoints documentados:
- Contacts
- Leads
- Opportunities
- Invoices
- Tasks
- Webhooks

---

## 8. Reportes Avanzados

### Archivos creados:
- `app/reports/builder/page.tsx` - Constructor de reportes
- `app/api/reports/run/route.ts` - Ejecución de reportes
- `app/api/reports/saved/route.ts` - Reportes guardados
- `app/api/reports/export/route.ts` - Exportación CSV/Excel

### Características:
- Selección de entidad (Contactos, Oportunidades, Facturas, Tareas)
- Múltiples métricas
- Agrupación flexible
- Filtros por período
- Exportación a CSV/Excel
- Guardar reportes favoritos

---

## 9. Sistema de Webhooks

### Archivos creados:
- `app/api/webhooks/route.ts` - CRUD de webhooks
- `app/api/webhooks/[id]/route.ts` - Webhook individual + test
- `app/settings/webhooks/page.tsx` - UI de configuración

### Eventos disponibles:
- `contact.created`, `contact.updated`, `contact.deleted`
- `lead.created`, `lead.converted`
- `opportunity.created`, `opportunity.won`, `opportunity.lost`
- `invoice.created`, `invoice.paid`
- `task.created`, `task.completed`

### Seguridad:
- Firma HMAC-SHA256 en header `X-Webhook-Signature`
- Secret único por webhook
- Logs de entregas

---

## Migración de Base de Datos

Archivo: `supabase/migrations/045_new_features_tables.sql`

### Tablas creadas:
- `whatsapp_messages` - Historial de mensajes WhatsApp
- `calendar_events` - Eventos del calendario
- `booking_configs` - Configuraciones de booking
- `webhooks` - Webhooks configurados
- `webhook_deliveries` - Log de entregas
- `email_accounts` - Cuentas de email conectadas
- `synced_emails` - Emails sincronizados
- `saved_reports` - Reportes guardados

### Campos agregados a contacts:
- `lead_score` - Puntuación del lead
- `lead_score_factors` - Desglose del score
- `last_interaction_at` - Última interacción

---

## Navegación Actualizada

Nuevas rutas en el sidebar:
- `/pipeline` - Vista Kanban de oportunidades
- `/reports/builder` - Constructor de reportes

Nuevas rutas en settings:
- `/settings/webhooks` - Configuración de webhooks

Rutas públicas:
- `/book/[configId]` - Página de booking
- `/api/docs` - Documentación API
