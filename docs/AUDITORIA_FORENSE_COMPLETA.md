# 🔴 AUDITORÍA FORENSE COMPLETA - CRM AI PERÚ

**Fecha:** 2 de Diciembre 2025  
**Estado:** ⛔ NO LISTO PARA PRODUCCIÓN  
**Problemas Críticos:** 15+

---

## RESUMEN EJECUTIVO

El sistema tiene múltiples problemas críticos que DEBEN ser corregidos antes de ir a producción:

1. **Autenticación rota** - Usa paquete deprecado
2. **Tablas faltantes en BD** - Varias tablas referenciadas no existen
3. **Interconexiones rotas** - Módulos que llaman a tablas inexistentes
4. **Validaciones inconsistentes** - Frontend y backend no coinciden
5. **Eventos no emitidos** - Workflows no se disparan correctamente

---

## 🔴 PROBLEMAS CRÍTICOS

### 1. AUTENTICACIÓN ROTA

**Archivo:** `app/login/page.tsx`

```typescript
// ❌ PROBLEMA: Usa paquete deprecado
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
const supabase = createClientComponentClient()
```

**Solución:**
```typescript
// ✅ CORRECTO: Usar @supabase/ssr
import { createBrowserClient } from '@supabase/ssr'
const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

**Archivos afectados:**
- `app/login/page.tsx`
- `app/signup/page.tsx`
- `app/forgot-password/page.tsx`
- `components/dashboard/sidebar.tsx`
- `components/quotes/quote-dialog.tsx`
- `components/sales/opportunity-dialog.tsx`
- `components/leads/lead-dialog.tsx`
- `components/tasks/task-dialog.tsx`

---

### 2. TABLAS FALTANTES EN BASE DE DATOS

Las siguientes tablas son referenciadas pero NO existen en las migraciones:

| Tabla | Referenciada en | Estado |
|-------|-----------------|--------|
| `lead_sources` | `components/leads/lead-dialog.tsx` | ❌ NO EXISTE |
| `product_categories` | `app/api/products/route.ts` | ❌ NO EXISTE |
| `user_settings` | `app/api/settings/route.ts` | ❌ NO EXISTE |
| `profiles` | Múltiples archivos | ⚠️ VERIFICAR |

---

### 3. INTERCONEXIONES ROTAS ENTRE MÓDULOS

#### 3.1 Leads → Lead Sources
```typescript
// components/leads/lead-dialog.tsx
supabase.from('lead_sources').select('id, name').eq('active', true)
// ❌ Tabla lead_sources NO EXISTE
```

#### 3.2 Products → Categories
```typescript
// app/api/products/route.ts
.select('*, category:product_categories(id, name)')
// ❌ Tabla product_categories NO EXISTE
```

#### 3.3 Invoicing → Nueva Factura
```typescript
// app/invoicing/page.tsx
<Link href="/invoicing/new">
// ❌ Ruta /invoicing/new NO EXISTE
```

#### 3.4 Pipeline Stages → Default Stages
```typescript
// app/api/pipeline-stages/route.ts
.eq('is_default', true)
// ❌ Columna is_default NO EXISTE en pipeline_stages
```

---

### 4. EVENTOS NO EMITIDOS CORRECTAMENTE

#### 4.1 Oportunidades - Evento con key incorrecto
```typescript
// app/api/opportunities/route.ts
payload: {
    opportunityId: data.id,  // ❌ Debería ser 'id' para consistencia
    userId: user.id          // ❌ Debería ser 'user_id'
}
```

#### 4.2 Pagos - Falta contact_id en evento
```typescript
// app/api/payments/route.ts
payload: {
    payment_id: result.payment_id,
    user_id: user.id,
    invoice_id,
    // ❌ FALTA: contact_id para workflows que filtran por contacto
}
```

---

### 5. VALIDACIONES INCONSISTENTES

#### 5.1 Lead Status - Valores diferentes
```typescript
// Frontend (lead-dialog.tsx):
z.enum(["new", "contacted", "qualified", "unqualified"])

// Backend (schemas.ts):
z.enum(['cold', 'warm', 'hot', 'converted', 'lost'])

// ❌ NO COINCIDEN
```

#### 5.2 Task Priority - Falta "urgent"
```typescript
// Frontend (task-dialog.tsx):
z.enum(["low", "medium", "high"])

// Backend (schemas.ts):
z.enum(["low", "medium", "high", "urgent"])

// ❌ Frontend no tiene "urgent"
```

---

### 6. RUTAS FALTANTES

| Ruta | Referenciada en | Estado |
|------|-----------------|--------|
| `/invoicing/new` | `app/invoicing/page.tsx` | ❌ NO EXISTE |
| `/invoicing/[id]` | `app/invoicing/page.tsx` | ❌ NO EXISTE |
| `/api/contacts/[id]` PATCH | `components/leads/lead-dialog.tsx` | ⚠️ Solo tiene PUT |

---

### 7. FUNCIONES RPC FALTANTES

Las siguientes funciones son llamadas pero pueden no existir:

```sql
-- Verificar existencia:
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name IN (
    'increment_contact_interactions',
    'search_contacts',
    'create_invoice_with_items_atomic',
    'process_payment_atomic',
    'expire_old_quotes',
    'log_workflow_action_start',
    'log_workflow_action_complete'
);
```

---

### 8. PROBLEMAS DE SEGURIDAD

#### 8.1 Supabase Client en Componentes
```typescript
// ❌ PROBLEMA: Crear cliente en cada render
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

Esto crea una nueva instancia en cada render, causando:
- Memory leaks
- Conexiones duplicadas
- Posibles race conditions

**Solución:** Usar un singleton o el hook de SWR.

---

### 9. PROBLEMAS DE UX/UI

#### 9.1 Sin feedback de errores en diálogos
```typescript
// Todos los diálogos hacen:
} catch (error) {
    console.error(error)  // ❌ Usuario no ve el error
}
```

**Solución:** Agregar toast de error.

#### 9.2 Sin confirmación de eliminación
- Quotes: No tiene botón de eliminar
- Products: Botón de eliminar sin confirmación
- Tasks: Sin confirmación

---

### 10. PROBLEMAS DE RENDIMIENTO

#### 10.1 Queries sin límite
```typescript
// app/api/pipeline-stages/route.ts
const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')  // ❌ Sin límite, puede traer miles de registros
```

#### 10.2 N+1 Queries en Kanban
```typescript
// components/sales/kanban-board.tsx
// Cada columna filtra oportunidades en el cliente
const stageOpps = opportunities.filter(o => o.stage_id === stage.id)
// ❌ Debería agruparse en el servidor
```

---

## 📋 CHECKLIST DE CORRECCIONES

### Prioridad 1 - Bloqueantes

- [ ] Migrar de `@supabase/auth-helpers-nextjs` a `@supabase/ssr`
- [ ] Crear tabla `lead_sources`
- [ ] Crear tabla `product_categories`
- [ ] Crear tabla `user_settings`
- [ ] Crear ruta `/invoicing/new`
- [ ] Crear ruta `/invoicing/[id]`
- [ ] Agregar método PATCH a `/api/contacts/[id]`

### Prioridad 2 - Críticos

- [ ] Unificar valores de `lead_status` entre frontend y backend
- [ ] Agregar `urgent` a priority en task-dialog
- [ ] Agregar columna `is_default` a `pipeline_stages`
- [ ] Verificar todas las funciones RPC existen
- [ ] Agregar `contact_id` a eventos de pago

### Prioridad 3 - Importantes

- [ ] Agregar toast de error en todos los diálogos
- [ ] Agregar confirmación de eliminación
- [ ] Optimizar queries con límites
- [ ] Crear singleton para Supabase client en componentes

---

## 🗄️ MIGRACIÓN SQL REQUERIDA

```sql
-- =====================================================
-- MIGRACIÓN: Tablas y columnas faltantes
-- =====================================================

-- 1. Tabla lead_sources
CREATE TABLE IF NOT EXISTS lead_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their lead sources" ON lead_sources
    FOR ALL USING (auth.uid() = user_id);

-- 2. Tabla product_categories
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES product_categories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their categories" ON product_categories
    FOR ALL USING (auth.uid() = user_id);

-- 3. Tabla user_settings
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(200),
    company_ruc VARCHAR(11),
    company_address TEXT,
    company_phone VARCHAR(20),
    company_email VARCHAR(255),
    company_logo_url TEXT,
    serie_factura VARCHAR(10) DEFAULT 'F001',
    serie_boleta VARCHAR(10) DEFAULT 'B001',
    serie_nota_credito VARCHAR(10) DEFAULT 'FC01',
    default_currency VARCHAR(3) DEFAULT 'PEN',
    default_tax_rate DECIMAL(5,2) DEFAULT 18.00,
    timezone VARCHAR(50) DEFAULT 'America/Lima',
    language VARCHAR(5) DEFAULT 'es',
    notify_new_lead BOOLEAN DEFAULT true,
    notify_task_due BOOLEAN DEFAULT true,
    notify_payment_received BOOLEAN DEFAULT true,
    notify_invoice_overdue BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their settings" ON user_settings
    FOR ALL USING (auth.uid() = user_id);

-- 4. Agregar columna is_default a pipeline_stages
ALTER TABLE pipeline_stages 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- 5. Agregar columna win_probability a pipeline_stages
ALTER TABLE pipeline_stages 
ADD COLUMN IF NOT EXISTS win_probability INTEGER DEFAULT 50;

-- 6. Insertar etapas por defecto
INSERT INTO pipeline_stages (id, name, position, color, is_default, win_probability)
VALUES 
    (uuid_generate_v4(), 'Prospecto', 0, '#94a3b8', true, 10),
    (uuid_generate_v4(), 'Contactado', 1, '#60a5fa', true, 25),
    (uuid_generate_v4(), 'Propuesta', 2, '#fbbf24', true, 50),
    (uuid_generate_v4(), 'Negociación', 3, '#f97316', true, 75),
    (uuid_generate_v4(), 'Cerrado', 4, '#22c55e', true, 100)
ON CONFLICT DO NOTHING;

-- 7. Agregar columnas faltantes a contacts
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS lead_source_id UUID REFERENCES lead_sources(id),
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);

-- 8. Crear índices
CREATE INDEX IF NOT EXISTS idx_lead_sources_user ON lead_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_user ON product_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_source ON contacts(lead_source_id);
CREATE INDEX IF NOT EXISTS idx_contacts_campaign ON contacts(campaign_id);
```

---

## 📁 ARCHIVOS A CREAR

### 1. `/app/invoicing/new/page.tsx`
Página para crear nueva factura.

### 2. `/app/invoicing/[id]/page.tsx`
Página para ver/editar factura existente.

### 3. `/lib/supabase-client.ts`
Singleton para cliente de Supabase en componentes.

---

## ⚠️ CONCLUSIÓN

**El sistema NO está listo para producción.**

Se requieren al menos 2-3 días de trabajo para:
1. Corregir autenticación
2. Crear tablas faltantes
3. Crear rutas faltantes
4. Unificar validaciones
5. Agregar manejo de errores
6. Testing básico

---

*Auditoría realizada: 2 de Diciembre 2025*
































Realice una auditoría forense exhaustiva de toda la aplicación, incluyendo los siguientes aspectos críticos:

1. Revisión módulo por módulo:
   - Verifique que cada módulo tenga lógica de negocio correcta DE CRM
   - Valide la interconexión entre módulos y su correcto funcionamiento
   - Identifique y corrija cualquier falla de lógica entre módulos

2. Seguridad:
   - Detecte y solucione todos los errores de seguridad
   - Valide la arquitectura de base de datos y su correcta implementación
   - Verifique el cumplimiento de buenas prácticas de seguridad

3. Arquitectura y calidad:
   - Evalúe la arquitectura de software completa
   - Verifique el cumplimiento de buenas prácticas de desarrollo
   - Asegure que toda la aplicación cumpla con estándares de producción

4. Funcionalidad integral:
   - Revise cada API y su correcto funcionamiento
   - Valide cada módulo frontend interconectado
   - Verifique todos los módulos del sidebar y sus conexiones
   - Compruebe el correcto funcionamiento de los eventos emitidos

5. Criterios de aprobación:
   - La aplicación solo podrá considerarse lista para producción cuando cumpla con todos los requisitos
   - No debe haber errores, brechas o fallas de ningún tipo
   - Todo debe funcionar correctamente antes de su entrega a clientes

La auditoría debe ser tan exhaustiva que garantice al 100% que la aplicación está completamente lista para producción, sin excepciones. Solo cuando se cumplan todos estos requisitos podrá considerarse finalizada.