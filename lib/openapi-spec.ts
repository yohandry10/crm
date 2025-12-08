/**
 * OpenAPI 3.0 Specification for CRM API
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'CRM AI Perú API',
    description: 'API pública para integración con el CRM. Permite gestionar contactos, leads, oportunidades, facturas y más.',
    version: '1.0.0',
    contact: {
      email: 'api@crm.pe',
    },
  },
  servers: [
    {
      url: 'https://api.crm.pe/v1',
      description: 'Producción',
    },
    {
      url: 'https://sandbox.crm.pe/v1',
      description: 'Sandbox',
    },
  ],
  security: [
    { bearerAuth: [] },
    { apiKey: [] },
  ],
  tags: [
    { name: 'Contacts', description: 'Gestión de contactos' },
    { name: 'Leads', description: 'Gestión de leads' },
    { name: 'Opportunities', description: 'Pipeline de ventas' },
    { name: 'Invoices', description: 'Facturación' },
    { name: 'Tasks', description: 'Tareas y actividades' },
    { name: 'Webhooks', description: 'Configuración de webhooks' },
  ],
  paths: {
    '/contacts': {
      get: {
        tags: ['Contacts'],
        summary: 'Listar contactos',
        description: 'Obtiene una lista paginada de contactos',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 100 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive', 'lead'] } },
        ],
        responses: {
          '200': {
            description: 'Lista de contactos',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ContactList' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Contacts'],
        summary: 'Crear contacto',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContactCreate' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Contacto creado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Contact' },
              },
            },
          },
        },
      },
    },
    '/contacts/{id}': {
      get: {
        tags: ['Contacts'],
        summary: 'Obtener contacto',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Contacto encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Contact' },
              },
            },
          },
          '404': { description: 'Contacto no encontrado' },
        },
      },
      put: {
        tags: ['Contacts'],
        summary: 'Actualizar contacto',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContactUpdate' },
            },
          },
        },
        responses: {
          '200': { description: 'Contacto actualizado' },
        },
      },
      delete: {
        tags: ['Contacts'],
        summary: 'Eliminar contacto',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '204': { description: 'Contacto eliminado' },
        },
      },
    },
    '/opportunities': {
      get: {
        tags: ['Opportunities'],
        summary: 'Listar oportunidades',
        parameters: [
          { name: 'stage', in: 'query', schema: { type: 'string' } },
          { name: 'owner_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Lista de oportunidades',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OpportunityList' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Opportunities'],
        summary: 'Crear oportunidad',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OpportunityCreate' },
            },
          },
        },
        responses: {
          '201': { description: 'Oportunidad creada' },
        },
      },
    },
    '/invoices': {
      get: {
        tags: ['Invoices'],
        summary: 'Listar facturas',
        responses: {
          '200': {
            description: 'Lista de facturas',
          },
        },
      },
      post: {
        tags: ['Invoices'],
        summary: 'Crear factura',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InvoiceCreate' },
            },
          },
        },
        responses: {
          '201': { description: 'Factura creada' },
        },
      },
    },
    '/webhooks': {
      get: {
        tags: ['Webhooks'],
        summary: 'Listar webhooks configurados',
        responses: {
          '200': { description: 'Lista de webhooks' },
        },
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Crear webhook',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WebhookCreate' },
            },
          },
        },
        responses: {
          '201': { description: 'Webhook creado' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
    schemas: {
      Contact: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          company: { type: 'string' },
          position: { type: 'string' },
          lead_status: { type: 'string', enum: ['cold', 'warm', 'hot', 'converted', 'lost'] },
          lead_score: { type: 'integer', minimum: 0, maximum: 100 },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      ContactCreate: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          company: { type: 'string' },
          position: { type: 'string' },
          notes: { type: 'string' },
        },
      },
      ContactUpdate: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          company: { type: 'string' },
          lead_status: { type: 'string' },
        },
      },
      ContactList: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'array', items: { $ref: '#/components/schemas/Contact' } },
          pagination: { $ref: '#/components/schemas/Pagination' },
        },
      },
      Opportunity: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          value: { type: 'number' },
          probability: { type: 'integer', minimum: 0, maximum: 100 },
          stage: { type: 'string' },
          expected_close_date: { type: 'string', format: 'date' },
          contact_id: { type: 'string', format: 'uuid' },
        },
      },
      OpportunityCreate: {
        type: 'object',
        required: ['name', 'value', 'stage'],
        properties: {
          name: { type: 'string' },
          value: { type: 'number' },
          stage: { type: 'string' },
          probability: { type: 'integer' },
          contact_id: { type: 'string', format: 'uuid' },
          expected_close_date: { type: 'string', format: 'date' },
        },
      },
      OpportunityList: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'array', items: { $ref: '#/components/schemas/Opportunity' } },
          pagination: { $ref: '#/components/schemas/Pagination' },
        },
      },
      InvoiceCreate: {
        type: 'object',
        required: ['contact_id', 'items'],
        properties: {
          contact_id: { type: 'string', format: 'uuid' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                quantity: { type: 'number' },
                unit_price: { type: 'number' },
              },
            },
          },
          due_date: { type: 'string', format: 'date' },
          notes: { type: 'string' },
        },
      },
      WebhookCreate: {
        type: 'object',
        required: ['url', 'events'],
        properties: {
          url: { type: 'string', format: 'uri' },
          events: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['contact.created', 'contact.updated', 'opportunity.created', 'opportunity.won', 'invoice.paid'],
            },
          },
          secret: { type: 'string' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          code: { type: 'string' },
        },
      },
    },
  },
}

/**
 * Genera documentación HTML de la API
 */
export function generateApiDocsHTML(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>CRM API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      spec: ${JSON.stringify(openApiSpec)},
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout"
    });
  </script>
</body>
</html>
  `
}
