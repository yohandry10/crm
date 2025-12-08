# Análisis Multi-Tenant - NEON CRM

## Inventario Completo de Tablas Actuales

### Tablas Core (001_base_schema.sql)
| Tabla | Tiene user_id | Necesita org_id |
|-------|---------------|-----------------|
| profiles | id = user_id | current_org_id |
| contacts | ✅ user_id | ✅ org_id |
| interactions | ✅ user_id | ✅ org_id |
| invoices | ✅ user_id | ✅ org_id |
| invoice_items | ❌ (via invoice) | ❌ (hereda) |
| auditoria | usuario_id | ✅ org_id |
| chat_messages | ✅ user_id | ✅ org_id |
| workflows | ✅ user_id | ✅ org_id |
| workflow_executions | ❌ (via workflow) | ❌ (hereda) |
| analytics_cache | ✅ user_id | ✅ org_id |
| payments | ✅ user_id | ✅ org_id |
| webhook_events | ❌ | ✅ org_id |
| system_health | ❌ | ❌ (sistema) |

### Tablas Adicionales
| Tabla | Script | Tiene user_id | Necesita org_id |
|-------|--------|---------------|-----------------|
| integrations | 010 | ✅ user_id | ✅ org_id |
| inventory | 011 | ✅ user_id | ✅ org_id |
| tasks | 014 | ✅ user_id | ✅ org_id |
| ai_conversations | 022 | ✅ user_id | ✅ org_id |
| ai_messages | 022 | ❌ (via conv) | ❌ (hereda) |
| workflow_action_logs | 021 | ❌ (via exec) | ❌ (hereda) |
| pipeline_stages | 024 | ✅ user_id | ✅ org_id |
| opportunities | 024 | ✅ user_id | ✅ org_id |
| opportunity_products | 024 | ❌ (via opp) | ❌ (hereda) |
| events | 025 | ✅ user_id | ✅ org_id |
| quotes | 026 | ✅ user_id | ✅ org_id |
| quote_items | 026 | ❌ (via quote) | ❌ (hereda) |
| products | 034 | ✅ user_id | ✅ org_id |
| product_categories | 034 | ✅ user_id | ✅ org_id |
| comprobantes_electronicos | 034 | ✅ user_id | ✅ org_id |
| campaigns | 034 | ✅ user_id | ✅ org_id |
| campaign_contacts | 034 | ❌ (via camp) | ❌ (hereda) |
| lead_sources | 034 | ✅ user_id | ✅ org_id |
| teams | 034 | ✅ user_id | ✅ org_id |
| team_members | 034 | ❌ (via team) | ❌ (hereda) |
| territories | 034 | ✅ user_id | ✅ org_id |
| documents | 034 | ✅ user_id | ✅ org_id |
| notifications | 034 | ✅ user_id | ✅ org_id |
| user_settings | 034 | ✅ user_id | → org_settings |
| activities | 034 | ✅ user_id | ✅ org_id |
| sales_goals | 034 | ✅ user_id | ✅ org_id |
| accounts | 039 | ✅ user_id | ✅ org_id |
| tickets | 039 | ✅ user_id | ✅ org_id |
| sales_orders | 039 | ✅ user_id | ✅ org_id |

## Decisiones de Arquitectura

### 1. Modelo de Tenancy
- **Tenant = Organization** (no usuario individual)
- Cada organización tiene múltiples usuarios con roles
- Un usuario puede pertenecer a múltiples organizaciones

### 2. Columnas a Agregar
- `organization_id UUID NOT NULL` en todas las tablas de negocio
- `current_organization_id UUID` en profiles (org activa del usuario)

### 3. Tablas Nuevas
- `organizations` - Datos del tenant
- `organization_members` - Membresías usuario-org con roles
- `organization_invitations` - Invitaciones pendientes

### 4. Tablas a Renombrar
- `user_settings` → `organization_settings`

### 5. Cambios en RLS
- Todas las policies cambian de `auth.uid() = user_id` a verificar membresía en org
- Función helper `get_current_org_id()` para obtener org activa
- Función helper `is_org_member(org_id)` para verificar acceso

### 6. Tablas que NO necesitan org_id (heredan)
- invoice_items (via invoices)
- quote_items (via quotes)
- opportunity_products (via opportunities)
- campaign_contacts (via campaigns)
- team_members (via teams)
- workflow_executions (via workflows)
- workflow_action_logs (via workflow_executions)
- ai_messages (via ai_conversations)

### 7. Tablas de Sistema (sin org_id)
- system_health (monitoreo global)

## Plan de Implementación

1. **Script 001**: Schema base multi-tenant (organizations, members, invitations)
2. **Script 002**: Todas las tablas de negocio con org_id desde el inicio
3. **Script 003**: Funciones helper y RLS policies
4. **Script 004**: Triggers y eventos
5. **Script 005**: Vistas e índices
6. **Script 006**: Funciones de negocio (invoice atomic, etc.)
