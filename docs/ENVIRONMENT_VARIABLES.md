# Environment Variables Documentation

## Required Variables

### Application
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Payment Gateways
```
CULQI_SECRET_KEY=sk_test_your_culqi_secret_key
CULQI_WEBHOOK_SECRET=your_culqi_webhook_secret
```

### Email Service (Resend)
```
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

## Optional Variables

### WhatsApp Integration
```
WHATSAPP_API_KEY=your_whatsapp_business_api_key
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
```

### Concar Integration
```
CONCAR_USERNAME=your_concar_username
CONCAR_PASSWORD=your_concar_password
CONCAR_COMPANY_CODE=your_company_code
```

### Google Integration
```
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

### LMS Integration
```
LMS_URL=https://your-lms-domain.com
LMS_TOKEN=your_lms_api_token
```
