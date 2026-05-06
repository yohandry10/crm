# Auditoria de producto vendible

Actualizado: 2026-05-06.

## Criterio de mercado

La comparacion con CRMs maduros como HubSpot, Pipedrive y Zoho deja un estandar claro: el producto debe reducir trabajo administrativo y cerrar un flujo comercial completo, no solo listar registros.

Un CRM vendible debe cubrir como minimo:

- Contactos, cuentas y leads con historial y contexto.
- Pipeline visual con oportunidades, etapas, valor, probabilidad y siguiente actividad.
- Tareas/calendario como motor diario de seguimiento.
- Productos, cotizaciones, facturas y pagos conectados al pipeline.
- Formularios/campanas para capturar demanda.
- Reportes utiles para pipeline, actividad y conversion.
- Roles, auditoria, multi-tenant y seguridad consistentes.
- Integraciones/webhooks sin exponer secretos ni prometer estados falsos.

Contrato SaaS validado: el superadmin vende accesos a organizaciones; cada organizacion es un tenant independiente. Un usuario puede pertenecer a varias organizaciones, pero cada request debe resolverse contra una membresia activa y no puede leer, escribir ni referenciar datos de otro tenant. La aplicacion ya no crea organizaciones automaticamente desde signup/login/bootstrap.

## Estado por modulo

| Modulo | Estado producto | Observacion QA/producto |
| --- | --- | --- |
| Dashboard | Vendible como vista inicial | Muestra metricas clave y actividad; debe evolucionar hacia "siguiente accion" por usuario. |
| Cuentas/contactos | Vendible | Base real de CRM; conectado con leads, actividad y registros relacionados. |
| Leads | Vendible con mejora pendiente | Captura y gestion operativa; falta scoring/priorizacion mas visible tipo CRM moderno. |
| Pipeline/oportunidades | Vendible | Es el nucleo comercial; debe mantenerse como flujo principal lead/contacto -> oportunidad -> cotizacion. |
| Tareas/calendario | Vendible | Soporta trabajo diario; las pruebas cubren creacion y lectura real. |
| Productos/inventario | Vendible para SMB | Diferenciador frente a CRMs simples; requiere mantener consistencia stock/facturacion. |
| Cotizaciones/facturas/pagos | Vendible | Cierra el ciclo comercial; pagos externos quedan en modo fallback/manual hasta credenciales reales. |
| Campanas/formularios | Vendible inicial | Util para captura; necesita analitica de conversion mas profunda para competir fuerte. |
| Tickets | Vendible basico | Sirve postventa; no debe venderse como helpdesk avanzado todavia. |
| Workflows | Vendible con limitacion operativa | Interno y probado; near-real-time requiere worker persistente en produccion. |
| Integraciones/webhooks | Vendible tecnico | Se reforzo cifrado y masking; debe evitar logs con secretos. |
| Admin/roles/auditoria | Vendible para multi-tenant | Roles y RLS verificados; controles en memoria no deben presentarse como persistentes. |
| Plataforma/tenants | Vendible | Platform admin gestiona organizaciones y suscripciones; usuarios de organizacion quedan aislados por tenant y no acceden a controles de plataforma. |

## Correcciones aplicadas por esta auditoria

- Settings usa la misma politica de contrasena que backend, perfil y reset.
- Logs de errores sanitizan claves sensibles antes de emitir `requestBody`.
- CSRF mantiene excepciones funcionales, pero mutaciones autenticadas excluidas validan Origin.
- Feature flags y circuit breakers en memoria no se pueden mutar en produccion salvo opt-in explicito.
- Cotizaciones separa acciones de negocio: aceptar valida stock y cambia estado; facturar crea factura y descuenta inventario mediante el flujo explicito de conversion.
- Tareas ordena por vencimiento y desempata por creacion reciente para que una tarea recien creada aparezca en la primera vista diaria.
- Cotizaciones tiene guards de rol para actualizar, eliminar y convertir, evitando saltos directos por API.
- Las rutas admin usan una autorizacion comun de platform admin; se elimino logica duplicada que podia divergir.
- La invitacion de organizaciones desde plataforma valida que el token pertenezca a la organizacion y email indicados, que no este aceptado y que no haya expirado.
- La frontera de venta/operacion queda separada: platform admin gestiona organizaciones, planes, suscripciones y usuarios; los roles de organizacion operan el CRM sin acceso a controles de plataforma.
- Registro, login, callback OAuth y onboarding quedaron alineados como flujo de entrada: redirecciones sanitizadas, contrasenas consistentes, RUC no bloqueante e IGV expresado en porcentaje para usuarios.
- Calendario prioriza eventos recien creados cuando hay saturacion en un dia, reduciendo confusion despues de guardar.
- El selector tecnico de organizacion por `x-organization-id` quedo seguro para usuarios multi-tenant: valida membresia activa y no sobreescribe la organizacion por defecto en cache.
- Se agrego una prueba E2E de aislamiento tenant con organizaciones A/B, usuarios separados y usuario multi-organizacion. Cubre contactos, acceso directo por ID, referencias cruzadas en oportunidades y enlaces de pago sobre cotizaciones.
- Se bloqueo el autoprovicionamiento de tenants por usuario regular: `organizations` no concede insert a `authenticated`, `/api/organizations POST` responde 403 y el bootstrap de auth no crea workspaces personales.
- Se alineo la BD con el codigo agregando `user_settings` con RLS y ampliando el verificador de produccion a todas las tablas/RPC usadas por la app.

## Posicionamiento honesto

El producto es realista para venderse como CRM operativo para pymes que necesitan ventas, inventario ligero, cotizaciones, facturacion manual y seguimiento interno.

No debe venderse todavia como:

- Automatizacion enterprise en tiempo real sin worker persistente.
- Plataforma avanzada de marketing automation.
- Helpdesk completo con SLAs complejos.
- Sistema financiero/contable completo.
- Integraciones de pago productivas hasta tener credenciales reales de proveedor.

## Siguiente barra de calidad

- Convertir el dashboard en una bandeja de acciones: tareas vencidas, oportunidades sin actividad, cotizaciones por vencer y pagos pendientes.
- Mostrar en cada contacto/cuenta una linea de tiempo unificada de tareas, oportunidades, cotizaciones, facturas, tickets y notas.
- Agregar pruebas E2E que validen conversion completa: lead -> oportunidad -> cotizacion -> factura -> pago.
- Extender el flujo E2E actual para cubrir pago parcial/completo desde factura y reflejo en dashboard.
- Persistir feature flags/circuit breaker overrides si se quieren usar como controles reales de produccion.
- Medir conversion por fuente/campana/formulario para que marketing no sea solo almacenamiento.
- Agregar auditoria visual periodica de componentes admin cuando se agreguen nuevos controles comerciales o billing real.
