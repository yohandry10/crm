# Production Environment Variables (Vercel)

Este template es para **Vercel Production**. No pegues secretos en repos públicos.

## Obligatorias

```env
# Base URL de tu app (sin slash final)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Seguridad (genera con: openssl rand -base64 32)
ENCRYPTION_KEY=base64-32-bytes-here

# Cron protection (para /api/cron/*)
CRON_SECRET=hex-or-random-string

# CORS (producción: solo dominios finales)
ALLOWED_ORIGINS=https://your-app.vercel.app

# CORS para endpoints públicos embebibles (si aplica)
PUBLIC_FORMS_ALLOWED_ORIGINS=https://your-app.vercel.app
PUBLIC_PAY_ALLOWED_ORIGINS=https://your-app.vercel.app
PUBLIC_BOOKING_ALLOWED_ORIGINS=https://your-app.vercel.app

# Email (Resend)
RESEND_API_KEY=re_xxx
EMAIL_FROM=CRM <no-reply@your-domain.com>
```

## Recomendadas (producción)

```env
# Redis (Upstash recomendado para BullMQ / rate-limit distribuido)
REDIS_URL=rediss://default:<password>@<host>:6379

# Si Redis cae, permitir requests (rate limit degradado)
RATE_LIMIT_FAIL_OPEN=true

# Admin allowlist (opcional)
PLATFORM_ADMIN_EMAILS=admin1@domain.com,admin2@domain.com
PLATFORM_ADMIN_USER_IDS=
```

## Opcionales por módulo

```env
# Sentry (opcional)
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=vercel
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production

# Stripe (opcional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_SUCCESS_URL=
STRIPE_CANCEL_URL=
STRIPE_PRICE_STARTER_MONTHLY=
STRIPE_PRICE_STARTER_YEARLY=
STRIPE_PRICE_PROFESSIONAL_MONTHLY=
STRIPE_PRICE_PROFESSIONAL_YEARLY=
STRIPE_PRICE_ENTERPRISE_MONTHLY=
STRIPE_PRICE_ENTERPRISE_YEARLY=

# WhatsApp (opcional)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# OpenAI (opcional)
OPENAI_API_KEY=

# Observabilidad OTEL (opcional)
OTEL_ENABLED=false
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_SERVICE_NAME=crm
```

