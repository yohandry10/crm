# Production Environment Variables Template

# ====================================
# SUPABASE
# ====================================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# ====================================
# APPLICATION
# ====================================
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production

# ====================================
# PAYMENTS (CULQI)
SMTP_FROM_EMAIL=no-reply@your-domain.com
SMTP_FROM_NAME=CRM AI Peru

# ====================================
# MONITORING & LOGGING
# ====================================
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SENTRY_ORG=your-org
SENTRY_PROJECT=crm-ai-peru

# DataDog (optional)
DD_API_KEY=xxxxx
DD_APP_KEY=xxxxx

# ====================================
# RATE LIMITING
# ====================================
# Use Redis for distributed rate limiting in production
REDIS_URL=redis://xxxxx:6379
REDIS_PASSWORD=xxxxx

# ====================================
# AI / LLM (Optional)
# ====================================
OPENAI_API_KEY=sk-xxxxx
ANTHROPIC_API_KEY=sk-xxxxx

# ====================================
# SECURITY
# ====================================
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=xxxxx
ENCRYPTION_KEY=xxxxx

# CORS allowed origins (comma-separated)
ALLOWED_ORIGINS=https://your-domain.com,https://admin.your-domain.com
# Production Environment Variables Template

# ====================================
# SUPABASE
# ====================================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# ====================================
# APPLICATION
# ====================================
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production

# ====================================
# PAYMENTS (CULQI)
SMTP_FROM_EMAIL=no-reply@your-domain.com
SMTP_FROM_NAME=CRM AI Peru

# ====================================
# MONITORING & LOGGING
# ====================================
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SENTRY_ORG=your-org
SENTRY_PROJECT=crm-ai-peru

# DataDog (optional)
DD_API_KEY=xxxxx
DD_APP_KEY=xxxxx

# ====================================
# RATE LIMITING
# ====================================
# Use Redis for distributed rate limiting in production
REDIS_URL=redis://xxxxx:6379
REDIS_PASSWORD=xxxxx

# ====================================
# AI / LLM (Optional)
# ====================================
OPENAI_API_KEY=sk-xxxxx
ANTHROPIC_API_KEY=sk-xxxxx

# ====================================
# SECURITY
# ====================================
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=xxxxx
ENCRYPTION_KEY=xxxxx

# CORS allowed origins (comma-separated)
ALLOWED_ORIGINS=https://your-domain.com,https://admin.your-domain.com

# ====================================
# FEATURE FLAGS
# ====================================
ENABLE_AI_FEATURES=true
ENABLE_CULQI_PAYMENTS=true
ENABLE_WHATSAPP_INTEGRATION=false
ENABLE_MONITORING=true

# ====================================
# WEBHOOKS
# ====================================
WEBHOOK_SECRET=xxxxx # For signing outgoing webhooks
