# Environment Variables

Esta app corre en **Next.js + Supabase**. En Vercel debes configurar las variables en el dashboard; localmente se usan `.env.local` (ignorado por git).

## Core (requeridas)

```env
# URL canónica de la app (sin slash final)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Seguridad (openssl rand -base64 32)
ENCRYPTION_KEY=base64-32-bytes-here

# Protección de cron endpoints (/api/cron/*)
CRON_SECRET=hex-or-random-string
```

## CORS (recomendadas)

```env
# Orígenes permitidos para API protegida (producción: solo dominios finales)
ALLOWED_ORIGINS=https://your-app.vercel.app

# Orígenes permitidos para endpoints públicos embebibles (si aplica)
PUBLIC_FORMS_ALLOWED_ORIGINS=https://your-app.vercel.app
PUBLIC_PAY_ALLOWED_ORIGINS=https://your-app.vercel.app
PUBLIC_BOOKING_ALLOWED_ORIGINS=https://your-app.vercel.app
```

## Redis / BullMQ (recomendadas en producción)

```env
# Upstash recomendado
REDIS_URL=rediss://default:<password>@<host>:6379

# Si Redis cae, permitir requests (rate limit degradado)
RATE_LIMIT_FAIL_OPEN=true
```

## Email (opcional, según módulo)

```env
RESEND_API_KEY=re_xxx
EMAIL_FROM=CRM <no-reply@your-domain.com>
```

## Admin (opcional)

```env
# Allowlist de platform admins (emails separados por coma)
PLATFORM_ADMIN_EMAILS=admin1@domain.com,admin2@domain.com
PLATFORM_ADMIN_USER_IDS=
```

## Observabilidad (opcional)

```env
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=vercel
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
```

## Stripe (opcional)

```env
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
```

## WhatsApp (opcional)

```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

