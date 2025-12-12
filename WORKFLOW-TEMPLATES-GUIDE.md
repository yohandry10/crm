# 📝 Guía de Variables de Template en Workflows

## 🎯 ¿Qué son las Variables de Template?

Las variables de template te permiten usar **datos dinámicos** en tus workflows en lugar de valores estáticos.

**Sintaxis:** `{{nombre.de.variable}}`

## 📚 Ejemplos Básicos

### ✉️ Enviar Email Personalizado

**ANTES (estático):**
```json
{
  "type": "send_email",
  "params": {
    "to": "cliente@email.com",
    "subject": "Bienvenido",
    "body": "Gracias por registrarte"
  }
}
```

**DESPUÉS (dinámico):**
```json
{
  "type": "send_email",
  "params": {
    "to": "{{contact.email}}",
    "subject": "Bienvenido {{contact.full_name}}!",
    "body": "Hola {{contact.full_name}}, tu puntuación actual es {{contact.lead_score}}/100"
  }
}
```

### 📊 Actualizar Lead Score Dinámicamente

```json
{
  "type": "update_lead_score",
  "params": {
    "score": "{{contact.lead_score}}",
    "contactId": "{{contact.id}}"
  }
}
```

### ✅ Crear Tarea con Datos del Contexto

```json
{
  "type": "create_task",
  "params": {
    "title": "Seguimiento: {{contact.full_name}}",
    "description": "Contactar a {{contact.email}} sobre oportunidad de {{opportunity.value}}",
    "priority": "high",
    "contactId": "{{contact.id}}"
  }
}
```

## 🗂️ Variables Disponibles por Trigger

### `contact.created` / `contact.updated`
```javascript
{
  contact: {
    id: "uuid",
    email: "cliente@email.com",
    full_name: "Juan Pérez",
    phone: "+51 999 999 999",
    lead_score: 75,
    status: "new",
    company: "Empresa S.A.",
    tags: ["premium", "latam"]
  }
}
```

**Ejemplos:**
- `{{contact.email}}` → "cliente@email.com"
- `{{contact.full_name}}` → "Juan Pérez"
- `{{contact.lead_score}}` → 75
- `{{contact.company}}` → "Empresa S.A."

### `invoice.created` / `invoice.paid`
```javascript
{
  invoice: {
    id: "uuid",
    invoice_number: "INV-001",
    total: 1500.00,
    currency: "PEN",
    status: "paid",
    due_date: "2025-01-15"
  },
  contact: {
    id: "uuid",
    email: "cliente@email.com",
    full_name: "María García"
  }
}
```

**Ejemplos:**
- `{{invoice.invoice_number}}` → "INV-001"
- `{{invoice.total}}` → 1500.00
- `{{invoice.currency}}` → "PEN"
- `{{contact.full_name}}` → "María García"

### `opportunity.created` / `opportunity.updated`
```javascript
{
  opportunity: {
    id: "uuid",
    title: "Nuevo negocio - Empresa ABC",
    value: 50000,
    stage: "prospecting",
    probability: 20,
    expected_close_date: "2025-02-28"
  },
  contact: {
    id: "uuid",
    email: "contacto@empresa.com",
    full_name: "Carlos Rodríguez"
  }
}
```

**Ejemplos:**
- `{{opportunity.title}}` → "Nuevo negocio - Empresa ABC"
- `{{opportunity.value}}` → 50000
- `{{opportunity.probability}}` → 20
- `{{contact.email}}` → "contacto@empresa.com"

### `task.completed`
```javascript
{
  task: {
    id: "uuid",
    title: "Llamar al cliente",
    description: "Seguimiento de propuesta",
    completed_at: "2025-12-12T10:30:00Z"
  },
  contact: {
    id: "uuid",
    full_name: "Ana Torres"
  }
}
```

**Ejemplos:**
- `{{task.title}}` → "Llamar al cliente"
- `{{contact.full_name}}` → "Ana Torres"

## 🎨 Casos de Uso Avanzados

### 1. Email de Bienvenida Personalizado

**Trigger:** `contact.created`

```json
{
  "type": "send_email",
  "params": {
    "to": "{{contact.email}}",
    "subject": "¡Bienvenido/a {{contact.full_name}}!",
    "body": "<h1>Hola {{contact.full_name}}</h1><p>Gracias por unirte a nosotros. Tu puntuación inicial es {{contact.lead_score}}/100.</p><p>Empresa: {{contact.company}}</p>"
  }
}
```

### 2. Notificación de Factura Pagada

**Trigger:** `invoice.paid`

```json
{
  "type": "send_email",
  "params": {
    "to": "{{contact.email}}",
    "subject": "Pago recibido - Factura {{invoice.invoice_number}}",
    "body": "Estimado/a {{contact.full_name}}, hemos recibido el pago de {{invoice.total}} {{invoice.currency}} por la factura {{invoice.invoice_number}}. ¡Gracias!"
  }
}
```

### 3. Tarea Automática al Crear Oportunidad

**Trigger:** `opportunity.created`

```json
{
  "type": "create_task",
  "params": {
    "title": "Llamar: {{opportunity.title}}",
    "description": "Contactar a {{contact.full_name}} ({{contact.email}}) sobre oportunidad de {{opportunity.value}} {{invoice.currency}}. Probabilidad: {{opportunity.probability}}%",
    "priority": "high",
    "due_date": "{{opportunity.expected_close_date}}",
    "contactId": "{{contact.id}}"
  }
}
```

### 4. Actualizar Score Basado en Acción

**Trigger:** `task.completed`

```json
{
  "type": "update_lead_score",
  "params": {
    "score": 90,
    "contactId": "{{contact.id}}"
  }
}
```

### 5. Webhook con Datos Dinámicos

**Trigger:** `invoice.paid`

```json
{
  "type": "webhook",
  "params": {
    "url": "https://api.externa.com/notifications",
    "method": "POST",
    "body": {
      "event": "payment_received",
      "invoice_number": "{{invoice.invoice_number}}",
      "amount": "{{invoice.total}}",
      "customer_email": "{{contact.email}}",
      "customer_name": "{{contact.full_name}}"
    }
  }
}
```

## ⚙️ Funcionalidades del Motor de Templates

### ✅ Soporta:
- ✓ Propiedades simples: `{{contact.email}}`
- ✓ Propiedades anidadas: `{{contact.company.name}}`
- ✓ Números: `{{invoice.total}}` → 1500.00
- ✓ Strings: `{{contact.full_name}}` → "Juan Pérez"
- ✓ Objetos (se convierten a JSON): `{{contact.tags}}` → ["premium"]

### ❌ Limitaciones:
- ✗ No soporta operaciones: `{{contact.lead_score + 10}}` (usar condiciones en su lugar)
- ✗ No soporta condicionales inline: `{{contact.status == 'new' ? 'Nuevo' : 'Existente'}}`
- ✗ Las variables no encontradas se mantienen sin cambios: `{{variable.inexistente}}` → "{{variable.inexistente}}"

## 🔍 Variables Globales Disponibles

En **todos** los workflows tienes acceso a:

```javascript
{
  organization_id: "uuid-de-organizacion",
  user_id: "uuid-del-usuario",
  timestamp: "2025-12-12T10:30:00Z"
}
```

**Ejemplos:**
- `{{organization_id}}` → ID de tu organización
- `{{user_id}}` → ID del usuario que disparó el evento
- `{{timestamp}}` → Fecha y hora del evento

## 📋 Mejores Prácticas

### ✅ DO:
- Usar variables descriptivas y claras
- Validar que las variables existan antes de usarlas en workflows críticos
- Usar placeholders con valores por defecto cuando sea posible

### ❌ DON'T:
- No asumir que una variable siempre existe (algunos contactos pueden no tener `company`)
- No usar variables en campos que requieren tipos específicos sin validación
- No exponer datos sensibles en logs o webhooks externos

## 🛠️ Testing de Variables

Para probar tus workflows con variables:

1. Ve a la página de Workflows
2. Selecciona tu workflow
3. Haz clic en "Ejecutar"
4. Proporciona datos de ejemplo en formato JSON:

```json
{
  "contact": {
    "email": "test@example.com",
    "full_name": "Usuario de Prueba",
    "lead_score": 80
  }
}
```

## 🚀 Próximas Funcionalidades

- [ ] Funciones de formato: `{{contact.full_name | uppercase}}`
- [ ] Operaciones matemáticas: `{{invoice.total * 1.18}}`
- [ ] Condicionales: `{{if contact.lead_score > 80}}Alta prioridad{{/if}}`
- [ ] Loops: `{{for tag in contact.tags}}{{tag}}{{/for}}`

---

**📚 Documentación Adicional:**
- [Workflow Constants](./lib/workflow-constants.ts) - Tipos de triggers y acciones
- [Workflow Validators](./lib/workflow-validators.ts) - Validación de parámetros
- [Workflow Executor](./lib/workflow-executor.ts) - Lógica de ejecución

**❓ ¿Necesitas ayuda?**
Consulta los ejemplos en `lib/workflow-templates.ts` o contacta al equipo de soporte.
