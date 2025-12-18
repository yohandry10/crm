> Esta documentación fue consolidada en `DOCUMENTACION.md#dependency-checker-delete-seguro`.

# Ejemplos Prácticos del Sistema de Verificación de Dependencias

## 🎯 Escenarios de Uso

### Escenario 1: Eliminar un Contacto sin Dependencias

**Request:**
```http
DELETE /api/contacts/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true
}
```
**Status:** 200 OK

✅ **Resultado:** El contacto se eliminó exitosamente

---

### Escenario 2: Intentar Eliminar un Contacto con Facturas

**Contexto:**
- Contacto: "Juan Pérez"
- 3 Facturas asociadas
- 2 Oportunidades abiertas

**Request:**
```http
DELETE /api/contacts/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": false,
  "error": "No se puede eliminar este contacto porque tiene registros relacionados",
  "dependencies": [
    {
      "table": "invoices",
      "count": 3,
      "displayName": "Facturas"
    },
    {
      "table": "opportunities",
      "count": 2,
      "displayName": "Oportunidades"
    }
  ]
}
```
**Status:** 409 Conflict

❌ **Resultado:** La eliminación fue bloqueada

**Acción sugerida:** Eliminar o reasignar las 3 facturas y 2 oportunidades primero

---

### Escenario 3: Eliminar una Oportunidad con Cotizaciones

**Contexto:**
- Oportunidad: "Venta Empresa ABC - $50,000"
- 2 Cotizaciones generadas
- 5 Productos asociados

**Request:**
```http
DELETE /api/opportunities/234e5678-e89b-12d3-a456-426614174001
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": false,
  "error": "No se puede eliminar esta oportunidad porque tiene registros relacionados",
  "dependencies": [
    {
      "table": "quotes",
      "count": 2,
      "displayName": "Cotizaciones"
    },
    {
      "table": "opportunity_products",
      "count": 5,
      "displayName": "Productos de la oportunidad"
    }
  ]
}
```
**Status:** 409 Conflict

❌ **Resultado:** La eliminación fue bloqueada

---

### Escenario 4: Eliminar un Producto Usado en Facturas

**Contexto:**
- Producto: "Laptop Dell XPS 15"
- 7 Items en facturas
- 3 Items en cotizaciones

**Request:**
```http
DELETE /api/products/345e6789-e89b-12d3-a456-426614174002
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": false,
  "error": "No se puede eliminar este producto porque tiene registros relacionados",
  "dependencies": [
    {
      "table": "invoice_items",
      "count": 7,
      "displayName": "Items en facturas"
    },
    {
      "table": "quote_items",
      "count": 3,
      "displayName": "Items en cotizaciones"
    }
  ]
}
```
**Status:** 409 Conflict

❌ **Resultado:** La eliminación fue bloqueada

---

### Escenario 5: Eliminar una Campaña Activa

**Contexto:**
- Campaña: "Black Friday 2024"
- 150 Contactos en la campaña
- 45 Contactos marcados como originados de esta campaña

**Request:**
```http
DELETE /api/campaigns/456e7890-e89b-12d3-a456-426614174003
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": false,
  "error": "No se puede eliminar esta campaña porque tiene registros relacionados",
  "dependencies": [
    {
      "table": "campaign_contacts",
      "count": 150,
      "displayName": "Contactos de la campaña"
    },
    {
      "table": "contacts",
      "count": 45,
      "displayName": "Contactos asociados"
    }
  ]
}
```
**Status:** 409 Conflict

❌ **Resultado:** La eliminación fue bloqueada

---

## 💻 Ejemplos de Código Frontend

### React con TypeScript + Sonner Toast

```typescript
import { toast } from 'sonner'

interface DeleteContactProps {
  contactId: string
  onSuccess: () => void
}

async function deleteContact({ contactId, onSuccess }: DeleteContactProps) {
  try {
    const response = await fetch(`/api/contacts/${contactId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    // Caso: Dependencias encontradas
    if (response.status === 409) {
      const dependenciesList = data.dependencies
        .map((dep: any) => `${dep.displayName}: ${dep.count}`)
        .join('\n')

      toast.error('No se puede eliminar el contacto', {
        description: dependenciesList,
        duration: 5000,
      })
      return
    }

    // Caso: Error general
    if (!response.ok) {
      toast.error('Error al eliminar', {
        description: data.error || 'Ocurrió un error inesperado',
      })
      return
    }

    // Caso: Éxito
    toast.success('Contacto eliminado exitosamente')
    onSuccess()
  } catch (error) {
    toast.error('Error de conexión', {
      description: 'No se pudo conectar con el servidor',
    })
  }
}
```

### React con Modal de Confirmación

```typescript
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Dependency {
  table: string
  count: number
  displayName: string
}

interface DeleteConfirmationProps {
  contactId: string
  contactName: string
  onSuccess: () => void
}

function DeleteConfirmation({ contactId, contactName, onSuccess }: DeleteConfirmationProps) {
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [showDependencies, setShowDependencies] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.status === 409) {
        setDependencies(data.dependencies)
        setShowDependencies(true)
        return
      }

      if (response.ok) {
        onSuccess()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Button
        onClick={handleDelete}
        disabled={isDeleting}
        variant="destructive"
      >
        {isDeleting ? 'Eliminando...' : 'Eliminar Contacto'}
      </Button>

      <Dialog open={showDependencies} onOpenChange={setShowDependencies}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No se puede eliminar "{contactName}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Este contacto tiene registros relacionados que deben eliminarse primero:
            </p>
            <ul className="space-y-1">
              {dependencies.map((dep) => (
                <li key={dep.table} className="flex justify-between text-sm">
                  <span>{dep.displayName}</span>
                  <span className="font-semibold">{dep.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <Button onClick={() => setShowDependencies(false)}>
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

### Vue.js 3 con Composition API

```typescript
import { ref } from 'vue'

export function useDeleteContact() {
  const isDeleting = ref(false)
  const error = ref<string | null>(null)
  const dependencies = ref<any[]>([])

  async function deleteContact(contactId: string) {
    isDeleting.value = true
    error.value = null
    dependencies.value = []

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.status === 409) {
        dependencies.value = data.dependencies
        error.value = data.error
        return false
      }

      if (!response.ok) {
        error.value = data.error || 'Error al eliminar'
        return false
      }

      return true
    } catch (err) {
      error.value = 'Error de conexión'
      return false
    } finally {
      isDeleting.value = false
    }
  }

  return {
    deleteContact,
    isDeleting,
    error,
    dependencies,
  }
}
```

### Vanilla JavaScript con SweetAlert2

```javascript
async function deleteContactWithConfirmation(contactId, contactName) {
  const result = await Swal.fire({
    title: `¿Eliminar "${contactName}"?`,
    text: 'Esta acción no se puede deshacer',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  })

  if (!result.isConfirmed) return

  try {
    const response = await fetch(`/api/contacts/${contactId}`, {
      method: 'DELETE',
    })

    const data = await response.json()

    // Caso: Dependencias encontradas
    if (response.status === 409) {
      const dependenciesHtml = data.dependencies
        .map(dep => `<li>${dep.displayName}: <strong>${dep.count}</strong></li>`)
        .join('')

      await Swal.fire({
        title: 'No se puede eliminar',
        html: `
          <p>Este contacto tiene registros relacionados:</p>
          <ul style="text-align: left; margin: 1rem 0;">
            ${dependenciesHtml}
          </ul>
          <p>Por favor, elimina primero estos registros.</p>
        `,
        icon: 'error',
      })
      return
    }

    // Caso: Éxito
    if (response.ok) {
      await Swal.fire({
        title: '¡Eliminado!',
        text: 'El contacto ha sido eliminado exitosamente',
        icon: 'success',
      })
      // Recargar o actualizar la lista
      window.location.reload()
    }
  } catch (error) {
    await Swal.fire({
      title: 'Error',
      text: 'No se pudo conectar con el servidor',
      icon: 'error',
    })
  }
}
```

---

## 🔍 Debugging y Troubleshooting

### Ver detalles completos en consola

```typescript
async function deleteWithDebug(entityType: string, id: string) {
  console.log(`Intentando eliminar ${entityType}:`, id)

  const response = await fetch(`/api/${entityType}/${id}`, {
    method: 'DELETE',
  })

  const data = await response.json()

  console.log('Respuesta del servidor:', {
    status: response.status,
    data,
  })

  if (response.status === 409) {
    console.table(data.dependencies)
  }

  return data
}
```

### Verificar antes de intentar eliminar

```typescript
async function checkBeforeDelete(contactId: string) {
  // Primero, obtener el contacto con sus relaciones
  const contact = await fetch(`/api/contacts/${contactId}`).then(r => r.json())

  console.log('Contacto a eliminar:', contact.data)

  // Mostrar advertencia si tiene datos relacionados
  const hasInvoices = contact.data.invoices_count > 0
  const hasOpportunities = contact.data.opportunities_count > 0

  if (hasInvoices || hasOpportunities) {
    console.warn('⚠️ Este contacto tiene registros relacionados')
    console.warn(`- Facturas: ${contact.data.invoices_count}`)
    console.warn(`- Oportunidades: ${contact.data.opportunities_count}`)
  }

  // Proceder con la eliminación
  return deleteContact(contactId)
}
```

---

## 📊 Métricas y Analytics

### Registrar intentos bloqueados

```typescript
async function deleteWithAnalytics(entityType: string, id: string) {
  const response = await fetch(`/api/${entityType}/${id}`, {
    method: 'DELETE',
  })

  const data = await response.json()

  if (response.status === 409) {
    // Enviar evento a analytics
    analytics.track('Delete Blocked by Dependencies', {
      entityType,
      entityId: id,
      dependencyCount: data.dependencies.length,
      dependencies: data.dependencies.map((d: any) => ({
        type: d.table,
        count: d.count,
      })),
    })
  } else if (response.ok) {
    analytics.track('Entity Deleted', {
      entityType,
      entityId: id,
    })
  }

  return data
}
```

---

## 🎨 UI Components Sugeridos

### Badge para mostrar dependencias

```tsx
function DependencyBadge({ count, label }: { count: number; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded-full">
      <span className="text-sm text-red-700">{label}</span>
      <span className="text-xs font-semibold text-red-900 bg-red-100 px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
  )
}

// Uso
<DependencyBadge count={3} label="Facturas" />
```

### Lista expandible de dependencias

```tsx
function DependenciesList({ dependencies }: { dependencies: Dependency[] }) {
  return (
    <div className="space-y-2">
      {dependencies.map((dep) => (
        <div
          key={dep.table}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <span className="font-medium">{dep.displayName}</span>
          </div>
          <span className="text-sm text-gray-600">{dep.count} registros</span>
        </div>
      ))}
    </div>
  )
}
```

---

**Última actualización:** 2025-12-13
