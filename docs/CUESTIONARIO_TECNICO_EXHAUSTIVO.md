# Cuestionario Técnico Exhaustivo - CRM AI Perú

## Resumen Ejecutivo

Este documento presenta un análisis técnico profundo del proyecto CRM AI Perú, evaluando 10 áreas críticas con preguntas avanzadas, verificación en código y recomendaciones de mejora.

---

## Pregunta 1: Lógica de Negocio - Consistencia en Reglas de Lead Scoring

### Pregunta
¿Existen inconsistencias en las reglas de negocio para el cálculo y actualización del lead_score entre los diferentes módulos del sistema?

### Análisis Técnico

**Hallazgos en el código:**

1. **Schema de validación (`lib/schemas.ts`):**
   - `lead_score` validado como `z.number().min(0).max(100).default(0)`
   - Rango correcto: 0-100

2. **Actualización via Workflows (`lib/events.ts`):**
   ```typescript
   async function executeUpdateLeadScore(action, payload, supabase) {
       const { contactId, score } = action.params || {}
       // ⚠️ No valida que score esté en rango 0-100
       await supabase.from('contacts').update({ lead_score: score })
   }
   ```

3. **API de Contactos (`app/api/contacts/[id]/route.ts`):**
   - Usa validación Zod parcial, pero permite cualquier valor si viene del workflow

### Estado: ⚠️ PROBLEMA PARCIAL DETECTADO

**Inconsistencia identificada:**
- La validación de rango (0-100) solo se aplica en la API de contactos
- Los workflows pueden establecer scores fuera de rango
- No hay validación a nivel de base de datos

### Solución Propuesta

```sql
-- Agregar constraint a nivel de BD
ALTER TABLE contacts 
ADD CONSTRAINT chk_lead_score_range 
CHECK (lead_score >= 0 AND lead_score <= 100);
```

```typescript
// lib/events.ts - Agregar validación
async function executeUpdateLeadScore(action, payload, supabase) {
    const { contactId, score } = action.params || {}
    const validScore = Math.max(0, Math.min(100, Number(score) || 0))
    // ... resto del código
}
```

**Impacto:** Bajo - Cambio defensivo que previene datos corruptos

---

## Pregunta 2: Seguridad Backend - Protección contra Inyección SQL

### Pregunta
¿Están todos los endpoints protegidos contra inyecciones SQL y se utilizan consultas parametrizadas?

### Análisis Técnico

**Hallazgos en el código:**

1. **Uso de Supabase Client:**
   - Todas las consultas usan el cliente de Supabase que parametriza automáticamente
   - Ejemplo seguro en `app/api/contacts/route.ts`:
   ```typescript
   const { data, error } = await supabase
       .from("contacts")
       .select("*")
       .eq("status", status)  // ✅ Parametrizado
   ```

2. **Funciones RPC:**
   - `search_contacts` usa parámetros tipados
   - `create_invoice_with_items_atomic` usa parámetros PL/pgSQL

3. **Validación con Zod:**
   - Todos los inputs se validan antes de llegar a la BD
   - UUIDs validados: `z.string().uuid()`

### Estado: ✅ PROTEGIDO CORRECTAMENTE

**Medidas preventivas implementadas:**
- Supabase JS client con parametrización automática
- Validación Zod en todos los endpoints POST/PUT
- RLS policies que filtran por `user_id`
- Funciones PL/pgSQL con parámetros tipados

**Mejora opcional:**
```typescript
// Agregar sanitización adicional para campos de texto libre
import DOMPurify from 'isomorphic-dompurify'

const sanitizedNotes = DOMPurify.sanitize(body.notes || '')
```

---

## Pregunta 3: Seguridad Backend - Validación de Permisos por Operación

### Pregunta
¿Se validan adecuadamente los permisos de usuario en cada operación CRUD y se previene el acceso horizontal a datos de otros usuarios?

### Análisis Técnico

**Hallazgos en el código:**

1. **Autenticación (`lib/supabase-auth.ts`):**
   ```typescript
   export async function requireAuth() {
       const { data: { session } } = await supabase.auth.getSession()
       if (!session) throw new Error('Unauthorized')
       return session.user
   }
   ```

2. **RLS Policies (`supabase/migrations/02_rls_policies.sql`):**
   ```sql
   CREATE POLICY "Users can view their own contacts" ON contacts
       FOR SELECT USING (auth.uid() = user_id);
   ```

3. **Doble verificación en API (`app/api/contacts/[id]/route.ts`):**
   ```typescript
   const { data } = await supabase
       .from("contacts")
       .select("*")
       .eq("id", id)
       .eq("user_id", user.id)  // ✅ Doble filtro
       .single()
   ```

### Estado: ✅ PROTEGIDO CORRECTAMENTE

**Medidas implementadas:**
- RLS habilitado en todas las tablas críticas
- Filtro `user_id` en queries de API (defensa en profundidad)
- Sistema de roles con `requireRole()`
- Auditoría de acciones sensibles

**Mejora opcional - Rate limiting por usuario:**
```typescript
// Ya implementado en lib/rate-limit.ts
const identifier = user ? `user:${user.id}` : `ip:${ip}`
```

---

## Pregunta 4: Rendimiento Frontend - Re-renders Innecesarios

### Pregunta
¿Hay componentes que causen re-renders innecesarios y afecten el rendimiento de la aplicación?

### Análisis Técnico

**Hallazgos en el código:**

1. **Uso de `memo` en Dashboard (`components/dashboard/dashboard-overview.tsx`):**
   ```typescript
   const StatCard = memo(({ stat }: { stat: any }) => { ... })
   export const DashboardOverview = memo(() => { ... })
   ```
   ✅ Correctamente memoizado

2. **Lead Dialog (`components/leads/lead-dialog.tsx`):**
   ```typescript
   useEffect(() => {
       // Se ejecuta en cada cambio de open, lead, form
       const supabase = createClient(...)
       Promise.all([...])  // ⚠️ Fetch en cada apertura
   }, [open, lead, form])
   ```
   ⚠️ Problema: `form` en dependencias causa re-fetches innecesarios

3. **Hooks SWR (`lib/hooks/use-api.ts`):**
   ```typescript
   const { data, error, mutate } = useSWR(url, fetcher, {
       dedupingInterval: 2000  // ✅ Previene duplicados
   })
   ```

### Estado: ⚠️ PROBLEMA PARCIAL DETECTADO

**Problemas identificados:**
- `LeadDialog` re-fetcha sources/campaigns en cada render
- Dependencia `form` en useEffect causa loops

### Solución Propuesta

```typescript
// components/leads/lead-dialog.tsx - Corregido
useEffect(() => {
    if (!open) return  // Solo fetch cuando se abre
    
    const supabase = createClient(...)
    Promise.all([...]).then(...)
}, [open])  // ✅ Remover form de dependencias

// Separar reset del form
useEffect(() => {
    if (lead) {
        form.reset({ ...lead })
    } else {
        form.reset(defaultValues)
    }
}, [lead, open])  // form.reset es estable
```

**Impacto:** Medio - Mejora UX en formularios frecuentes

---

## Pregunta 5: Rendimiento Frontend - Optimización de Llamadas API

### Pregunta
¿Se optimizaron las llamadas a la API para evitar sobrecarga y se implementó caching adecuado?

### Análisis Técnico

**Hallazgos en el código:**

1. **SWR con configuración optimizada (`lib/hooks/use-api.ts`):**
   ```typescript
   useSWR(url, fetcher, {
       refreshInterval: 30000,      // Auto-refresh cada 30s
       revalidateOnFocus: true,     // Refresh al volver a pestaña
       dedupingInterval: 2000       // Evita duplicados
   })
   ```

2. **Paginación implementada en APIs:**
   ```typescript
   const page = parseInt(searchParams.get("page") || "1")
   const limit = parseInt(searchParams.get("limit") || "10")
   .range(offset, offset + limit - 1)
   ```

3. **Cache de analytics en BD (`supabase/migrations/20251121030000_analytics_aggregation.sql`):**
   - Tabla `analytics_cache` para métricas pre-calculadas

### Estado: ✅ BIEN IMPLEMENTADO

**Medidas implementadas:**
- SWR para caching client-side
- Paginación en todos los endpoints de listado
- Cache de analytics en base de datos
- Índices optimizados para queries frecuentes

**Mejora opcional - Stale-While-Revalidate más agresivo:**
```typescript
useSWR(url, fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,  // Reducir para analytics
    staleTime: 30000           // Datos válidos por 30s
})
```

---

## Pregunta 6: Integridad de Datos - Consistencia Transaccional

### Pregunta
¿Mantiene la base de datos consistencia transaccional en operaciones críticas como creación de facturas con items?

### Análisis Técnico

**Hallazgos en el código:**

1. **Función atómica para facturas (`supabase/migrations/20251121030001_invoice_atomic_transactions.sql`):**
   ```sql
   CREATE OR REPLACE FUNCTION create_invoice_with_items_atomic(...)
   RETURNS TABLE (...) AS $
   DECLARE
       v_invoice_id UUID;
   BEGIN
       -- Todo en una transacción
       INSERT INTO invoices (...) RETURNING id INTO v_invoice_id;
       
       FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
           INSERT INTO invoice_items (...);
           
           -- Lock para evitar race conditions
           SELECT * INTO v_inventory_item FROM inventory
           WHERE id = ... FOR UPDATE;
           
           IF v_inventory_item.quantity < required THEN
               RAISE EXCEPTION 'Stock insuficiente...';
               -- Auto-rollback de toda la transacción
           END IF;
       END LOOP;
   END;
   $ LANGUAGE plpgsql;
   ```

2. **Validación de sobrepago (`supabase/migrations/20251122000102_server_side_validations.sql`):**
   ```sql
   CREATE TRIGGER trigger_validate_payment_amount
       BEFORE INSERT OR UPDATE ON payments
       FOR EACH ROW EXECUTE FUNCTION validate_payment_amount();
   ```

### Estado: ✅ EXCELENTE IMPLEMENTACIÓN

**Medidas implementadas:**
- Transacciones atómicas con rollback automático
- Locks `FOR UPDATE` para evitar race conditions
- Triggers de validación a nivel de BD
- Secuencias para números correlativos

---

## Pregunta 7: Integridad de Datos - Índices para Consultas Frecuentes

### Pregunta
¿Existen índices faltantes en consultas frecuentes que puedan causar degradación de rendimiento?

### Análisis Técnico

**Hallazgos en el código:**

1. **Índices básicos (`supabase/migrations/06-indexes.sql`):**
   ```sql
   CREATE INDEX idx_contacts_user_id ON contacts(user_id);
   CREATE INDEX idx_contacts_lead_status ON contacts(lead_status);
   CREATE INDEX idx_invoices_contact_id ON invoices(contact_id);
   ```

2. **Índices compuestos optimizados (`supabase/migrations/20251121040000_performance_indexes.sql`):**
   ```sql
   CREATE INDEX idx_contacts_lead_status_score 
       ON contacts(lead_status, lead_score DESC);
   CREATE INDEX idx_analytics_cache_lookup 
       ON analytics_cache(user_id, metric_name, period, date DESC);
   CREATE INDEX idx_contacts_tags ON contacts USING gin(tags);
   ```

3. **Índices para búsqueda case-insensitive:**
   - Función `search_contacts` usa índices trigram

### Estado: ✅ BIEN CUBIERTO

**Índices implementados:**
- Índices simples en FKs y campos de filtro
- Índices compuestos para queries comunes
- Índices GIN para arrays (tags)
- Índices parciales para optimización

**Mejora opcional - Índice faltante detectado:**
```sql
-- Para búsquedas por email (login, deduplicación)
CREATE INDEX IF NOT EXISTS idx_contacts_email_lower 
    ON contacts(LOWER(email));
```

---

## Pregunta 8: Manejo de Errores - Captura de Estados de Error

### Pregunta
¿Captura el sistema adecuadamente todos los posibles estados de error y proporciona recuperación graceful?

### Análisis Técnico

**Hallazgos en el código:**

1. **Error Boundary global (`components/error-boundary.tsx`):**
   ```typescript
   componentDidCatch(error: Error, errorInfo: any) {
       logError({
           errorId: crypto.randomUUID(),
           endpoint: window.location.pathname,
           method: "RENDER",
           error: { message, stack, componentStack }
       })
   }
   ```

2. **Manejo en APIs (patrón consistente):**
   ```typescript
   try {
       // ... lógica
   } catch (error: any) {
       await logError({
           errorId: crypto.randomUUID(),
           endpoint: "/api/contacts",
           method: "POST",
           error,
           requestBody: await request.clone().json().catch(() => undefined)
       })
       return NextResponse.json({ success: false, error: error.message }, { status: 500 })
   }
   ```

3. **Retry con backoff (`lib/retry.ts`):**
   ```typescript
   export async function retryWithBackoff<T>(fn, options) {
       for (let attempt = 1; attempt <= maxAttempts; attempt++) {
           try { return await fn() }
           catch (error) {
               if (attempt === maxAttempts) break
               await new Promise(r => setTimeout(r, delay))
           }
       }
   }
   ```

### Estado: ✅ BIEN IMPLEMENTADO

**Medidas implementadas:**
- Error boundary para errores de React
- Logging estructurado con errorId único
- Retry con exponential backoff
- Validación de errores específicos (404, 400, 401, 403)

**Mejora opcional - Clasificación de errores:**
```typescript
// lib/error-types.ts
export class ValidationError extends Error {
    constructor(message: string, public details: any) {
        super(message)
        this.name = 'ValidationError'
    }
}

export class NotFoundError extends Error {
    constructor(resource: string, id: string) {
        super(`${resource} with id ${id} not found`)
        this.name = 'NotFoundError'
    }
}
```

---

## Pregunta 9: Manejo de Errores - Mensajes Sin Exposición de Información Sensible

### Pregunta
¿Proporciona el sistema mensajes de error útiles sin exponer información sensible como stack traces o estructura de BD?

### Análisis Técnico

**Hallazgos en el código:**

1. **Respuestas de API:**
   ```typescript
   return NextResponse.json({ 
       success: false, 
       error: error.message  // ⚠️ Puede exponer detalles internos
   }, { status: 500 })
   ```

2. **Error Boundary en producción:**
   ```typescript
   {process.env.NODE_ENV === "development" && this.state.error && (
       <pre>{this.state.error.stack}</pre>  // ✅ Solo en dev
   )}
   ```

3. **Logging interno vs respuesta:**
   ```typescript
   await logError({ ...fullDetails })  // ✅ Log completo interno
   return { error: error.message }     // ⚠️ Mensaje puede ser técnico
   ```

### Estado: ⚠️ MEJORA RECOMENDADA

**Problema identificado:**
- `error.message` de Supabase puede contener nombres de tablas/columnas
- Errores de validación Zod exponen estructura esperada

### Solución Propuesta

```typescript
// lib/error-handler.ts
export function sanitizeErrorForClient(error: any): string {
    // Errores conocidos con mensajes seguros
    const safeMessages: Record<string, string> = {
        'PGRST116': 'Recurso no encontrado',
        '23505': 'Este registro ya existe',
        '23503': 'No se puede eliminar, tiene registros relacionados',
        '42501': 'No tienes permisos para esta acción'
    }
    
    if (error.code && safeMessages[error.code]) {
        return safeMessages[error.code]
    }
    
    // Mensaje genérico para errores desconocidos
    if (process.env.NODE_ENV === 'production') {
        return 'Ha ocurrido un error. Por favor intenta de nuevo.'
    }
    
    return error.message
}
```

**Impacto:** Alto - Mejora seguridad y UX

---

## Pregunta 10: Casos Extremos - Flujos Principales

### Pregunta
¿Se han considerado todos los casos extremos en los flujos principales como creación de facturas, pagos y workflows?

### Análisis Técnico

**Hallazgos en el código:**

1. **Facturación - Casos cubiertos:**
   - ✅ Stock insuficiente → Exception con rollback
   - ✅ Producto no encontrado → Exception
   - ✅ Items vacíos → Validación Zod
   - ⚠️ Contacto eliminado durante creación → No manejado

2. **Pagos - Casos cubiertos:**
   - ✅ Sobrepago → Trigger de validación
   - ✅ Factura no encontrada → Error 404
   - ⚠️ Pago duplicado (mismo transaction_id) → No validado

3. **Workflows - Casos cubiertos:**
   - ✅ Workflow inactivo → Rechazado
   - ✅ Condiciones no cumplidas → Rechazado
   - ⚠️ Acción de email sin destinatario → Warning pero continúa
   - ⚠️ Loop infinito de workflows → No detectado

### Estado: ⚠️ CASOS EXTREMOS FALTANTES

### Soluciones Propuestas

```sql
-- 1. Prevenir pagos duplicados
CREATE UNIQUE INDEX idx_payments_unique_transaction 
    ON payments(transaction_id) 
    WHERE transaction_id IS NOT NULL;
```

```typescript
// 2. Validar contacto existe antes de facturar
const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contact_id)
    .single()

if (!contact) {
    return NextResponse.json({
        success: false,
        error: 'El contacto no existe o fue eliminado'
    }, { status: 400 })
}
```

```typescript
// 3. Prevenir loops de workflows
const MAX_WORKFLOW_DEPTH = 5

async function executeWorkflow(workflowId, depth = 0) {
    if (depth > MAX_WORKFLOW_DEPTH) {
        throw new Error('Maximum workflow depth exceeded - possible loop detected')
    }
    // ... ejecutar con depth + 1 en llamadas recursivas
}
```

**Impacto:** Alto - Previene corrupción de datos y comportamiento inesperado

---

## Resumen de Hallazgos

| # | Área | Estado | Prioridad |
|---|------|--------|-----------|
| 1 | Lead Scoring Consistency | ⚠️ Parcial | Media |
| 2 | SQL Injection Protection | ✅ OK | - |
| 3 | Permission Validation | ✅ OK | - |
| 4 | Re-renders Optimization | ⚠️ Parcial | Media |
| 5 | API Call Optimization | ✅ OK | - |
| 6 | Transactional Consistency | ✅ Excelente | - |
| 7 | Database Indexes | ✅ OK | Baja |
| 8 | Error Capture | ✅ OK | - |
| 9 | Error Message Security | ⚠️ Mejora | Alta |
| 10 | Edge Cases | ⚠️ Faltantes | Alta |

---

## Plan de Acción Recomendado

### Semana 1 - Crítico
1. Implementar sanitización de mensajes de error
2. Agregar constraint de lead_score en BD
3. Crear índice único para transaction_id en pagos

### Semana 2 - Importante
4. Corregir re-renders en LeadDialog
5. Agregar validación de contacto existente en facturación
6. Implementar detección de loops en workflows

### Semana 3 - Mejoras
7. Agregar índice para búsqueda por email
8. Implementar clases de error tipadas
9. Documentar casos extremos manejados

---

## Verificaciones Adicionales Realizadas

### Validación de Datos
- ✅ Zod schemas en todos los endpoints POST/PUT
- ✅ Triggers de validación en BD (email, RUC, teléfono)
- ✅ Validación de UUIDs en parámetros de ruta

### Mecanismos de Caché
- ✅ SWR con dedupingInterval
- ✅ analytics_cache table para métricas
- ✅ Rate limiting con store en memoria

### Pruebas
- ⚠️ No se encontraron archivos de test unitarios
- ⚠️ No hay tests de integración documentados
- Recomendación: Implementar Jest + Testing Library

### Documentación
- ✅ docs/FULL_SYSTEM_ANALYSIS.md
- ✅ docs/FRONTEND_OPTIMIZATIONS.md
- ✅ docs/DEPLOYMENT-GUIDE.md
- ⚠️ Falta documentación de API (OpenAPI/Swagger)

---

*Documento generado: Diciembre 2025*
*Versión del proyecto: 0.1.0*


---

## Implementaciones Realizadas

Como parte de este análisis, se implementaron las siguientes correcciones:

### 1. Sistema de Manejo de Errores Seguro
**Archivo:** `lib/error-handler.ts`
- Clases de error tipadas (ValidationError, NotFoundError, etc.)
- Sanitización de mensajes para producción
- Mapeo de códigos PostgreSQL a mensajes seguros
- Detección de patrones sensibles en mensajes

### 2. Migración de Casos Extremos
**Archivo:** `supabase/migrations/20251201000000_edge_cases_fixes.sql`
- Constraint `chk_lead_score_range` (0-100)
- Índice único para `transaction_id` en pagos
- Índice case-insensitive para email
- Trigger de validación de contacto antes de facturar
- Sistema de detección de loops en workflows
- Trigger de normalización de lead_score

### 3. Optimización de Re-renders
**Archivo:** `components/leads/lead-dialog.tsx`
- Separación de efectos (fetch vs reset)
- Memoización del cliente Supabase
- Ref para evitar re-fetches innecesarios
- Eliminación de dependencias inestables

### 4. Validación de Lead Score
**Archivo:** `lib/events.ts`
- Normalización de score al rango 0-100 en workflows
- Logging de valores normalizados

### 5. Endpoint de Pagos Mejorado
**Archivo:** `app/api/payments/route.ts`
- Uso del nuevo error handler
- Validación de factura existente antes de pago
- Errores tipados con ValidationError y NotFoundError

---

## Próximos Pasos Recomendados

1. **Aplicar migración SQL** en ambiente de desarrollo/staging
2. **Actualizar otros endpoints** para usar `lib/error-handler.ts`
3. **Implementar tests** para los casos extremos documentados
4. **Configurar monitoreo** de errores con el nuevo sistema de logging
5. **Documentar API** con OpenAPI/Swagger

---

*Análisis completado: Diciembre 2025*
