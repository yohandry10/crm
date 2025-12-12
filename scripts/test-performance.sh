#!/bin/bash

# Script para testear rendimiento después de las optimizaciones
# Ejecutar: bash scripts/test-performance.sh

echo "🚀 Testing de Rendimiento - Optimizaciones del Sidebar"
echo "========================================================"
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Analizar Bundle Size
echo -e "${BLUE}📦 1. Analizando Bundle Size...${NC}"
echo "Ejecutando: ANALYZE=true npm run build"
echo ""
# Descomentar para ejecutar:
# ANALYZE=true npm run build

echo -e "${YELLOW}💡 Para ejecutar manualmente:${NC}"
echo "   ANALYZE=true npm run build"
echo ""

# 2. Lighthouse CI
echo -e "${BLUE}⚡ 2. Ejecutando Lighthouse (Performance)...${NC}"
echo ""
echo -e "${YELLOW}💡 Instalar lighthouse:${NC}"
echo "   npm install -g @lhci/cli"
echo ""
echo -e "${YELLOW}💡 Ejecutar lighthouse:${NC}"
echo "   # Primero inicia el servidor"
echo "   npm run dev"
echo "   # En otra terminal:"
echo "   npx lighthouse http://localhost:3000/dashboard --view"
echo ""

# 3. Bundle size check
echo -e "${BLUE}📊 3. Verificando tamaño de bundles...${NC}"
echo ""
if [ -d ".next-build" ]; then
    echo "Bundle sizes:"
    du -sh .next-build/static/chunks/*.js 2>/dev/null | head -10
    echo ""
    echo "Total bundle size:"
    du -sh .next-build/static
else
    echo -e "${YELLOW}⚠️  No se encontró build. Ejecuta: npm run build${NC}"
fi
echo ""

# 4. Network requests check
echo -e "${BLUE}🔍 4. Verificar requests de red...${NC}"
echo ""
echo "Pasos manuales:"
echo "1. Abrir DevTools (F12)"
echo "2. Ir a Network tab"
echo "3. Navegar entre módulos"
echo "4. Verificar que NO hay requests duplicados de user profile"
echo "5. Verificar que las rutas se precargan (ver prefetch requests)"
echo ""

# 5. React DevTools check
echo -e "${BLUE}⚛️  5. Verificar re-renders con React DevTools...${NC}"
echo ""
echo "Pasos manuales:"
echo "1. Instalar React DevTools (extensión de Chrome/Firefox)"
echo "2. Abrir DevTools → Profiler tab"
echo "3. Iniciar grabación"
echo "4. Navegar entre 2-3 módulos"
echo "5. Detener grabación"
echo "6. Verificar que solo 2 componentes se re-renderizan en el sidebar"
echo ""

# 6. Resumen de métricas esperadas
echo -e "${BLUE}📈 6. Métricas Esperadas${NC}"
echo ""
echo "┌─────────────────────────────┬──────────┬──────────┬─────────┐"
echo "│ Métrica                     │ Antes    │ Después  │ Mejora  │"
echo "├─────────────────────────────┼──────────┼──────────┼─────────┤"
echo "│ Navegación entre módulos    │ 800-1500ms│ 150-400ms│ 70-80% │"
echo "│ Re-renders del sidebar      │ 18/ruta  │ 2/ruta   │ 89%    │"
echo "│ Queries a BD (sidebar)      │ 3/mount  │ 1/mount  │ 67%    │"
echo "│ Bundle inicial              │ 450KB    │ 280KB    │ 38%    │"
echo "│ First Contentful Paint      │ 1.8s     │ 1.2s     │ 33%    │"
echo "│ Lighthouse Performance      │ 70-80    │ 85-95    │ +15pts │"
echo "└─────────────────────────────┴──────────┴──────────┴─────────┘"
echo ""

# 7. Checklist
echo -e "${BLUE}✅ 7. Checklist de Verificación${NC}"
echo ""
echo "[ ] El sidebar no re-renderiza en cada cambio de ruta"
echo "[ ] La navegación se siente instantánea"
echo "[ ] Los skeletons aparecen inmediatamente"
echo "[ ] El caché de usuario funciona (0 requests después del primero)"
echo "[ ] No hay layout shift durante la carga"
echo "[ ] La barra de progreso aparece durante navegación"
echo "[ ] El bundle size se redujo"
echo "[ ] Lighthouse Performance score > 90"
echo ""

# 8. Comandos útiles
echo -e "${BLUE}🛠️  8. Comandos Útiles${NC}"
echo ""
echo "# Build y analizar bundle"
echo "ANALYZE=true npm run build"
echo ""
echo "# Lighthouse"
echo "npx lighthouse http://localhost:3000/dashboard --view"
echo ""
echo "# Ver tamaño de chunks"
echo "du -sh .next-build/static/chunks/*.js | sort -h"
echo ""
echo "# Limpiar caché de Next.js"
echo "rm -rf .next-build"
echo ""
echo "# Ejecutar en modo producción"
echo "npm run build && npm run start"
echo ""

echo -e "${GREEN}✨ Testing de rendimiento preparado!${NC}"
echo ""
echo "Para más información, consulta:"
echo "  📖 docs/OPTIMIZACIONES-SIDEBAR.md"
echo "  💻 docs/EJEMPLOS-IMPLEMENTACION.md"
echo "  📋 RESUMEN-OPTIMIZACIONES.md"
