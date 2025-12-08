# Plan de Integraciones CRM

## Estado Actual del CRM

### ✅ Módulos Completados (17):
| Módulo | Estado |
|--------|--------|
| Contactos/Leads | ✅ |
| Cuentas/Empresas | ✅ |
| Pipeline/Ventas | ✅ |
| Cotizaciones | ✅ |
| Facturación | ✅ |
| Pedidos | ✅ |
| Inventario | ✅ |
| Productos | ✅ |
| Tareas | ✅ |
| Calendario | ✅ |
| Tickets | ✅ |
| Campañas | ✅ |
| Workflows | ✅ |
| Reportes/Analytics | ✅ |
| Configuración | ✅ |
| Admin Multi-tenant | ✅ |
| Suscripciones/Stripe | ✅ |

---

## 🔴 PRIORIDAD ALTA - En Desarrollo

### 1. Formularios Web Embebibles
**Objetivo:** Capturar leads desde cualquier web sin depender de Typeform/Google Forms

#### Tareas:
- [x] Migración BD: tabla `web_forms` y `form_submissions`
- [x] API: `/api/forms` - CRUD de formularios
- [x] API: `/api/public/forms/[id]` - Obtener formulario (público)
- [x] API: `/api/public/forms/[id]/submit` - Enviar formulario (público)
- [x] UI: Página `/forms` - Lista de formularios
- [x] UI: Constructor de formularios (campos configurables)
- [x] UI: Vista previa del formulario
- [x] Generador de código embed (`<script>` o `<iframe>`)
- [x] Página pública `/f/[slug]` para embeber
- [x] Crear contacto automático al enviar
- [x] Trigger de workflow `form.submitted`
- [x] Tracking UTM (source, medium, campaign)
- [x] Ver envíos con detalle

#### Campos soportados:
- Texto corto
- Texto largo
- Email
- Teléfono
- Número
- Selección única
- Selección múltiple
- Fecha
- Checkbox (términos)

---

### 2. Email Integrado (Bandeja de Entrada)
**Objetivo:** Ver y enviar emails desde el CRM sin depender de Gmail/Outlook

#### Tareas:
- [ ] Migración BD: tablas `email_accounts`, `emails`, `email_threads`
- [ ] API: `/api/email/accounts` - Conectar cuentas (OAuth Gmail/Outlook)
- [ ] API: `/api/email/sync` - Sincronizar emails
- [ ] API: `/api/email/send` - Enviar email
- [ ] UI: Página `/emails` - Bandeja de entrada
- [ ] UI: Composer de email
- [ ] Vincular emails a contactos automáticamente
- [ ] Historial de emails en ficha de contacto

#### Integraciones:
- Gmail API (OAuth 2.0)
- Microsoft Graph API (Outlook)
- IMAP/SMTP genérico

---

## 🟡 PRIORIDAD MEDIA - Próximos

### 3. Chat en Vivo / Widget
**Objetivo:** Chat para tu web que llega al CRM

#### Tareas:
- [ ] Migración BD: tablas `chat_widgets`, `chat_conversations`, `chat_messages`
- [ ] API: WebSocket para chat en tiempo real
- [ ] Widget JS embebible
- [ ] UI: Panel de conversaciones en CRM
- [ ] Crear contacto desde chat
- [ ] Asignar conversaciones a agentes

---

### 4. WhatsApp Business API
**Objetivo:** Enviar/recibir WhatsApp desde el CRM

#### Tareas:
- [ ] Integración con Meta Cloud API
- [ ] Webhook para mensajes entrantes
- [ ] UI: Conversaciones de WhatsApp
- [ ] Templates de mensajes aprobados
- [ ] Historial en ficha de contacto

**Nota:** Requiere cuenta de WhatsApp Business verificada (~$0.05/mensaje)

---

### 5. Agenda de Citas Pública
**Objetivo:** Que clientes agenden solos (como Calendly)

#### Tareas:
- [ ] Migración BD: tabla `booking_pages`, `availability_slots`
- [ ] API: `/api/public/book/[slug]` - Página pública de agenda
- [ ] UI: Configurar disponibilidad
- [ ] UI: Página pública de reserva
- [ ] Crear evento + contacto automático
- [ ] Enviar confirmación por email

---

## 🟢 PRIORIDAD BAJA - Backlog

### 6. Base de Conocimiento
- Artículos/FAQs públicos
- Búsqueda
- Categorías
- Vincular a tickets

### 7. Portal de Cliente
- Login de clientes
- Ver facturas
- Ver tickets
- Descargar cotizaciones

### 8. Firma Electrónica
- Firmar cotizaciones digitalmente
- Validez legal
- Historial de firmas

---

## Webhook n8n (Ya implementado)

### Acciones disponibles:
| Action | Descripción |
|--------|-------------|
| `create_contact` | Crear contacto nuevo |
| `update_contact` | Actualizar datos de contacto |
| `update_lead_score` | Cambiar puntuación del lead |
| `update_lead_status` | Cambiar estado (cold/warm/hot/converted) |
| `create_task` | Crear tarea asignada |
| `add_note` | Agregar nota a un contacto |
| `log_activity` | Registrar actividad (llamada, email, reunión) |
| `update_order_status` | Actualizar estado de orden |
| `create_ticket` | Crear ticket de soporte |

### Endpoint:
```
POST /api/webhooks/n8n
Headers: { "x-n8n-secret": "tu_secret" }
```

---

## Progreso General

| Integración | Progreso |
|-------------|----------|
| Formularios Web | ✅ 100% |
| Email Integrado | ⬜ 0% |
| Chat en Vivo | ⬜ 0% |
| WhatsApp | ⬜ 0% |
| Agenda Pública | ⬜ 0% |
| Base Conocimiento | ⬜ 0% |
| Portal Cliente | ⬜ 0% |
| Firma Electrónica | ⬜ 0% |

---

## Archivos Creados - Formularios Web

### Base de Datos
- `supabase/migrations/051_web_forms.sql`

### APIs
- `app/api/forms/route.ts` - GET (listar), POST (crear)
- `app/api/forms/[id]/route.ts` - GET, PUT, DELETE
- `app/api/forms/[id]/submissions/route.ts` - GET envíos
- `app/api/public/forms/[id]/route.ts` - GET formulario público
- `app/api/public/forms/[id]/submit/route.ts` - POST enviar formulario

### Frontend
- `app/forms/page.tsx` - Lista de formularios
- `app/forms/[id]/submissions/page.tsx` - Ver envíos
- `app/f/[slug]/page.tsx` - Formulario público embebible
- `components/forms/form-dialog.tsx` - Crear/editar formulario
- `components/forms/embed-code-dialog.tsx` - Código para embeber

### Middleware
- `middleware.ts` - Actualizado con rutas `/f` y `/api/forms`
