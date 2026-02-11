import { ModuleTutorial } from "./module-tutorial"

export const moduleTutorials: Record<string, ModuleTutorial> = {
  contacts: {
    id: "contacts",
    moduleName: "Contactos",
    moduleIcon: "contacts",
    description: "Gestiona tu base de datos de contactos",
    steps: [
      {
        title: "¿Qué son los Contactos?",
        description: "Los contactos son las personas con las que interactúas en tu negocio: clientes, prospectos, proveedores, etc. Cada contacto tiene información personal, de contacto y puede estar asociado a una cuenta (empresa).",
        tip: "Un contacto puede existir sin cuenta, pero asociarlo a una te permite ver todas las interacciones de esa empresa."
      },
      {
        title: "Crear un Contacto",
        description: "Haz clic en 'Nuevo Contacto' para agregar una persona. Los campos esenciales son: nombre, email y teléfono. Puedes agregar campos personalizados según tu negocio.",
        tip: "Importa contactos masivamente desde Excel usando el botón 'Importar'."
      },
      {
        title: "Asociar a Cuentas",
        description: "Vincula contactos a cuentas (empresas) para tener una vista completa. Un contacto puede ser el 'contacto principal' de una cuenta, lo que lo marca como el punto de contacto preferido.",
      },
      {
        title: "Interacciones y Actividades",
        description: "Desde el perfil del contacto puedes ver todas las interacciones: emails enviados, llamadas, reuniones, oportunidades y tickets asociados. Todo en un solo lugar.",
        tip: "Usa las notas para registrar información importante de cada conversación."
      },
      {
        title: "Conexión con otros módulos",
        description: "Los contactos se conectan con: Leads (cuando calificas un lead, se crea un contacto), Oportunidades (cada venta tiene un contacto asociado), Tickets (soporte al cliente), y Facturas (a quién facturas).",
      }
    ],
    relatedModules: ["Cuentas", "Leads", "Oportunidades", "Tickets"]
  },

  accounts: {
    id: "accounts",
    moduleName: "Cuentas",
    moduleIcon: "accounts",
    description: "Administra las empresas y organizaciones",
    steps: [
      {
        title: "¿Qué son las Cuentas?",
        description: "Las cuentas representan empresas u organizaciones con las que haces negocios. Pueden ser clientes actuales, prospectos corporativos o proveedores. Cada cuenta agrupa a múltiples contactos.",
      },
      {
        title: "Información de la Cuenta",
        description: "Registra datos como: razón social, RUC, dirección, industria, tamaño de empresa, sitio web y redes sociales. Esta información es crucial para segmentar y personalizar tu comunicación.",
        tip: "El RUC se valida automáticamente para empresas peruanas."
      },
      {
        title: "Jerarquía de Cuentas",
        description: "Puedes crear cuentas padre e hijas para representar corporaciones con subsidiarias. Esto te permite ver el valor total de un grupo empresarial.",
      },
      {
        title: "Vista 360° de la Cuenta",
        description: "En el perfil de cada cuenta verás: todos los contactos, oportunidades activas, historial de compras, tickets de soporte, y el valor total del cliente (lifetime value).",
        tip: "Usa los filtros para ver solo oportunidades ganadas o pendientes."
      },
      {
        title: "Conexión con otros módulos",
        description: "Las cuentas se conectan con: Contactos (empleados de la empresa), Oportunidades (ventas B2B), Facturas (facturación corporativa), y Tickets (soporte empresarial).",
      }
    ],
    relatedModules: ["Contactos", "Oportunidades", "Facturas", "Tickets"]
  },

  leads: {
    id: "leads",
    moduleName: "Leads",
    moduleIcon: "leads",
    description: "Captura y califica prospectos",
    steps: [
      {
        title: "¿Qué es un Lead?",
        description: "Un lead es un prospecto que ha mostrado interés en tu producto o servicio pero aún no ha sido calificado. Puede venir de tu sitio web, redes sociales, referidos o campañas de marketing.",
      },
      {
        title: "Fuentes de Leads",
        description: "Registra de dónde viene cada lead: formulario web, Facebook, LinkedIn, referido, evento, llamada en frío, etc. Esto te ayuda a medir qué canales generan más oportunidades.",
        tip: "Configura formularios web que creen leads automáticamente."
      },
      {
        title: "Calificación de Leads",
        description: "Usa el sistema de puntuación (lead scoring) para priorizar. Califica por: presupuesto, autoridad de decisión, necesidad y tiempo de compra (BANT). Los leads con mayor puntaje son prioridad.",
        tip: "Un lead 'caliente' tiene presupuesto, necesidad inmediata y poder de decisión."
      },
      {
        title: "Conversión de Leads",
        description: "Cuando un lead está listo, conviértelo. Esto crea automáticamente: un Contacto, una Cuenta (si es empresa), y opcionalmente una Oportunidad. El lead se marca como 'convertido'.",
      },
      {
        title: "Conexión con otros módulos",
        description: "Los leads se conectan con: Campañas (de dónde vino), Contactos (al convertir), Cuentas (al convertir), y Oportunidades (venta potencial).",
      }
    ],
    relatedModules: ["Campañas", "Contactos", "Cuentas", "Oportunidades"]
  },

  opportunities: {
    id: "opportunities",
    moduleName: "Oportunidades",
    moduleIcon: "opportunities",
    description: "Gestiona tu pipeline de ventas",
    steps: [
      {
        title: "¿Qué es una Oportunidad?",
        description: "Una oportunidad representa una venta potencial con un valor estimado. Es el corazón de tu proceso comercial y te permite hacer forecast de ingresos.",
      },
      {
        title: "Etapas del Pipeline",
        description: "Cada oportunidad pasa por etapas: Prospección → Calificación → Propuesta → Negociación → Cierre. Personaliza las etapas según tu proceso de venta.",
        tip: "Arrastra las oportunidades entre etapas en la vista Kanban."
      },
      {
        title: "Probabilidad y Forecast",
        description: "Asigna una probabilidad de cierre (%) a cada oportunidad. El sistema calcula automáticamente el valor ponderado para tu forecast mensual y trimestral.",
        tip: "Sé realista con las probabilidades. Una propuesta enviada no es 90% segura."
      },
      {
        title: "Productos y Cotizaciones",
        description: "Agrega productos a la oportunidad para calcular el valor total. Genera cotizaciones PDF directamente y envíalas al cliente. Cuando acepte, convierte a pedido.",
      },
      {
        title: "Conexión con otros módulos",
        description: "Las oportunidades se conectan con: Contactos/Cuentas (a quién vendes), Productos (qué vendes), Cotizaciones (propuestas), Pedidos (venta cerrada), y Facturas (cobro).",
      }
    ],
    relatedModules: ["Contactos", "Productos", "Cotizaciones", "Pedidos", "Facturas"]
  },

  invoices: {
    id: "invoices",
    moduleName: "Facturación",
    moduleIcon: "invoices",
    description: "Emite facturas y controla cobros",
    steps: [
      {
        title: "Tipos de Comprobantes",
        description: "El sistema soporta: Facturas (para empresas con RUC), Boletas (para personas naturales), y Notas de Crédito (para anulaciones o descuentos). Cada uno tiene su serie correlativa.",
      },
      {
        title: "Crear una Factura",
        description: "Selecciona el cliente, agrega productos o servicios, aplica descuentos si corresponde. El IGV (18%) se calcula automáticamente. Puedes facturar desde un pedido o manualmente.",
        tip: "Configura tus series en Configuración → Facturación."
      },
      {
        title: "Estados de Factura",
        description: "Las facturas pasan por: Borrador → Emitida → Pagada (o Vencida). Puedes registrar pagos parciales y el sistema calcula el saldo pendiente.",
      },
      {
        title: "Pagos y Cobranza",
        description: "Registra pagos contra facturas. Soporta múltiples métodos: efectivo, transferencia, tarjeta, etc. El sistema envía recordatorios automáticos de facturas vencidas.",
        tip: "Activa los recordatorios automáticos en Configuración → Notificaciones."
      },
      {
        title: "Conexión con otros módulos",
        description: "Las facturas se conectan con: Contactos/Cuentas (a quién facturas), Pedidos (origen de la venta), Productos (detalle), y Reportes (análisis de ingresos).",
      }
    ],
    relatedModules: ["Contactos", "Cuentas", "Pedidos", "Productos", "Reportes"]
  },

  tasks: {
    id: "tasks",
    moduleName: "Tareas",
    moduleIcon: "tasks",
    description: "Organiza tu trabajo diario",
    steps: [
      {
        title: "¿Para qué sirven las Tareas?",
        description: "Las tareas te ayudan a organizar tu trabajo: llamadas por hacer, emails por enviar, reuniones por agendar, propuestas por preparar. Todo con fechas límite y recordatorios.",
      },
      {
        title: "Tipos de Tareas",
        description: "Categoriza tus tareas: Llamada, Email, Reunión, Seguimiento, Propuesta, Otro. Esto te permite filtrar y priorizar según el tipo de actividad.",
        tip: "Las tareas de tipo 'Llamada' pueden integrarse con tu sistema telefónico."
      },
      {
        title: "Prioridades y Fechas",
        description: "Asigna prioridad (Alta, Media, Baja) y fecha de vencimiento. Las tareas vencidas se resaltan en rojo. Recibe notificaciones antes del vencimiento.",
      },
      {
        title: "Asignación y Colaboración",
        description: "Asigna tareas a ti mismo o a otros miembros del equipo. El asignado recibe notificación. Los managers pueden ver las tareas de su equipo.",
        tip: "Usa la vista de calendario para ver todas las tareas del equipo."
      },
      {
        title: "Conexión con otros módulos",
        description: "Las tareas se vinculan a: Contactos (llamar a Juan), Oportunidades (enviar propuesta), Tickets (resolver caso), y Calendario (agenda visual).",
      }
    ],
    relatedModules: ["Contactos", "Oportunidades", "Tickets", "Calendario"]
  },

  tickets: {
    id: "tickets",
    moduleName: "Tickets",
    moduleIcon: "tickets",
    description: "Gestiona soporte al cliente",
    steps: [
      {
        title: "¿Qué es un Ticket?",
        description: "Un ticket representa una solicitud de soporte o incidencia reportada por un cliente. Permite dar seguimiento estructurado hasta la resolución.",
      },
      {
        title: "Crear y Categorizar",
        description: "Los tickets pueden crearse manualmente o llegar por email. Categorízalos por tipo: Consulta, Problema, Solicitud, Queja. Asigna prioridad según urgencia.",
        tip: "Configura un email de soporte que cree tickets automáticamente."
      },
      {
        title: "Estados y SLA",
        description: "Los tickets pasan por: Nuevo → En Progreso → Pendiente Cliente → Resuelto → Cerrado. Define tiempos de respuesta (SLA) según prioridad.",
      },
      {
        title: "Comunicación con el Cliente",
        description: "Responde al cliente directamente desde el ticket. Todo el historial queda registrado. El cliente puede responder por email y se agrega al ticket.",
        tip: "Usa respuestas predefinidas para consultas frecuentes."
      },
      {
        title: "Conexión con otros módulos",
        description: "Los tickets se conectan con: Contactos (quién reporta), Cuentas (empresa del cliente), Productos (sobre qué producto), y Reportes (métricas de soporte).",
      }
    ],
    relatedModules: ["Contactos", "Cuentas", "Productos", "Reportes"]
  },

  products: {
    id: "products",
    moduleName: "Productos",
    moduleIcon: "products",
    description: "Catálogo de productos y servicios",
    steps: [
      {
        title: "Productos vs Servicios",
        description: "Registra tanto productos físicos (con inventario) como servicios (sin stock). Cada uno tiene: código SKU, nombre, descripción, precio y categoría.",
      },
      {
        title: "Precios y Descuentos",
        description: "Define precio base y precio con IGV. Puedes crear listas de precios diferentes para mayoristas, minoristas o clientes especiales.",
        tip: "Los descuentos se pueden aplicar por producto o por cliente."
      },
      {
        title: "Categorías y Organización",
        description: "Organiza productos en categorías y subcategorías. Esto facilita la búsqueda y permite generar reportes por línea de producto.",
      },
      {
        title: "Inventario (Productos Físicos)",
        description: "Para productos físicos, el sistema controla stock: entradas, salidas, stock mínimo y alertas de reposición. Ve la pestaña de Inventario dentro de Productos para más detalle.",
        tip: "Configura alertas cuando el stock llegue al mínimo."
      },
      {
        title: "Conexión con otros módulos",
        description: "Los productos se usan en: Oportunidades (qué vendes), Cotizaciones (propuestas), Pedidos (ventas), Facturas (facturación), e Inventario (stock).",
      }
    ],
    relatedModules: ["Oportunidades", "Cotizaciones", "Pedidos", "Facturas", "Inventario"]
  },

  orders: {
    id: "orders",
    moduleName: "Pedidos",
    moduleIcon: "orders",
    description: "Gestiona órdenes de venta",
    steps: [
      {
        title: "¿Qué es un Pedido?",
        description: "Un pedido es una venta confirmada. Puede crearse desde una cotización aceptada o directamente. Representa el compromiso de entrega con el cliente.",
      },
      {
        title: "Crear un Pedido",
        description: "Selecciona cliente, agrega productos, define cantidades y precios. El sistema calcula subtotal, IGV y total. Puedes aplicar descuentos globales o por línea.",
        tip: "Desde una cotización aprobada, convierte a pedido con un clic."
      },
      {
        title: "Estados del Pedido",
        description: "Los pedidos pasan por: Pendiente → Confirmado → En Preparación → Enviado → Entregado. Cada cambio de estado puede notificar al cliente.",
      },
      {
        title: "Facturación del Pedido",
        description: "Genera la factura directamente desde el pedido. Puedes facturar parcialmente (entregas parciales) o todo junto. El pedido se marca como facturado.",
      },
      {
        title: "Conexión con otros módulos",
        description: "Los pedidos se conectan con: Cotizaciones (origen), Productos (detalle), Inventario (reserva stock), Facturas (cobro), y Reportes (ventas).",
      }
    ],
    relatedModules: ["Cotizaciones", "Productos", "Inventario", "Facturas", "Reportes"]
  },

  analytics: {
    id: "analytics",
    moduleName: "Analíticas",
    moduleIcon: "analytics",
    description: "Reportes y métricas del negocio",
    steps: [
      {
        title: "Dashboard Principal",
        description: "El dashboard muestra KPIs clave: ventas del mes, oportunidades en pipeline, tickets abiertos, tareas pendientes. Todo actualizado en tiempo real.",
      },
      {
        title: "Reportes de Ventas",
        description: "Analiza: ventas por período, por vendedor, por producto, por cliente. Compara con períodos anteriores y detecta tendencias.",
        tip: "Exporta reportes a Excel para análisis adicional."
      },
      {
        title: "Pipeline y Forecast",
        description: "Visualiza tu embudo de ventas: cuántas oportunidades en cada etapa, valor total, probabilidad ponderada. Proyecta ingresos futuros.",
      },
      {
        title: "Métricas de Soporte",
        description: "Mide la calidad del soporte: tiempo promedio de respuesta, tiempo de resolución, tickets por categoría, satisfacción del cliente.",
      },
      {
        title: "Reportes Personalizados",
        description: "Crea reportes a medida combinando datos de diferentes módulos. Guarda tus reportes favoritos y prográmalos para envío automático.",
      }
    ],
    relatedModules: ["Oportunidades", "Facturas", "Tickets", "Productos"]
  },

  calendar: {
    id: "calendar",
    moduleName: "Calendario",
    moduleIcon: "calendar",
    description: "Agenda y programación",
    steps: [
      {
        title: "Vista de Calendario",
        description: "Visualiza todas tus actividades: tareas, reuniones, llamadas programadas, vencimientos. Cambia entre vista diaria, semanal o mensual.",
      },
      {
        title: "Crear Eventos",
        description: "Agenda reuniones, llamadas o cualquier evento. Define fecha, hora, duración y participantes. Envía invitaciones por email automáticamente.",
        tip: "Sincroniza con Google Calendar para ver todo en un solo lugar."
      },
      {
        title: "Recordatorios",
        description: "Configura recordatorios: 15 min antes, 1 hora antes, 1 día antes. Recibe notificaciones por email o push en el navegador.",
      },
      {
        title: "Calendario del Equipo",
        description: "Los managers pueden ver el calendario de su equipo. Útil para coordinar reuniones y balancear carga de trabajo.",
      },
      {
        title: "Conexión con otros módulos",
        description: "El calendario muestra: Tareas (con fecha), Oportunidades (fecha de cierre esperada), y Tickets (SLA de respuesta).",
      }
    ],
    relatedModules: ["Tareas", "Oportunidades", "Tickets"]
  },

  workflows: {
    id: "workflows",
    moduleName: "Automatizaciones",
    moduleIcon: "workflows",
    description: "Automatiza procesos repetitivos",
    steps: [
      {
        title: "¿Qué son las Automatizaciones?",
        description: "Las automatizaciones ejecutan acciones automáticamente cuando ocurren ciertos eventos. Por ejemplo: cuando llega un lead, asignarlo y enviar email de bienvenida.",
      },
      {
        title: "Triggers (Disparadores)",
        description: "Define qué evento inicia la automatización: nuevo registro, cambio de campo, fecha específica, etc. Ejemplo: 'Cuando una oportunidad cambie a Ganada'.",
        tip: "Combina múltiples condiciones para triggers más específicos."
      },
      {
        title: "Acciones Automáticas",
        description: "Define qué hacer: enviar email, crear tarea, actualizar campo, notificar usuario, crear registro. Encadena múltiples acciones.",
      },
      {
        title: "Ejemplos Útiles",
        description: "Automatizaciones comunes: asignar leads por round-robin, enviar email cuando factura vence, crear tarea de seguimiento post-venta, notificar al manager en ventas grandes.",
      },
      {
        title: "Monitoreo",
        description: "Revisa el historial de ejecuciones: cuántas veces se ejecutó, si hubo errores, qué acciones se realizaron. Desactiva automatizaciones problemáticas.",
      }
    ],
    relatedModules: ["Leads", "Oportunidades", "Tareas", "Facturas"]
  },

  campaigns: {
    id: "campaigns",
    moduleName: "Campañas",
    moduleIcon: "campaigns",
    description: "Marketing y comunicación masiva",
    steps: [
      {
        title: "¿Qué es una Campaña?",
        description: "Una campaña agrupa esfuerzos de marketing: email marketing, eventos, promociones, publicidad. Permite medir el ROI de cada iniciativa.",
      },
      {
        title: "Tipos de Campaña",
        description: "Crea campañas de: Email (newsletters, promociones), Evento (webinars, ferias), Publicidad (Google Ads, Facebook), Telemarketing, u Otros.",
      },
      {
        title: "Audiencia y Segmentación",
        description: "Define a quién va dirigida: todos los contactos, solo clientes, leads de cierta fuente, etc. Usa filtros para segmentar tu audiencia.",
        tip: "Segmenta por industria, ubicación o historial de compras para mejor conversión."
      },
      {
        title: "Métricas de Campaña",
        description: "Mide resultados: emails enviados/abiertos/clicados, leads generados, oportunidades creadas, ventas cerradas. Calcula el costo por lead y ROI.",
      },
      {
        title: "Conexión con otros módulos",
        description: "Las campañas se conectan con: Contactos (audiencia), Leads (generados), Oportunidades (ventas atribuidas), y Reportes (análisis de ROI).",
      }
    ],
    relatedModules: ["Contactos", "Leads", "Oportunidades", "Reportes"]
  },
}

// Helper to check if tutorial was completed
export function isTutorialCompleted(tutorialId: string): boolean {
  if (typeof window === "undefined") return false
  const completed = JSON.parse(localStorage.getItem("completedTutorials") || "[]")
  return completed.includes(tutorialId)
}

// Helper to reset all tutorials
export function resetAllTutorials(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem("completedTutorials")
}

// Helper to get tutorial by module
export function getTutorial(moduleId: string): ModuleTutorial | undefined {
  return moduleTutorials[moduleId]
}
