> Esta documentación fue consolidada en `DOCUMENTACION.md#dependency-checker-delete-seguro`.

# Verificación de Dependencias - Guía Rápida

## 🚀 Quick Start

### Backend (Ya implementado)

```typescript
// En DELETE endpoint
const { checkDependencies } = await import('@/lib/dependency-checker')
const dependencyCheck = await checkDependencies(supabase, 'contacts', id, organizationId)

if (dependencyCheck.hasDependencies) {
    return NextResponse.json({
        success: false,
        error: "No se puede eliminar este contacto porque tiene registros relacionados",
        dependencies: dependencyCheck.dependencies
    }, { status: 409 })
}
```

### Frontend (A implementar)

```typescript
const response = await fetch(`/api/contacts/${id}`, { method: 'DELETE' })

if (response.status === 409) {
    const data = await response.json()
    alert(`No se puede eliminar: ${data.error}`)
    console.log(data.dependencies)
}
```

---

## 📋 Checklist de Integración Frontend

- [ ] Manejar status code 409 en función de eliminación
- [ ] Mostrar mensaje de error al usuario
- [ ] Listar dependencias encontradas
- [ ] Proporcionar botón "Entendido" o "Cancelar"
- [ ] Opcional: Mostrar links para ir a resolver dependencias
- [ ] Opcional: Agregar confirmación adicional para eliminaciones

---

## 🎯 Entidades Soportadas

| Entidad | Endpoint | Dependencias Verificadas |
|---------|----------|-------------------------|
| **Contacts** | `/api/contacts/[id]` | 10 tipos |
| **Opportunities** | `/api/opportunities/[id]` | 5 tipos |
| **Products** | `/api/products/[id]` | 2 tipos |
| **Campaigns** | `/api/campaigns/[id]` | 2 tipos |

---

## 📊 Respuestas de la API

### ✅ Éxito (Sin dependencias)
```json
{ "success": true }
```
**Status:** `200 OK`

### ❌ Con dependencias
```json
{
  "success": false,
  "error": "No se puede eliminar...",
  "dependencies": [
    { "table": "invoices", "count": 3, "displayName": "Facturas" }
  ]
}
```
**Status:** `409 Conflict`

---

## 🔧 Funciones Disponibles

### `checkDependencies(supabase, entityType, entityId, organizationId)`
```typescript
const result = await checkDependencies(supabase, 'contacts', id, orgId)
// Returns: { hasDependencies: boolean, dependencies: Array }
```

### `formatDependencyError(result, entityType)`
```typescript
const message = formatDependencyError(result, 'contacts')
// Returns: "No se puede eliminar este contacto porque..."
```

### `checkDependenciesOrThrow(supabase, entityType, entityId, organizationId)`
```typescript
try {
  await checkDependenciesOrThrow(supabase, 'contacts', id, orgId)
} catch (error) {
  // error.statusCode === 409
  // error.dependencies === [...]
}
```

---

## 💾 Dependencias por Tipo

### Contacts
```
✓ Facturas (invoices)
✓ Oportunidades (opportunities)
✓ Cotizaciones (quotes)
✓ Tareas (tasks)
✓ Actividades (activities)
✓ Interacciones (interactions)
✓ Eventos de calendario (calendar_events)
✓ Correos sincronizados (synced_emails)
✓ Mensajes de WhatsApp (whatsapp_messages)
✓ Documentos (documents)
```

### Opportunities
```
✓ Cotizaciones (quotes)
✓ Productos de oportunidad (opportunity_products)
✓ Eventos de calendario (calendar_events)
✓ Actividades (activities)
✓ Tareas automatizadas (tasks)
```

### Products
```
✓ Items en facturas (invoice_items)
✓ Items en cotizaciones (quote_items)
```

### Campaigns
```
✓ Contactos de campaña (campaign_contacts)
✓ Contactos asociados (contacts)
```

---

## 🎨 Ejemplos de UI

### Modal Simple
```tsx
if (response.status === 409) {
  const deps = data.dependencies
    .map(d => `${d.displayName} (${d.count})`)
    .join(', ')

  showModal({
    title: 'No se puede eliminar',
    message: `Tiene dependencias: ${deps}`
  })
}
```

### Toast Notification
```tsx
import { toast } from 'sonner'

if (response.status === 409) {
  toast.error(data.error, {
    description: data.dependencies
      .map(d => `${d.displayName}: ${d.count}`)
      .join('\n')
  })
}
```

### Alert Nativo
```typescript
if (response.status === 409) {
  const list = data.dependencies
    .map((d: any) => `- ${d.displayName}: ${d.count}`)
    .join('\n')

  alert(`No se puede eliminar\n\n${list}`)
}
```

---

## 🧪 Testing Rápido

### 1. Test Sin Dependencias
```bash
# Crear y eliminar inmediatamente
POST /api/contacts { "name": "Test" }
DELETE /api/contacts/{id}
# Expect: 200 OK
```

### 2. Test Con Dependencias
```bash
# Crear contacto
POST /api/contacts { "name": "Test" }

# Crear factura para ese contacto
POST /api/invoices { "contact_id": "{id}", "total": 100 }

# Intentar eliminar contacto
DELETE /api/contacts/{id}
# Expect: 409 Conflict
```

---

## 📁 Archivos del Sistema

```
lib/
  ├── dependency-checker.ts          # Biblioteca principal
  └── __tests__/
      └── dependency-checker.test.ts # Tests unitarios

app/api/
  ├── contacts/[id]/route.ts         # ✅ Implementado
  ├── opportunities/[id]/route.ts    # ✅ Implementado
  ├── products/[id]/route.ts         # ✅ Implementado
  └── campaigns/[id]/route.ts        # ✅ Implementado

docs/
  ├── DEPENDENCY_CHECKER_IMPLEMENTATION.md  # Docs técnicas
  ├── DEPENDENCY_CHECKER_SUMMARY.md         # Resumen
  ├── DEPENDENCY_CHECKER_EXAMPLES.md        # Ejemplos código
  └── DEPENDENCY_CHECKER_QUICK_REFERENCE.md # Esta guía
```

---

## 🔍 Debugging

### Verificar en Consola del Navegador
```javascript
const res = await fetch('/api/contacts/YOUR_ID', { method: 'DELETE' })
const data = await res.json()
console.log('Status:', res.status)
console.table(data.dependencies)
```

### Logs del Servidor
Los errores se registran automáticamente:
```typescript
console.error(`Error checking dependencies in ${table}:`, error)
```

---

## ⚡ Performance

- ✅ Solo cuenta registros (no los trae)
- ✅ Filtrado en base de datos
- ✅ Resiliente a errores
- ✅ Multi-tenant isolation

---

## 🔐 Seguridad

- ✅ Requiere autenticación
- ✅ Verifica organization_id
- ✅ Rate limiting heredado
- ✅ Errores sanitizados

---

## 📞 Soporte

**Archivos de documentación:**
- Implementación técnica: `DEPENDENCY_CHECKER_IMPLEMENTATION.md`
- Ejemplos de código: `DEPENDENCY_CHECKER_EXAMPLES.md`
- Resumen completo: `DEPENDENCY_CHECKER_SUMMARY.md`

**Tests:**
```bash
npm test lib/__tests__/dependency-checker.test.ts
```

---

**Versión:** 1.0.0 | **Última actualización:** 2025-12-13
