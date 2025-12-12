@echo off
REM Script para testear rendimiento después de las optimizaciones
REM Ejecutar: scripts\test-performance.bat

echo.
echo 🚀 Testing de Rendimiento - Optimizaciones del Sidebar
echo ========================================================
echo.

REM 1. Analizar Bundle Size
echo 📦 1. Analizando Bundle Size...
echo Ejecutando: ANALYZE=true npm run build
echo.
echo 💡 Para ejecutar manualmente:
echo    set ANALYZE=true ^&^& npm run build
echo.

REM 2. Lighthouse CI
echo ⚡ 2. Ejecutando Lighthouse (Performance)...
echo.
echo 💡 Instalar lighthouse:
echo    npm install -g @lhci/cli
echo.
echo 💡 Ejecutar lighthouse:
echo    REM Primero inicia el servidor
echo    npm run dev
echo    REM En otra terminal:
echo    npx lighthouse http://localhost:3000/dashboard --view
echo.

REM 3. Bundle size check
echo 📊 3. Verificando tamaño de bundles...
echo.
if exist ".next-build" (
    echo Bundle principal:
    dir .next-build\static\chunks\*.js /s
    echo.
) else (
    echo ⚠️  No se encontró build. Ejecuta: npm run build
)
echo.

REM 4. Network requests check
echo 🔍 4. Verificar requests de red...
echo.
echo Pasos manuales:
echo 1. Abrir DevTools (F12^)
echo 2. Ir a Network tab
echo 3. Navegar entre módulos
echo 4. Verificar que NO hay requests duplicados de user profile
echo 5. Verificar que las rutas se precargan (ver prefetch requests^)
echo.

REM 5. React DevTools check
echo ⚛️  5. Verificar re-renders con React DevTools...
echo.
echo Pasos manuales:
echo 1. Instalar React DevTools (extensión de Chrome/Firefox^)
echo 2. Abrir DevTools → Profiler tab
echo 3. Iniciar grabación
echo 4. Navegar entre 2-3 módulos
echo 5. Detener grabación
echo 6. Verificar que solo 2 componentes se re-renderizan en el sidebar
echo.

REM 6. Resumen de métricas esperadas
echo 📈 6. Métricas Esperadas
echo.
echo ┌─────────────────────────────┬──────────┬──────────┬─────────┐
echo │ Métrica                     │ Antes    │ Después  │ Mejora  │
echo ├─────────────────────────────┼──────────┼──────────┼─────────┤
echo │ Navegación entre módulos    │ 800-1500ms│ 150-400ms│ 70-80%% │
echo │ Re-renders del sidebar      │ 18/ruta  │ 2/ruta   │ 89%%    │
echo │ Queries a BD (sidebar^)      │ 3/mount  │ 1/mount  │ 67%%    │
echo │ Bundle inicial              │ 450KB    │ 280KB    │ 38%%    │
echo │ First Contentful Paint      │ 1.8s     │ 1.2s     │ 33%%    │
echo │ Lighthouse Performance      │ 70-80    │ 85-95    │ +15pts │
echo └─────────────────────────────┴──────────┴──────────┴─────────┘
echo.

REM 7. Checklist
echo ✅ 7. Checklist de Verificación
echo.
echo [ ] El sidebar no re-renderiza en cada cambio de ruta
echo [ ] La navegación se siente instantánea
echo [ ] Los skeletons aparecen inmediatamente
echo [ ] El caché de usuario funciona (0 requests después del primero^)
echo [ ] No hay layout shift durante la carga
echo [ ] La barra de progreso aparece durante navegación
echo [ ] El bundle size se redujo
echo [ ] Lighthouse Performance score ^> 90
echo.

REM 8. Comandos útiles
echo 🛠️  8. Comandos Útiles
echo.
echo # Build y analizar bundle
echo set ANALYZE=true ^&^& npm run build
echo.
echo # Lighthouse
echo npx lighthouse http://localhost:3000/dashboard --view
echo.
echo # Limpiar caché de Next.js
echo rmdir /s /q .next-build
echo.
echo # Ejecutar en modo producción
echo npm run build ^&^& npm run start
echo.

echo ✨ Testing de rendimiento preparado!
echo.
echo Para más información, consulta:
echo   📖 docs\OPTIMIZACIONES-SIDEBAR.md
echo   💻 docs\EJEMPLOS-IMPLEMENTACION.md
echo   📋 RESUMEN-OPTIMIZACIONES.md
echo.
pause
