> Esta documentación fue consolidada en `DOCUMENTACION.md#dependency-checker-delete-seguro`.

# Sistema de Verificación de Dependencias - Implementación

## Descripción General

Se ha implementado un sistema robusto de verificación de dependencias que previene la eliminación de registros que tienen relaciones con otros datos en el sistema. El sistema retorna un error HTTP 409 (Conflict) cuando se intenta eliminar un registro con dependencias.

## Archivos Creados/Modificados

### 1. `lib/dependency-checker.ts` (NUEVO)

Biblioteca central que contiene toda la lógica de verificación de dependencias.

#### Funciones Principales:

- **`checkDependencies(supabase, entityType, entityId, organizationId)`**
  - Verifica todas las dependencias para una entidad específica
  - Retorna un objeto con `hasDependencies` y un array de `dependencies`
  - Maneja errores de forma resiliente (continúa verificando incluso si una tabla falla)

- **`formatDependencyError(result, entityType)`**
  - Formatea el resultado en un mensaje amigable para el usuario
  - Ejemplo: "No se puede eliminar este contacto porque tiene dependencias: Facturas (3), Oportunidades (2)"

- **`checkDependenciesOrThrow(supabase, entityType, entityId, organizationId)`**
  - Función helper que lanza una excepción si hay dependencias
  - Útil para flujos donde queremos manejar el error con un try/catch

#### Configuraciones de Dependencias:

##### Contacts (Contactos)
- Facturas (`invoices.contact_id`)
- Oportunidades (`opportunities.contact_id`)
- Cotizaciones (`quotes.contact_id`)
- Tareas (`tasks.contact_id`)
- Actividades (`activities.contact_id`)
- Interacciones (`interactions.contact_id`)
- Eventos de calendario (`calendar_events.contact_id`)
- Correos sincronizados (`synced_emails.contact_id`)
- Mensajes de WhatsApp (`whatsapp_messages.contact_id`)
- Documentos (`documents.contact_id`)

##### Opportunities (Oportunidades)
- Cotizaciones (`quotes.opportunity_id`)
- Productos de la oportunidad (`opportunity_products.opportunity_id`)
- Eventos de calendario (`calendar_events.opportunity_id`)
- Actividades (`activities.opportunity_id`)
- Tareas automatizadas (`tasks.workflow_id`)

##### Products (Productos)
- Items en facturas (`invoice_items.product_id`)
- Items en cotizaciones (`quote_items.product_id`)

##### Campaigns (Campañas)
- Contactos de la campaña (`campaign_contacts.campaign_id`)
- Contactos asociados (`contacts.campaign_id`)

### 2. Endpoints API Modificados

#### `app/api/contacts/[id]/route.ts`
```typescript
// Verifica dependencias antes de eliminar
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

#### `app/api/opportunities/[id]/route.ts`
- Agregado verificación de existencia del registro
- Verificación de dependencias antes de DELETE
- Retorna 409 si hay dependencias

#### `app/api/products/[id]/route.ts`
- Verificación de dependencias antes de DELETE
- Retorna 409 si hay dependencias con detalles

#### `app/api/campaigns/[id]/route.ts`
- Verificación de dependencias antes de DELETE
- Retorna 409 si hay dependencias

## Respuesta de Error

Cuando hay dependencias, la API retorna:

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

**Status Code:** 409 Conflict

## Características Técnicas

### Multi-Tenant Isolation
El sistema respeta el aislamiento multi-tenant verificando `organization_id` en todas las tablas que lo soportan.

### Manejo Resiliente de Errores
- Si una verificación de tabla falla, se registra el error en consola y continúa con las demás
- No bloquea todo el proceso por un error en una tabla específica

### Compatibilidad con Esquemas Evolutivos
- El sistema maneja gracefully casos donde columnas pueden no existir aún
- Útil durante migraciones o actualizaciones del esquema

### Performance
- Usa `select('id', { count: 'exact', head: true })` para contar sin traer datos
- Solo trae el conteo, no los registros completos
- Filtrado a nivel de base de datos para eficiencia

## Uso en el Frontend

### Ejemplo de Manejo en el Cliente

```typescript
async function deleteContact(id: string) {
  const response = await fetch(`/api/contacts/${id}`, {
    method: 'DELETE'
  })

  const data = await response.json()

  if (response.status === 409) {
    // Mostrar lista de dependencias al usuario
    const dependencyList = data.dependencies
      .map(dep => `${dep.displayName} (${dep.count})`)
      .join(', ')

    alert(`No se puede eliminar: ${dependencyList}`)
    return
  }

  if (data.success) {
    // Eliminación exitosa
    console.log('Contacto eliminado')
  }
}
```

### Ejemplo con React/Toast

```typescript
import { toast } from 'sonner'

async function handleDelete(id: string) {
  try {
    const response = await fetch(`/api/contacts/${id}`, {
      method: 'DELETE'
    })

    const data = await response.json()

    if (response.status === 409) {
      toast.error(data.error, {
        description: data.dependencies
          .map(dep => `${dep.displayName}: ${dep.count}`)
          .join(', ')
      })
      return
    }

    if (data.success) {
      toast.success('Contacto eliminado exitosamente')
    }
  } catch (error) {
    toast.error('Error al eliminar')
  }
}
```

## Testing

### Prueba Manual

```bash
# 1. Crear un contacto
POST /api/contacts
{
  "name": "Test Contact",
  "email": "test@example.com"
}

# 2. Crear una factura para ese contacto
POST /api/invoices
{
  "contact_id": "<contact_id>",
  "total": 100
}

# 3. Intentar eliminar el contacto
DELETE /api/contacts/<contact_id>

# Resultado esperado: 409 Conflict con detalles de dependencias
```

### Casos de Prueba

1. **Contacto sin dependencias** → Debe eliminar correctamente (200)
2. **Contacto con 1 factura** → Debe retornar 409 con "Facturas (1)"
3. **Contacto con múltiples dependencias** → Debe listar todas
4. **Oportunidad con productos** → Debe retornar 409
5. **Producto usado en cotización** → Debe retornar 409
6. **Campaña con contactos** → Debe retornar 409

## Mantenimiento y Extensión

### Agregar Nuevo Tipo de Entidad

```typescript
// En lib/dependency-checker.ts
const DEPENDENCY_CONFIGS: Record<string, DependencyConfig[]> = {
  // ... existentes ...

  // Nuevo tipo
  invoices: [
    { table: 'payments', foreignKey: 'invoice_id', displayName: 'Pagos' },
    { table: 'invoice_items', foreignKey: 'invoice_id', displayName: 'Items' },
  ],
}
```

### Agregar Dependencia a Tipo Existente

```typescript
contacts: [
  // ... existentes ...
  { table: 'nueva_tabla', foreignKey: 'contact_id', displayName: 'Nueva Relación' },
],
```

## Consideraciones de Seguridad

1. **Multi-Tenant Isolation:** Siempre verifica `organization_id`
2. **Rate Limiting:** Los endpoints ya tienen rate limiting aplicado
3. **Autenticación:** Se requiere contexto autenticado para todas las operaciones
4. **Sanitización:** Los errores se sanitizan antes de enviarse al cliente

## Mejoras Futuras Posibles

1. **Cascade Delete Options:** Permitir eliminar dependencias en cascada
2. **Soft Delete:** Marcar como eliminado en lugar de borrar
3. **Dependency Graph Visualization:** Mostrar grafo de dependencias en UI
4. **Batch Dependency Check:** Verificar múltiples entidades a la vez
5. **Caching:** Cachear resultados de verificación para mejorar performance

## Notas Importantes

- La verificación de `inventory.product_id` fue removida porque la tabla `inventory` no tiene una relación directa con `products` en el esquema actual
- Las tablas `invoice_items` y `quote_items` pueden tener `product_id` en algunas implementaciones - el sistema maneja esto gracefully
- El sistema continúa funcionando incluso si algunas tablas no existen o no tienen las columnas esperadas
