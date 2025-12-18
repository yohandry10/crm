# Seguridad de Endpoints de Administración

## Resumen de Correcciones Implementadas

Este documento describe las mejoras de seguridad implementadas en los endpoints de administración de la plataforma para proteger datos sensibles y garantizar que solo los platform admins tengan acceso.

## Archivos Creados

### 1. `lib/auth-helpers.ts`

Contiene funciones utilitarias de autenticación y enmascaramiento de datos:

- **`requirePlatformAdmin()`**: Verifica que el usuario actual sea un platform admin
  - Valida autenticación
  - Verifica flag `is_platform_admin` en la tabla `profiles`
  - Lanza excepción si no es platform admin
  - Retorna `{ supabase, user }` para uso posterior

- **`maskEmail(email)`**: Enmascara emails para proteger privacidad
  - Ejemplo: `john.doe@example.com` → `j********@example.com`
  - Preserva el dominio
  - Maneja casos edge (null, undefined, inválidos)

- **`maskRUC(ruc)`**: Enmascara RUCs/números de identificación fiscal
  - Ejemplo: `20123456789` → `********789`
  - Muestra solo los últimos 3 dígitos
  - Retorna null para valores inválidos

- **`validatePagination(searchParams)`**: Valida y sanitiza parámetros de paginación
  - Página mínima: 1
  - Límite mínimo: 1
  - Límite máximo: 100
  - Calcula offset automáticamente

### 2. `lib/audit-logger.ts`

Sistema de auditoría para acciones de administración:

- **`logAdminAction()`**: Registra acciones administrativas críticas
  - Captura IP y user agent
  - Registra en tabla `auditoria`
  - Log a consola para monitoreo en tiempo real
  - Campos: acción, recurso, detalles, éxito/fallo

- **`logSensitiveDataAccess()`**: Registra accesos a datos sensibles
  - Registra tipo de datos accedidos
  - Cantidad de registros
  - Filtros aplicados
  - Útil para auditorías de cumplimiento

### 3. `lib/__tests__/auth-helpers.test.ts`

Suite de tests unitarios para funciones de enmascaramiento y validación:
- Tests para `maskEmail()`
- Tests para `maskRUC()`
- Tests para `validatePagination()`
- Cobertura de casos edge

## Endpoints Actualizados

### 1. `/api/admin/users` (GET y PATCH)

**Mejoras implementadas:**
- ✅ Requiere platform admin (no org admin regular)
- ✅ Paginación obligatoria (máximo 100 registros por página)
- ✅ Emails enmascarados en respuesta
- ✅ Filtros: búsqueda, rol, estado activo
- ✅ Auditoría de acceso a datos sensibles
- ✅ Auditoría de modificaciones de permisos
- ✅ Rate limiting aplicado

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "j********@example.com",
      "full_name": "John Doe",
      "is_platform_admin": false,
      "created_at": "2025-01-01T00:00:00Z",
      "organizations": [
        {
          "id": "org-uuid",
          "name": "Acme Corp",
          "role": "admin",
          "is_active": true
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### 2. `/api/admin/organizations` (GET y POST)

**Mejoras implementadas:**
- ✅ Requiere platform admin
- ✅ Paginación obligatoria
- ✅ RUCs enmascarados en respuesta
- ✅ `stripe_customer_id` removido (ya no usamos Stripe)
- ✅ Filtros: búsqueda, estado de suscripción, plan
- ✅ Auditoría de acceso y creación
- ✅ Rate limiting aplicado

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "slug": "acme",
      "ruc": "********789",
      "subscription_status": "active",
      "subscription_plan": "professional",
      "trial_ends_at": null,
      "subscription_ends_at": "2026-01-01T00:00:00Z",
      "onboarding_completed": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### 3. `/api/admin/organizations/[id]` (GET y PUT)

**Mejoras implementadas:**
- ✅ Requiere platform admin
- ✅ Emails de miembros enmascarados
- ✅ RUC enmascarado
- ✅ Auditoría de acceso a detalle de organización
- ✅ Auditoría de actualizaciones con diff de cambios
- ✅ Rate limiting aplicado

### 4. `/api/admin/stats` (GET)

**Mejoras implementadas:**
- ✅ Requiere platform admin
- ✅ No expone datos sensibles (emails, RUCs)
- ✅ Auditoría de acceso a estadísticas
- ✅ Rate limiting aplicado

## Verificación de Platform Admin

### ¿Qué es un Platform Admin?

Un platform admin es un super-usuario con acceso a:
- Panel de administración de todas las organizaciones
- Gestión de usuarios globales
- Creación de organizaciones
- Modificación de límites y planes
- Estadísticas globales de la plataforma

### ¿Cómo se verifica?

La función `requirePlatformAdmin()` verifica:

```typescript
1. Usuario autenticado (token válido)
2. Campo is_platform_admin = true en profiles
3. Lanza error si falla cualquier verificación
```

### Diferencia con Org Admin

| Permiso | Org Admin | Platform Admin |
|---------|-----------|----------------|
| Gestionar su organización | ✅ | ✅ |
| Ver/editar usuarios de su org | ✅ | ✅ |
| Ver todas las organizaciones | ❌ | ✅ |
| Crear organizaciones | ❌ | ✅ |
| Modificar límites | ❌ | ✅ |
| Acceder a `/api/admin/*` | ❌ | ✅ |

## Auditoría

### Tabla `auditoria`

Todos los accesos y modificaciones se registran en la tabla de auditoría con:

- **usuario_id**: ID del platform admin
- **accion**: Tipo de acción (ej: `ADMIN_CREATE_ORGANIZATION`)
- **tabla**: Recurso afectado
- **registro_id**: ID del registro afectado
- **datos_nuevos**: Detalles de la acción
- **ip_address**: IP del solicitante
- **user_agent**: Navegador/cliente usado
- **created_at**: Timestamp

### Tipos de Eventos Auditados

1. **SENSITIVE_DATA_ACCESS**: Acceso a listados de usuarios u organizaciones
2. **ADMIN_CREATE_ORGANIZATION**: Creación de organización
3. **ADMIN_UPDATE_ORGANIZATION**: Actualización de organización
4. **ADMIN_UPDATE_USER_PERMISSIONS**: Cambio de permisos de usuario

### Ejemplo de Registro de Auditoría

```json
{
  "usuario_id": "platform-admin-uuid",
  "accion": "SENSITIVE_DATA_ACCESS",
  "tabla": "users",
  "registro_id": "bulk_20",
  "datos_nuevos": {
    "dataType": "users",
    "recordCount": 20,
    "filters": {
      "search": "",
      "role": "admin",
      "is_active": null,
      "page": 1,
      "limit": 20
    },
    "timestamp": "2025-12-13T10:30:00Z"
  },
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2025-12-13T10:30:00Z"
}
```

## Seguridad por Capas

### 1. Autenticación (L1)
- Token JWT válido requerido
- Sesión activa en Supabase

### 2. Autorización (L2)
- Verificación de `is_platform_admin = true`
- No basta con ser org admin

### 3. Rate Limiting (L3)
- Lectura: límite por IP/usuario
- Escritura sensible: límite más estricto

### 4. Enmascaramiento de Datos (L4)
- Emails enmascarados
- RUCs enmascarados
- Datos de pago eliminados

### 5. Auditoría (L5)
- Registro de todos los accesos
- Registro de todas las modificaciones
- Trazabilidad completa

### 6. Paginación Obligatoria (L6)
- Previene extracción masiva de datos
- Límite máximo: 100 registros

## Testing

### Ejecutar Tests

```bash
# Todos los tests
pnpm test

# Solo tests de auth-helpers
pnpm test auth-helpers

# Con cobertura
pnpm test --coverage
```

### Tests Incluidos

- ✅ Enmascaramiento de emails
- ✅ Enmascaramiento de RUCs
- ✅ Validación de paginación
- ✅ Casos edge (null, undefined, inválidos)

## Monitoreo

### Logs a Revisar

1. **Console Logs**: `[ADMIN_ACTION]` y `[SENSITIVE_DATA_ACCESS]`
2. **Tabla auditoria**: Query periódico para detectar patrones anómalos
3. **Rate Limit Violations**: Revisar intentos de abuso

### Alertas Sugeridas

- Múltiples accesos fallidos de autenticación
- Acceso a datos sensibles fuera de horario laboral
- Paginación con límite máximo repetidamente
- Modificaciones masivas de permisos

## Cumplimiento

Estas mejoras ayudan a cumplir con:

- **GDPR**: Minimización de exposición de datos personales
- **PCI DSS**: Protección de datos de pago (removidos)
- **SOC 2**: Auditoría y trazabilidad
- **ISO 27001**: Control de acceso basado en roles

## Próximos Pasos

1. ⬜ Implementar encriptación adicional para RUCs en BD
2. ⬜ Dashboard de auditoría para platform admins
3. ⬜ Alertas automatizadas de actividad sospechosa
4. ⬜ Exportación de logs de auditoría para cumplimiento
5. ⬜ MFA obligatorio para platform admins

## Referencias

- Código: `lib/auth-helpers.ts`
- Auditoría: `lib/audit-logger.ts`
- Tests: `lib/__tests__/auth-helpers.test.ts`
- Endpoints: `app/api/admin/**`
