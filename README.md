# 🇵🇪 CRM AI Peru

Sistema ERP completo con IA integrada para PYMES peruanas. Gestión de contactos, analytics predictivo, inventario, recursos humanos y más.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## 🚀 Características Principales

### 📊 **Módulos del Sistema**
- **CRM**: Gestión de contactos y leads con scoring automático
- **Facturación**: Emisión de facturas y gestión de pagos
- **Workflows**: Automatización de procesos de negocio
- **Analytics**: Dashboard con métricas en tiempo real
- **IA Integrada**: Chatbot inteligente con MCP Server

### ✨ **Características Técnicas**
- 🎨 UI moderna con Tailwind CSS 4 + shadcn/ui
- 🌙 Modo oscuro/claro
- 📱 Diseño responsive
- 🔐 Autenticación con Supabase
- 🤖 IA conversacional para CRM
- 📈 Analytics predictivos
- 🧾 Generación de reportes HTML profesionales
- ⚡ Optimización con lazy loading y Suspense

## 📋 Requisitos Previos

- **Node.js**: v18 o superior
- **pnpm**: v8 o superior (recomendado) o npm
- **Cuenta de Supabase**: [Crear cuenta gratis](https://supabase.com)

## 🛠️ Instalación

### 1. Clonar el repositorio

```bash
git clone <tu-repositorio>
cd crm-ai-peru
```

### 2. Instalar dependencias

```bash
pnpm install
# o
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anonima
SUPABASE_SERVICE_ROLE_KEY=tu-clave-service-role
```

**🔑 Obtener credenciales de Supabase:**
1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a: `Settings` → `API`
4. Copia `Project URL` y las claves

### 4. Configurar la base de datos

Ejecuta los scripts SQL en Supabase en este orden:

1. **Esquema**: `supabase/01-schema.sql`
2. **Funciones**: `supabase/02-functions.sql`
3. **Triggers**: `supabase/03-triggers.sql`
4. **Políticas RLS**: `supabase/04-rls-policies.sql`
5. **Vistas**: `supabase/05-views.sql`
6. **Datos de ejemplo** (opcional): `supabase/06-sample-data.sql`

**Cómo ejecutar:**
1. Ve a `SQL Editor` en Supabase Dashboard
2. Crea una nueva query
3. Pega el contenido de cada archivo
4. Ejecuta con `Run`

### 5. Iniciar el servidor de desarrollo

```bash
pnpm dev
# o
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📦 Scripts Disponibles

```bash
# Desarrollo
pnpm dev          # Inicia servidor de desarrollo

# Producción
pnpm build        # Construye para producción
pnpm start        # Inicia servidor de producción

# Calidad de código
pnpm lint         # Ejecuta ESLint
```

## 🏗️ Estructura del Proyecto

```
crm-ai-peru/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── ai/chat/         # Endpoints de IA
│   │   ├── invoices/        # Facturación
│   │   ├── mcp/server/      # MCP Server
│   │   └── payments/        # Pagos
│   ├── dashboard/           # Dashboard principal
│   ├── contacts/            # Gestión de contactos
│   ├── analytics/           # Analytics
│   ├── invoicing/           # Facturación
│   └── ...
├── components/              # Componentes React
│   ├── ui/                  # Componentes UI (shadcn)
│   ├── dashboard/           # Componentes del dashboard
│   ├── chatbot/            # Chatbot de IA
│   └── ...
├── lib/                     # Utilidades
├── hooks/                   # React Hooks personalizados
├── supabase/               # Scripts SQL
├── public/                 # Archivos estáticos
└── styles/                 # Estilos globales
```

## 🗄️ Base de Datos

El sistema utiliza **Supabase (PostgreSQL)** con las siguientes tablas principales:

### Módulos
- **Core**: `contacts`, `interactions`, `workflows`, `workflow_executions`
- **Facturación**: `invoices`, `invoice_items`, `payments`
- **Analytics**: `analytics_cache`, `webhook_events`
- **Sistema**: `profiles`, `auditoria`, `chat_messages`, `system_health`

## 🔒 Seguridad

- ✅ Row Level Security (RLS) habilitado
- ✅ Autenticación con Supabase Auth
- ✅ Variables de entorno para credenciales
- ✅ Service Role Key solo en servidor

## 🎨 Tecnologías Utilizadas

### Frontend
- **Next.js 15.2.4** - React Framework
- **React 19** - UI Library
- **TypeScript 5** - Type Safety
- **Tailwind CSS 4** - Estilos
- **shadcn/ui** - Componentes UI
- **Lucide React** - Iconos
- **Recharts** - Gráficos

### Backend
- **Supabase** - Base de datos y autenticación
- **Next.js API Routes** - Endpoints

### Herramientas
- **pnpm** - Gestor de paquetes
- **ESLint** - Linting
- **PostCSS** - Procesamiento CSS

## 🚢 Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio en [Vercel](https://vercel.com)
2. Configura las variables de entorno
3. Despliega automáticamente

### Otras plataformas

El proyecto puede desplegarse en cualquier plataforma que soporte Next.js:
- Railway
- Netlify
- AWS Amplify
- DigitalOcean App Platform

**Variables de entorno requeridas:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## 📝 Características Especiales

### Sistema de Recursos Humanos Automatizado
- ✅ Creación automática de planillas
- ✅ Cálculo automático de sueldos
- ✅ Reportes HTML profesionales
- ✅ Boletas digitales
- ✅ Validaciones inteligentes

### Sistema de Inventario Inteligente
- ✅ Actualización automática de stock
- ✅ Integración con órdenes de compra
- ✅ Creación automática de productos


- ✅ Generación de reportes optimizada
- ✅ Auto-polling para estados
- ✅ Descarga de archivos TXT/Excel

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y está protegido por derechos de autor.

## 💬 Soporte

Si tienes preguntas o problemas:
- Revisa la documentación de [Supabase](https://supabase.com/docs)
- Revisa la documentación de [Next.js](https://nextjs.org/docs)
- Abre un issue en el repositorio

## 🎯 Roadmap

- [ ] Notificaciones push
- [ ] App móvil (React Native)
- [ ] Dashboard de BI avanzado
- [ ] Módulo de Análisis Predictivo
- [ ] Exportación de reportes PDF

---

Hecho con ❤️ para PYMES peruanas

