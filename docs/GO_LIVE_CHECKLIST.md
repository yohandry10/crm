# Go-Live Checklist (Venta / Producción)

Este documento separa **bloqueadores de venta** vs **post-launch** por módulo, y una lista de verificación para publicar en producción.

## Bloqueadores Globales (antes de vender)

1. **Multi-tenant consistente (Org context)**
   - Confirmar que todos los inserts/updates usan `organization_id` correcto o que la BD lo infiere (migración `089_tenant_insert_safety_defaults.sql`).
   - Confirmar que cada usuario tiene `profiles.current_organization_id` y un `organization_members` activo.

2. **Workflows y colas (BullMQ)**
   - BullMQ requiere **Redis estable** y un **worker** corriendo fuera de Vercel (Vercel no ejecuta procesos persistentes).
   - Decisión de producto:
     - Opción A: habilitar Workflows solo si hay worker en producción.
     - Opción B: ocultar/deshabilitar Workflows hasta tener worker.

3. **Reportes (builder) - seguridad y robustez**
   - El endpoint `/api/reports/run` permite `entity` y `filters.field` desde el cliente.
   - Recomendado antes de vender: **allowlist** de entidades/campos para evitar consultas inesperadas y errores 500 por columnas inexistentes.

4. **Dominios / Auth / CORS**
   - Al cambiar dominio (Vercel): actualizar simultáneamente:
     - `NEXT_PUBLIC_APP_URL` (Vercel prod env)
     - `ALLOWED_ORIGINS`
     - `PUBLIC_FORMS_ALLOWED_ORIGINS`, `PUBLIC_BOOKING_ALLOWED_ORIGINS`, `PUBLIC_PAY_ALLOWED_ORIGINS`
     - Supabase Auth: **Site URL** y **Redirect URLs** (Google OAuth depende de esto)
     - Google Cloud Console: Authorized redirect URIs / Authorized domains (si aplica)

5. **Endpoints públicos con service role**
   - `app/api/public/*` y `app/api/calendar/booking` usan `SUPABASE_SERVICE_ROLE_KEY`.
   - Antes de vender: asegurar límites, validación estricta, y `PUBLIC_*_ALLOWED_ORIGINS` configurados (si quedan vacíos, la lógica actualmente es permisiva).

## Módulos (bloqueadores vs post-launch)

### Dashboard
- Bloqueadores:
  - Si depende de `/api/auth/bootstrap` y falla por contexto de organización, rompe el resto (errores cascada 500/403).
- Post-launch:
  - Métricas reales por rol, performance (caching por org).

### Contactos
- Bloqueadores:
  - RLS/tenant: insert/update debe persistir `organization_id` siempre.
- Post-launch:
  - Importación masiva, deduplicación avanzada, enrichment.

### Leads
- Bloqueadores:
  - Conversión Lead -> Contacto/Oportunidad debe mantener `organization_id` (y no duplicar datos).
- Post-launch:
  - Scoring automático, fuentes personalizables por org.

### Oportunidades (Pipeline)
- Bloqueadores:
  - Asegurar que existen `pipeline_stages` por organización (si no, usuarios sin permisos de admin pueden quedar bloqueados creando oportunidades).
  - Drag & drop debe actualizar `stage_id` real (UUID) y persistir.
- Post-launch:
  - Automatizaciones por etapa, forecast, objetivos.

### Cotizaciones
- Bloqueadores:
  - Generación/preview PDF estable (sin exponer datos fuera de org).
- Post-launch:
  - Plantillas, firma, aprobación.

### Facturación
- Bloqueadores:
  - Estados coherentes, totales correctos, RLS.
- Post-launch (Stripe al final):
  - Cobro online, dunning, suscripciones.

### Productos
- Bloqueadores:
  - Consistencia con Inventario (si descuentan stock).
- Post-launch:
  - Variantes, listas de precios.

### Campañas
- Bloqueadores:
  - Envío de emails depende de Resend configurado.
- Post-launch:
  - Segmentación, A/B, tracking.

### Formularios (públicos)
- Bloqueadores:
  - `PUBLIC_FORMS_ALLOWED_ORIGINS` debe estar configurado (si no, se vuelve “allow all”).
  - Rate limit + antispam (honeypot) ok.
- Post-launch:
  - reCAPTCHA/Turnstile, plantillas, embebido con temas.

### Tareas
- Bloqueadores:
  - CRUD con RLS y filtros por organización.
- Post-launch:
  - Notificaciones push/email.

### Calendario (booking)
- Bloqueadores:
  - `PUBLIC_BOOKING_ALLOWED_ORIGINS` configurado.
  - Evitar doble-booking (conflict check ok).
- Post-launch:
  - Integración Google Calendar, ICS, recordatorios.

### Inventario
- Bloqueadores:
  - Integridad (movimientos, stock no negativo).
- Post-launch:
  - Auditoría, multi-almacén.

### Analytics
- Bloqueadores:
  - Endpoints reales usados por UI deben ser consistentes y con límites.
- Post-launch:
  - “advanced” (si se expone) está con TODO; ocultar hasta implementar.

### Reportes
- Bloqueadores:
  - Allowlist de `entity/groupBy/filters` en `/api/reports/run`.
- Post-launch:
  - Exportación avanzada, programados.

### Workflows
- Bloqueadores:
  - Worker en producción + Redis.
  - Sin worker: el módulo debe ocultarse o degradar.
- Post-launch:
  - UI de logs, retries, versionado.

### Integraciones
- Bloqueadores:
  - Asegurar que integraciones “demo” no se venden como completas.
- Post-launch:
  - WhatsApp test (hay TODO), Gmail sync (TODO token refresh).

### Configuración
- Bloqueadores:
  - Equipo/invitaciones/roles consistentes.
- Post-launch:
  - Ajustes globales (platform settings) aplicados a signup/trial/mantenimiento.

## Checklist Go-Live (Producción)

### 1) Base de Datos (Supabase)
- Aplicar migraciones nuevas en prod:
  - `088_restore_bootstrap_and_backfill_auth.sql`
  - `089_tenant_insert_safety_defaults.sql`
  - `090_platform_settings.sql`
  - `091_seed_default_pipeline_stages.sql`
- Verificar RLS habilitado en tablas sensibles.
- Verificar funciones/triggers de bootstrap activos:
  - `on_auth_user_created` (auth.users -> profiles)
  - `on_organization_created` (organizations -> organization_members + profile org)
- Backup/restore probado (ver `docs/BACKUP_RESTORE.md`).

### 2) Auth y Dominios
- Supabase Auth:
  - Site URL = dominio final (ej: `https://crm-iota-inky.vercel.app`)
  - Redirect URLs incluye:
    - `https://<dominio>/auth/callback`
    - `https://<dominio>/`
    - `https://<dominio>/reset-password`
- Google OAuth:
  - Authorized redirect URI coincide con `/auth/callback`.

### 3) Variables de Entorno (Vercel)
- Obligatorio:
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ENCRYPTION_KEY`
  - `CRON_SECRET`
- Email:
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
- CORS:
  - `ALLOWED_ORIGINS` incluye el dominio final
  - `PUBLIC_FORMS_ALLOWED_ORIGINS`, `PUBLIC_BOOKING_ALLOWED_ORIGINS`, `PUBLIC_PAY_ALLOWED_ORIGINS`
- Redis (si hay Workflows/BullMQ):
  - `REDIS_URL`
  - Opción A (recomendado si NO quieres otro host): Cloudflare Worker (cron) llamando al drainer: ver `docs/CLOUDFLARE_WORKER_CRON.md`
  - Opción B: worker persistente (VPS/railway/etc.)

### 4) Observabilidad / Operación
- Sentry:
  - `SENTRY_DSN`, `SENTRY_ENVIRONMENT=production`, `SENTRY_RELEASE`
- Alertas:
  - Errores 5xx, latencia API, fallos de Redis, fallos de email.

### 5) Verificación Rápida
- Ejecutar:
  - `pnpm run typecheck`
  - `pnpm exec vitest run`
  - `pnpm run build`
- Smoke test manual:
  - Signup/Login (email + Google)
  - Crear org / invitar miembro
  - Crear contacto
  - Crear oportunidad (drag stages)
  - Crear cotización/factura (preview PDF)
  - Formularios públicos (submit)
  - Booking público (reservar)
