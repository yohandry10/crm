# Variables de entorno

Configurar localmente en `.env.local`. En produccion, configurar en el proveedor de despliegue.

## Requeridas

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

ENCRYPTION_KEY=base64-32-bytes
CRON_SECRET=random-secret
```

## CORS

```env
ALLOWED_ORIGINS=https://your-app.example.com
PUBLIC_FORMS_ALLOWED_ORIGINS=https://your-app.example.com
PUBLIC_PAY_ALLOWED_ORIGINS=https://your-app.example.com
PUBLIC_BOOKING_ALLOWED_ORIGINS=https://your-app.example.com
```

Las rutas publicas de formularios, pagos y booking usan allowlists especificas por handler y fallan cerrado en produccion si la variable correspondiente no esta configurada.

## Redis / BullMQ

```env
REDIS_URL=rediss://default:<password>@<host>:6379
RATE_LIMIT_FAIL_OPEN=false
WORKER_PROCESS_CONFIGURED=false
EXTERNAL_CRON_CONFIGURED=false
VERCEL_PLAN=hobby
WORKFLOW_PROCESSING_MODE=cron-drainer
```

Politica de produccion: `RATE_LIMIT_FAIL_OPEN=false`. Redis es obligatorio para rate limit consistente y BullMQ. `WORKER_PROCESS_CONFIGURED=true` solo debe usarse cuando exista un proceso persistente ejecutando `pnpm worker`; si no, el drainer por cron es un respaldo acotado.

`EXTERNAL_CRON_CONFIGURED=true` solo debe usarse si no se deploya con Vercel Cron y existe un scheduler externo autenticado que invoque `/api/cron/*` con `CRON_SECRET`.

`VERCEL_PLAN=hobby` usa el perfil diario compatible con el plan actual: `/api/cron/daily-maintenance` y `/api/cron/process-workflows`. `VERCEL_PLAN=pro` o `enterprise` puede usar cron frecuentes si se cambia `vercel.json` a ese perfil.

`WORKFLOW_PROCESSING_MODE=cron-drainer` usa el drenado acotado por cron. Usar `worker` solo si existe proceso persistente y `WORKER_PROCESS_CONFIGURED=true`.

Ver [OPERATIONS.md](OPERATIONS.md).

## Email

```env
RESEND_API_KEY=re_xxx
EMAIL_FROM=CRM <no-reply@your-domain.com>
```

## Platform admin

```env
PLATFORM_ADMIN_EMAILS=admin@domain.com
PLATFORM_ADMIN_USER_IDS=
```

No debe existir un usuario superadmin hardcodeado en codigo. El acceso platform admin se concede por `profiles.is_platform_admin` o por estas allowlists explicitas.

## Observabilidad

```env
OTEL_ENABLED=false
OTEL_SERVICE_NAME=crm-ai-peru
OTEL_EXPORTER_OTLP_ENDPOINT=
HONEYCOMB_API_KEY=
HONEYCOMB_DATASET=crm-production

SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=
```

No documentar Sentry/OpenTelemetry como activo si estas variables y dependencias no estan verificadas.

## Pagos

```env
BILLING_PROVIDER=manual
PAYMENT_GATEWAYS_ENABLED=bank_transfer,cash,yape,plin,manual
CULQI_PUBLIC_KEY=
CULQI_SECRET_KEY=
CULQI_WEBHOOK_SECRET=
PAGOEFECTIVO_API_KEY=
PAGOEFECTIVO_WEBHOOK_SECRET=
```

Valores soportados de `BILLING_PROVIDER`: `manual`, `disabled`, `culqi`, `pagoefectivo`, `culqi_pagoefectivo`. La configuracion de produccion actual usa `manual`, por lo que no exige credenciales externas y solo habilita gateways manuales/locales por defecto. En modo `manual`, checkout registra una solicitud pendiente y la activacion queda en el flujo admin. `pnpm production:check` falla si se selecciona un proveedor externo y faltan sus credenciales. La app no usa Stripe como proveedor activo.

## AI

```env
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=
```

Usar `AI_PROVIDER=gemini` solo con `GEMINI_API_KEY` configurado. Con `local`, `fallback` o `disabled`, el preflight no exige proveedor externo y la app responde con fallback local.

## WhatsApp

```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

## Verificacion de produccion

```bash
pnpm production:check
pnpm production:verify-db
```

El preflight carga `.env.production.local`, `.env.production`, `.env.local` y `.env` sin imprimir secretos. Falla si faltan variables requeridas, si CORS publico permite origenes inseguros, si Redis no esta configurado, si falta cron, si falta alguna migracion critica o si se habilita fail-open en rate limiting.

`production:verify-db` ejecuta la RPC `verify_production_readiness` contra Supabase con service role. Requiere aplicar las migraciones `101_production_readiness_verification_rpc.sql`, `102_payment_provider_settings.sql` y `103_target_db_verification_fixes.sql` en la base objetivo.
