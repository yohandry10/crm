import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => null),
  RATE_LIMITS: {
    read: { limit: 100, window: 60000 },
    write: { limit: 30, window: 60000 },
    sensitive: { limit: 10, window: 60000 },
  },
}))

vi.mock('@/lib/supabase-auth', () => ({
  getAuthenticatedContext: vi.fn(),
}))

vi.mock('@/lib/queues/workflow-queue', () => ({
  addWorkflowJob: vi.fn(),
  getWorkflowQueue: vi.fn(),
}))

vi.mock('@/lib/workers/workflow-worker', () => ({
  createWorkflowWorker: vi.fn(),
}))

vi.mock('@/lib/error-logging', () => ({
  logError: vi.fn(),
}))

vi.mock('@/lib/events', () => ({
  emitEvent: vi.fn(),
  processWebhookEvents: vi.fn(),
}))

describe('API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes only implemented resource paths in /api/v1/version metadata', async () => {
    const { GET } = await import('@/app/api/v1/version/route')

    const response = await GET()
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.data.endpoints).toEqual({
      version: '/api/v1/version',
      contacts: '/api/contacts',
      workflows: '/api/workflows',
      campaigns: '/api/campaigns',
      analytics: '/api/analytics',
    })
    expect(body.data.versionedResourcesEnabled).toBe(false)
  })

  it('keeps OpenAPI aligned with implemented unversioned contracts', async () => {
    const { openApiSpec } = await import('@/lib/openapi-spec')

    expect(openApiSpec.servers.every((server) => !server.url.endsWith('/v1'))).toBe(true)
    expect(openApiSpec.paths['/contacts'].post.responses).toHaveProperty('200')
    expect(openApiSpec.paths['/contacts/{id}'].delete.responses).toHaveProperty('200')

    const opportunityParams = openApiSpec.paths['/opportunities'].get.parameters.map((param) => param.name)
    expect(opportunityParams).toContain('stage_id')
    expect(opportunityParams).not.toContain('stage')
  })

  it('returns a workflow statusUrl that matches the existing jobs route', async () => {
    const { getAuthenticatedContext } = await import('@/lib/supabase-auth')
    const { addWorkflowJob } = await import('@/lib/queues/workflow-queue')

    const workflowQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    }

    workflowQuery.select.mockReturnValue(workflowQuery)
    workflowQuery.eq.mockReturnValue(workflowQuery)
    workflowQuery.single.mockResolvedValue({
      data: {
        id: 'workflow-123',
        name: 'Welcome workflow',
        is_active: true,
        trigger_conditions: null,
        actions: [{ type: 'email' }, { type: 'task' }],
      },
      error: null,
    })

    vi.mocked(getAuthenticatedContext).mockResolvedValue({
      supabase: {
        from: vi.fn(() => workflowQuery),
      },
      user: { id: 'user-123' },
      organizationId: 'org-123',
    } as any)

    vi.mocked(addWorkflowJob).mockResolvedValue({ id: 'job-123' } as any)

    const { POST } = await import('@/app/api/workflows/execute/route')
    const request = new Request('http://localhost:3000/api/workflows/execute', {
      method: 'POST',
      body: JSON.stringify({
        workflow_id: 'workflow-123',
        event_data: {},
        manual_trigger: true,
      }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await POST(request as any)
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.data.statusUrl).toBe('/api/jobs/job-123')
  })

  it('requires a cron secret before draining workflow jobs', async () => {
    const previousSecret = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'cron-test-secret'

    try {
      const { GET } = await import('@/app/api/cron/process-workflows/route')
      const request = new Request('http://localhost:3000/api/cron/process-workflows')

      const response = await GET(request as any)
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body).toEqual({ success: false, error: 'Unauthorized' })
    } finally {
      if (previousSecret === undefined) {
        delete process.env.CRON_SECRET
      } else {
        process.env.CRON_SECRET = previousSecret
      }
    }
  })

  it('fails closed when CRON_SECRET is not configured', async () => {
    const previousSecret = process.env.CRON_SECRET
    delete process.env.CRON_SECRET

    try {
      const { validateCronSecret } = await import('@/lib/cron-auth')
      const request = new Request('http://localhost:3000/api/cron/process-events', {
        headers: { authorization: 'Bearer undefined' },
      })

      const response = validateCronSecret(request)
      const body = await response!.json()

      expect(response!.status).toBe(500)
      expect(body).toEqual({ success: false, error: 'Cron secret not configured' })
    } finally {
      if (previousSecret === undefined) {
        delete process.env.CRON_SECRET
      } else {
        process.env.CRON_SECRET = previousSecret
      }
    }
  })

  it('rejects unsafe fields in opportunity updates', async () => {
    const { getAuthenticatedContext } = await import('@/lib/supabase-auth')
    const from = vi.fn()

    vi.mocked(getAuthenticatedContext).mockResolvedValue({
      supabase: { from },
      user: { id: 'user-123' },
      organizationId: 'org-123',
    } as any)

    const { PATCH } = await import('@/app/api/opportunities/[id]/route')
    const request = new Request('http://localhost:3000/api/opportunities/opp-123', {
      method: 'PATCH',
      body: JSON.stringify({ organization_id: 'org-evil' }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request as any, {
      params: Promise.resolve({ id: 'opp-123' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Datos inválidos')
    expect(from).not.toHaveBeenCalled()
  })

  it('validates opportunity stage changes against the authenticated organization', async () => {
    const { getAuthenticatedContext } = await import('@/lib/supabase-auth')
    const opportunityId = '11111111-1111-4111-8111-111111111111'
    const oldStageId = '22222222-2222-4222-8222-222222222222'
    const newStageId = '33333333-3333-4333-8333-333333333333'

    const oldOpportunityQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    }
    oldOpportunityQuery.select.mockReturnValue(oldOpportunityQuery)
    oldOpportunityQuery.eq.mockReturnValue(oldOpportunityQuery)
    oldOpportunityQuery.single.mockResolvedValue({
      data: { id: opportunityId, stage_id: oldStageId },
      error: null,
    })

    const stageQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    }
    stageQuery.select.mockReturnValue(stageQuery)
    stageQuery.eq.mockReturnValue(stageQuery)
    stageQuery.maybeSingle.mockResolvedValue({ data: null, error: null })

    const from = vi.fn((table: string) => {
      if (table === 'opportunities') return oldOpportunityQuery
      if (table === 'pipeline_stages') return stageQuery
      throw new Error(`Unexpected table ${table}`)
    })

    vi.mocked(getAuthenticatedContext).mockResolvedValue({
      supabase: { from },
      user: { id: 'user-123' },
      organizationId: 'org-123',
    } as any)

    const { PATCH } = await import('@/app/api/opportunities/[id]/route')
    const request = new Request(`http://localhost:3000/api/opportunities/${opportunityId}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage_id: newStageId }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request as any, {
      params: Promise.resolve({ id: opportunityId }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toBe('La etapa seleccionada no existe o no pertenece a tu organización')
    expect(stageQuery.eq).toHaveBeenCalledWith('organization_id', 'org-123')
  })

  it('does not expose decrypted integration config in list responses', async () => {
    const { getAuthenticatedContext } = await import('@/lib/supabase-auth')
    const integrationsQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    }

    integrationsQuery.select.mockReturnValue(integrationsQuery)
    integrationsQuery.eq.mockReturnValue(integrationsQuery)
    integrationsQuery.order.mockResolvedValue({
      data: [
        {
          id: 'integration-123',
          name: 'WhatsApp',
          provider: 'whatsapp',
          organization_id: 'org-123',
          config: { token: 'plain-secret' },
          config_encrypted: 'encrypted-secret',
        },
      ],
      error: null,
    })

    vi.mocked(getAuthenticatedContext).mockResolvedValue({
      supabase: {
        from: vi.fn(() => integrationsQuery),
      },
      user: { id: 'user-123' },
      organizationId: 'org-123',
    } as any)

    const { GET } = await import('@/app/api/integrations/route')
    const response = await GET(new Request('http://localhost:3000/api/integrations') as any)
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.data[0].config).toBeNull()
    expect(body.data[0].has_config).toBe(true)
    expect(body.data[0]).not.toHaveProperty('config_encrypted')
  })

  it('scopes workflow lead updates to the execution organization', async () => {
    const contactQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(),
    }

    contactQuery.update.mockReturnValue(contactQuery)
    contactQuery.eq.mockReturnValue(contactQuery)
    contactQuery.select.mockReturnValue(contactQuery)
    contactQuery.maybeSingle.mockResolvedValue({
      data: { id: 'contact-123' },
      error: null,
    })

    const { executeWorkflowAction } = await import('@/lib/workflow-executor')
    const result = await executeWorkflowAction(
      { from: vi.fn(() => contactQuery) },
      { type: 'update_lead_score', params: { contactId: 'contact-123', score: 80 } },
      { organizationId: 'org-123' }
    )

    expect(result.success).toBe(true)
    expect(contactQuery.eq).toHaveBeenCalledWith('id', 'contact-123')
    expect(contactQuery.eq).toHaveBeenCalledWith('organization_id', 'org-123')
  })

  it('records payments through the atomic RPC contract', async () => {
    const { getAuthenticatedContext } = await import('@/lib/supabase-auth')
    const { emitEvent } = await import('@/lib/events')
    const rpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        payment_id: 'payment-123',
        status: 'completed',
        is_fully_paid: false,
        total_paid: 50,
        cached: false,
      },
      error: null,
    })

    vi.mocked(getAuthenticatedContext).mockResolvedValue({
      supabase: { rpc },
      user: { id: 'user-123' },
      organizationId: 'org-123',
    } as any)

    const { POST } = await import('@/app/api/payments/route')
    const request = new Request('http://localhost:3000/api/payments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'payment-key-123456',
      },
      body: JSON.stringify({
        invoice_id: 'invoice-123',
        amount: 50,
        gateway: 'manual',
        payment_method: 'cash',
      }),
    })

    const response = await POST(request as any)
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.data.payment_id).toBe('payment-123')
    expect(rpc).toHaveBeenCalledWith('record_payment_atomic', expect.objectContaining({
      p_user_id: 'user-123',
      p_organization_id: 'org-123',
      p_invoice_id: 'invoice-123',
      p_amount: 50,
      p_gateway: 'manual',
      p_idempotency_key: 'payment-key-123456',
    }))
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'payment.completed',
    }), expect.anything())
  })

  it('fails closed when quote stock validation is rejected by the database', async () => {
    const { getAuthenticatedContext } = await import('@/lib/supabase-auth')

    const currentQuoteQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    }
    currentQuoteQuery.select.mockReturnValue(currentQuoteQuery)
    currentQuoteQuery.eq.mockReturnValue(currentQuoteQuery)
    currentQuoteQuery.single.mockResolvedValue({
      data: {
        status: 'draft',
        contact_id: 'contact-123',
        notes: null,
      },
      error: null,
    })

    const quoteItemsQuery = {
      select: vi.fn(),
      eq: vi.fn(),
    }
    quoteItemsQuery.select.mockReturnValue(quoteItemsQuery)
    quoteItemsQuery.eq.mockResolvedValue({
      data: [{ product_id: 'product-123', description: 'Item', quantity: 1, unit_price: 10 }],
      error: null,
    })

    const from = vi.fn((table: string) => {
      if (table === 'quotes') return currentQuoteQuery
      if (table === 'quote_items') return quoteItemsQuery
      throw new Error(`Unexpected table ${table}`)
    })
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Not authorized for organization org-123' },
    })

    vi.mocked(getAuthenticatedContext).mockResolvedValue({
      supabase: { from, rpc },
      user: { id: 'user-123' },
      organizationId: 'org-123',
    } as any)

    const { PATCH } = await import('@/app/api/quotes/[id]/route')
    const request = new Request('http://localhost:3000/api/quotes/quote-123', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request as any, {
      params: Promise.resolve({ id: 'quote-123' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Not authorized for organization org-123')
    expect(rpc).toHaveBeenCalledWith('check_quote_stock_availability', { p_quote_id: 'quote-123' })
  })

  it('keeps SECURITY DEFINER hardening documented in the latest SQL migration', () => {
    const sql = readFileSync('supabase/migrations/095_security_definer_hardening.sql', 'utf8')

    expect(sql).toContain('REVOKE SELECT ON organizations_decrypted FROM PUBLIC, authenticated')
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION decrypt_secret(TEXT) FROM PUBLIC, authenticated')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION decrement_stock')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION get_unreconciled_payments')
    expect(sql).toContain('auth.uid()')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION get_unreconciled_payments(UUID) TO authenticated')
  })

  it('keeps the second SECURITY DEFINER hardening pass on exposed RPCs', () => {
    const sql = readFileSync('supabase/migrations/097_security_definer_rpc_hardening.sql', 'utf8')
    const publicFormRoute = readFileSync('app/api/public/forms/[id]/route.ts', 'utf8')
    const workflowLogsRoute = readFileSync('app/api/workflows/executions/[id]/logs/route.ts', 'utf8')

    expect(sql).toContain('CREATE OR REPLACE FUNCTION search_contacts')
    expect(sql).toContain("RAISE EXCEPTION 'Not authorized for organization %'")
    expect(sql).toContain('CREATE OR REPLACE FUNCTION get_or_create_conversation')
    expect(sql).toContain('p_user_id <> v_user_id')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION check_subscription_status')
    expect(sql).toContain('DROP FUNCTION IF EXISTS get_workflow_execution_logs(UUID)')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION cleanup_analytics_cache() TO service_role')
    expect(publicFormRoute).toContain("process.env.NODE_ENV === 'production' ? null")
    expect(publicFormRoute).toContain('status: 403')
    expect(workflowLogsRoute.indexOf("from('workflow_executions')")).toBeLessThan(
      workflowLogsRoute.indexOf("rpc('get_workflow_execution_logs'")
    )
  })

  it('validates service-role request bodies before privileged writes', () => {
    const onboardingRoute = readFileSync('app/api/onboarding/complete/route.ts', 'utf8')
    const teamInviteRoute = readFileSync('app/api/team/invite/route.ts', 'utf8')
    const checkoutRoute = readFileSync('app/api/subscriptions/checkout/route.ts', 'utf8')
    const adminActivateRoute = readFileSync('app/api/admin/subscriptions/activate/route.ts', 'utf8')
    const adminOrganizationsRoute = readFileSync('app/api/admin/organizations/route.ts', 'utf8')
    const adminOrganizationRoute = readFileSync('app/api/admin/organizations/[id]/route.ts', 'utf8')
    const adminUsersRoute = readFileSync('app/api/admin/users/route.ts', 'utf8')

    expect(onboardingRoute).toContain('onboardingSchema.safeParse')
    expect(onboardingRoute).toContain('z.enum(["admin", "manager", "member", "viewer"])')
    expect(onboardingRoute).toContain('createSupabaseServiceClient')
    expect(teamInviteRoute).toContain('inviteSchema.safeParse')
    expect(teamInviteRoute).toContain('z.enum(["admin", "manager", "member", "viewer"])')
    expect(checkoutRoute).toContain('checkoutSchema.safeParse')
    expect(checkoutRoute).toContain('z.enum(["starter", "professional", "enterprise"])')
    expect(adminActivateRoute).toContain('activationSchema.safeParse')
    expect(adminOrganizationsRoute).toContain('createOrganizationSchema.safeParse')
    expect(adminOrganizationsRoute).toContain("regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/")
    expect(adminOrganizationRoute).toContain('organizationPatchSchema.safeParse')
    expect(adminOrganizationRoute).toContain('organizationUpdateSchema.safeParse')
    expect(adminOrganizationRoute).toContain('organizationIdSchema.safeParse')
    expect(adminUsersRoute).toContain('updateUserPermissionsSchema.safeParse')
    expect(adminUsersRoute).toContain('roleFilterSchema.safeParse')
  })

  it('uses active Culqi/PagoEfectivo billing paths instead of Stripe routes', () => {
    const billingProviders = readFileSync('lib/billing-providers.ts', 'utf8')
    const paymentsRoute = readFileSync('app/api/payments/route.ts', 'utf8')
    const checkoutRoute = readFileSync('app/api/subscriptions/checkout/route.ts', 'utf8')

    expect(billingProviders).toContain('"culqi"')
    expect(billingProviders).toContain('"pagoefectivo"')
    expect(billingProviders).not.toContain('"stripe"')
    expect(paymentsRoute).toContain('normalizePaymentGateway')
    expect(checkoutRoute).toContain('pendingPayment')
    expect(existsSync('app/api/webhooks/stripe/route.ts')).toBe(false)
    expect(existsSync('app/api/payments/stripe/webhook/route.ts')).toBe(false)
  })

  it('creates public bookings through the atomic database RPC', () => {
    const sql = readFileSync('supabase/migrations/098_atomic_public_booking.sql', 'utf8')
    const route = readFileSync('app/api/calendar/booking/route.ts', 'utf8')

    expect(sql).toContain('CREATE OR REPLACE FUNCTION book_public_calendar_slot')
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain('FROM calendar_events ce')
    expect(sql).toContain("ce.status <> 'cancelled'")
    expect(sql).toContain("'Este horario ya no está disponible'")
    expect(sql).toContain("source,\n            lead_status")
    expect(sql).toContain("'booking'")
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION book_public_calendar_slot')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION book_public_calendar_slot')
    expect(sql).toContain('TO service_role')
    expect(route).toContain('rpc("book_public_calendar_slot"')
    expect(route).not.toContain('lead_source')
  })

  it('keeps calendar UI and public booking on the same calendar_events contract', () => {
    const calendarPage = readFileSync('app/calendar/page.tsx', 'utf8')
    const eventDialog = readFileSync('components/calendar/event-dialog.tsx', 'utf8')
    const calendarEventsRoute = readFileSync('app/api/calendar/events/route.ts', 'utf8')
    const legacyEventsRoute = readFileSync('app/api/events/route.ts', 'utf8')
    const legacyEventRoute = readFileSync('app/api/events/[id]/route.ts', 'utf8')
    const helper = readFileSync('lib/calendar-events.ts', 'utf8')

    expect(calendarPage).toContain('/api/calendar/events?start=')
    expect(eventDialog).toContain("'/api/calendar/events'")
    expect(eventDialog).toContain('`/api/calendar/events/${event.id}`')
    expect(eventDialog).toContain("method: event ? 'PUT' : 'POST'")
    expect(calendarEventsRoute).toContain('.from("calendar_events")')
    expect(calendarEventsRoute).toContain('serializeCalendarEvent')
    expect(calendarEventsRoute).toContain('validateCalendarEventReferences')
    expect(calendarEventsRoute).toContain('assertCalendarDateRange')
    expect(legacyEventsRoute).toContain(".from('calendar_events')")
    expect(legacyEventsRoute).not.toContain(".from('events')")
    expect(legacyEventRoute).toContain(".from('calendar_events')")
    expect(legacyEventRoute).not.toContain(".from('events')")
    expect(helper).toContain('start_time: event.start_time')
    expect(helper).toContain('end_time: event.end_time')
  })

  it('validates public payment tokens and proof payloads before privileged writes', () => {
    const route = readFileSync('app/api/pay/[token]/route.ts', 'utf8')

    expect(route).toContain('PUBLIC_PAY_ALLOWED_ORIGINS')
    expect(route).toContain("process.env.NODE_ENV === 'production' ? null")
    expect(route).toContain('tokenSchema.safeParse')
    expect(route).toContain('paymentProofSchema.safeParse')
    expect(route).toContain('new URL(value).protocol === "https:"')
    expect(route).toContain('createSupabaseServiceClient')
    expect(route).toContain('Origin not allowed')
    expect(route).toContain('status: 403')
  })

  it('creates payment links only through the hardened token RPC', () => {
    const route = readFileSync('app/api/payment-links/route.ts', 'utf8')
    const migration = readFileSync('supabase/migrations/099_public_payment_tokens_hardening.sql', 'utf8')

    expect(route).toContain('paymentLinkSchema.safeParse')
    expect(route).toContain(".rpc('generate_payment_token'")
    expect(route).not.toContain(".from('public_payment_tokens')\n            .insert")
    expect(route).toContain('deletePaymentLinkSchema.safeParse')
    expect(migration).toContain('DROP POLICY IF EXISTS "Org members can manage payment tokens"')
    expect(migration).toContain('GRANT UPDATE (is_active) ON public_payment_tokens TO authenticated')
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public_payment_tokens FROM authenticated')
    expect(migration).toContain('CHECK (\n        (quote_id IS NOT NULL AND invoice_id IS NULL)')
  })

  it('verifies form ownership before listing submissions', () => {
    const route = readFileSync('app/api/forms/[id]/submissions/route.ts', 'utf8')

    expect(route).toContain('getAuthenticatedContext')
    expect(route).toContain("from('web_forms')")
    expect(route).toContain(".eq('organization_id', organizationId)")
    expect(route.indexOf("from('web_forms')")).toBeLessThan(route.indexOf("from('form_submissions')"))
    expect(route).toContain("status: z.enum(['new', 'processed', 'spam'])")
    expect(route).toContain("id, organization_id, form_id, data, contact_id")
  })

  it('validates private form writes before mutating tenant data', () => {
    const createRoute = readFileSync('app/api/forms/route.ts', 'utf8')
    const updateRoute = readFileSync('app/api/forms/[id]/route.ts', 'utf8')
    const contracts = readFileSync('lib/web-form-contracts.ts', 'utf8')
    const publicSubmit = readFileSync('app/api/public/forms/[id]/submit/route.ts', 'utf8')

    expect(contracts).toContain('webFormApiSchema')
    expect(contracts).toContain('webFormApiUpdateSchema')
    expect(contracts).toContain('validateWebFormAssignee')
    expect(contracts).toContain('from("organization_members")')
    expect(contracts).toContain('.eq("organization_id", organizationId)')
    expect(createRoute).toContain('getAuthenticatedContext')
    expect(createRoute).toContain('webFormApiSchema.safeParse')
    expect(createRoute).toContain('await validateWebFormAssignee')
    expect(createRoute).toContain('createSlugFromName')
    expect(createRoute).not.toContain('const { name, description, fields')
    expect(updateRoute).toContain('webFormApiUpdateSchema.safeParse')
    expect(updateRoute).toContain('await validateWebFormAssignee')
    expect(updateRoute).toContain('...validation.data')
    expect(publicSubmit).toContain("return corsResponse({ error: 'Formulario no encontrado o inactivo' }, 404, allowedOrigin)")
    expect(publicSubmit).toContain('sanitizeErrorForClient')
    expect(publicSubmit).toContain('function corsResponse(data: any, status: number, origin: string)')
  })

  it('requires campaigns to be complete before activation or scheduling', () => {
    const createRoute = readFileSync('app/api/campaigns/route.ts', 'utf8')
    const updateRoute = readFileSync('app/api/campaigns/[id]/route.ts', 'utf8')
    const page = readFileSync('app/campaigns/page.tsx', 'utf8')

    expect(createRoute).toContain('validateCampaignReadyForStatus')
    expect(createRoute).toContain('campaign.status !==')
    expect(createRoute).toContain('El contenido de la campaña es requerido antes de activar')
    expect(createRoute).toContain('El asunto es requerido para campañas de email')
    expect(createRoute).toContain('La campaña necesita una audiencia antes de activarse o programarse')
    expect(createRoute.indexOf('validateCampaignReadyForStatus(validation.data, contactCount)')).toBeLessThan(
      createRoute.indexOf('.insert({ ...validation.data')
    )
    expect(updateRoute).toContain('validateCampaignReadyForStatus({ ...existing, ...validation.data })')
    expect(page).toContain('const getSendProgress')
    expect(page).toContain('if (!campaign.contact_count || campaign.contact_count <= 0) return 0')
  })

  it('uses shared SSRF protection before outbound webhook delivery', () => {
    const helper = readFileSync('lib/outbound-url-security.ts', 'utf8')
    const webhooksLib = readFileSync('lib/webhooks.ts', 'utf8')
    const webhooksRoute = readFileSync('app/api/webhooks/route.ts', 'utf8')
    const webhookRoute = readFileSync('app/api/webhooks/[id]/route.ts', 'utf8')
    const workflowExecutor = readFileSync('lib/workflow-executor.ts', 'utf8')
    const workflows = readFileSync('lib/workflows.ts', 'utf8')
    const events = readFileSync('lib/events.ts', 'utf8')
    const integrationTestRoute = readFileSync('app/api/integrations/[id]/test/route.ts', 'utf8')

    expect(helper).toContain("from 'node:dns/promises'")
    expect(helper).toContain('isPrivateOrReservedAddress')
    expect(helper).toContain('metadata.google.internal')
    expect(helper).toContain('El host resuelve a una IP privada o reservada')
    expect(webhooksLib).toContain('validateOutboundWebhookUrl(webhook.url)')
    expect(webhooksLib.indexOf('validateOutboundWebhookUrl(webhook.url)')).toBeLessThan(
      webhooksLib.indexOf('fetch(webhook.url')
    )
    expect(webhooksRoute).toContain('validateOutboundWebhookUrl(validation.data.url)')
    expect(webhookRoute).toContain('validateOutboundWebhookUrl(validation.data.url)')
    expect(webhookRoute).toContain('validateOutboundWebhookUrl(webhook.url)')
    expect(workflowExecutor).toContain('await validateOutboundWebhookUrl(url)')
    expect(workflows).toContain('await validateOutboundWebhookUrl(action.params.url)')
    expect(events).toContain('await validateOutboundWebhookUrl(url)')
    expect(integrationTestRoute).toContain('await validateOutboundWebhookUrl(url)')
  })

  it('validates quote references before inserting tenant-scoped quote items', () => {
    const route = readFileSync('app/api/quotes/route.ts', 'utf8')

    expect(route).toContain('validateQuoteReferences')
    expect(route).toContain("from('contacts')")
    expect(route).toContain("from('opportunities')")
    expect(route).toContain("from('products')")
    expect(route).toContain(".eq('organization_id', organizationId)")
    const validateIndex = route.indexOf('await validateQuoteReferences')
    const quoteInsertIndex = route.indexOf('.insert({', validateIndex)
    const itemInsertIndex = route.indexOf("from('quote_items').insert")

    expect(validateIndex).toBeGreaterThan(-1)
    expect(quoteInsertIndex).toBeGreaterThan(validateIndex)
    expect(itemInsertIndex).toBeGreaterThan(validateIndex)
  })

  it('keeps invoice item products and sales order items aligned with database contracts', () => {
    const sql = readFileSync('supabase/migrations/100_revenue_inventory_consistency.sql', 'utf8')
    const schema = readFileSync('lib/schemas.ts', 'utf8')

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id)')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS tax_rate NUMERIC')
    expect(sql).toContain("ALTER TYPE sales_order_status ADD VALUE IF NOT EXISTS 'completed'")
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS order_number TEXT')
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb")
    expect(sql).toContain('sales_orders_items_array_check')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION create_invoice_with_items_atomic')
    expect(sql).toContain('p_user_id IS NULL OR p_user_id <> v_user_id')
    expect(sql).toContain('FROM contacts c')
    expect(sql).toContain('c.organization_id = p_org_id')
    expect(sql).toContain('WHERE id = v_product_id')
    expect(sql).toContain('AND organization_id = p_org_id')
    expect(sql).toContain('INSERT INTO invoice_items (invoice_id, product_id, description')
    expect(sql).toContain('INSERT INTO inventory_movements')
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION create_invoice_with_items_atomic')
    expect(schema).toContain('export const salesOrderItemSchema')
    expect(schema).toContain('items: z.array(salesOrderItemSchema).optional().default([])')
  })

  it('validates sales order references before writing or decrementing stock', () => {
    const helper = readFileSync('lib/sales-order-references.ts', 'utf8')
    const ordersRoute = readFileSync('app/api/orders/route.ts', 'utf8')
    const orderRoute = readFileSync('app/api/orders/[id]/route.ts', 'utf8')

    expect(helper).toContain('validateSalesOrderReferences')
    expect(helper).toContain('from("accounts")')
    expect(helper).toContain('from("contacts")')
    expect(helper).toContain('from("opportunities")')
    expect(helper).toContain('from("products")')
    expect(helper).toContain('eq("organization_id", organizationId)')
    expect(ordersRoute.indexOf('await validateSalesOrderReferences')).toBeLessThan(
      ordersRoute.indexOf('.insert({ ...validation.data')
    )
    expect(orderRoute).toContain('const updateSalesOrderSchema = salesOrderSchema.partial()')
    expect(orderRoute.indexOf('await validateSalesOrderReferences')).toBeLessThan(
      orderRoute.indexOf('.update(validation.data)')
    )
    expect(orderRoute).toContain('.maybeSingle()')
    expect(orderRoute).toContain('decrement_stock')
  })

  it('validates tasks and tickets references before tenant-scoped writes', () => {
    const helper = readFileSync('lib/work-item-references.ts', 'utf8')
    const tasksRoute = readFileSync('app/api/tasks/route.ts', 'utf8')
    const taskRoute = readFileSync('app/api/tasks/[id]/route.ts', 'utf8')
    const tasksBulkRoute = readFileSync('app/api/tasks/bulk/route.ts', 'utf8')
    const ticketsRoute = readFileSync('app/api/tickets/route.ts', 'utf8')
    const ticketRoute = readFileSync('app/api/tickets/[id]/route.ts', 'utf8')
    const ticketsBulkRoute = readFileSync('app/api/tickets/bulk/route.ts', 'utf8')

    expect(helper).toContain('validateTaskReferences')
    expect(helper).toContain('validateTicketReferences')
    expect(helper).toContain('validateActiveOrganizationMember')
    expect(helper).toContain('from("organization_members")')
    expect(helper).toContain('eq("organization_id", organizationId)')
    expect(tasksRoute.indexOf('await validateTaskReferences')).toBeLessThan(
      tasksRoute.indexOf('.insert({ ...validation.data')
    )
    expect(taskRoute).toContain('const updateTaskSchema = taskSchema.partial()')
    expect(taskRoute.indexOf('await validateTaskReferences')).toBeLessThan(
      taskRoute.indexOf(".update(validation.data)")
    )
    expect(tasksBulkRoute).toContain('taskBulkUpdatesSchema')
    expect(tasksBulkRoute).toContain('await validateTaskReferences')
    expect(ticketsRoute.indexOf('await validateTicketReferences')).toBeLessThan(
      ticketsRoute.indexOf('.insert({ ...validation.data')
    )
    expect(ticketRoute).toContain('const updateTicketSchema = ticketSchema.partial()')
    expect(ticketRoute).toContain('export async function PATCH')
    expect(ticketRoute.indexOf('await validateTicketReferences')).toBeLessThan(
      ticketRoute.indexOf('.update(validation.data)')
    )
    expect(ticketsBulkRoute).toContain('ticketBulkUpdatesSchema')
    expect(ticketsBulkRoute).toContain('await validateTicketReferences')
    expect(ticketsBulkRoute).not.toContain('"category"')
  })

  it('keeps tickets UI/search/export aligned with the title-based database contract', () => {
    const ticketsRoute = readFileSync('app/api/tickets/route.ts', 'utf8')
    const searchRoute = readFileSync('app/api/search/route.ts', 'utf8')
    const ticketsTable = readFileSync('components/tickets/tickets-table.tsx', 'utf8')
    const exportUtils = readFileSync('lib/export-utils.ts', 'utf8')
    const events = readFileSync('lib/events.ts', 'utf8')

    expect(ticketsRoute).toContain('query.ilike("title"')
    expect(searchRoute).toContain('.select("id, title, status, priority")')
    expect(searchRoute).toContain('.ilike("title", searchPattern)')
    expect(ticketsTable).toContain('title: string')
    expect(ticketsTable).toContain('{ticket.title}')
    expect(exportUtils).toContain('{ key: "title", header: "Título" }')
    expect(exportUtils).not.toContain('"ticket_number"')
    expect(exportUtils).not.toContain('"subject"')
    expect(exportUtils).not.toContain('"category"')
    expect(events).toContain("payload.title || payload.subject")
    expect(events).toContain("organization_id: organizationId")
    expect(events).toContain(".in('role', ['owner', 'admin', 'manager'])")
  })

  it('scopes inbox conversations, messages, and notifications to the active organization', () => {
    const helper = readFileSync('lib/work-item-references.ts', 'utf8')
    const conversationsRoute = readFileSync('app/api/chat/conversations/route.ts', 'utf8')
    const messagesRoute = readFileSync('app/api/chat/[id]/messages/route.ts', 'utf8')
    const simulateRoute = readFileSync('app/api/chat/simulate/route.ts', 'utf8')
    const notificationsRoute = readFileSync('app/api/notifications/route.ts', 'utf8')
    const notificationsLib = readFileSync('lib/notifications.ts', 'utf8')

    expect(helper).toContain('validateConversationReferences')
    expect(helper).toContain('assertConversationInOrganization')
    expect(conversationsRoute).toContain('conversationQuerySchema.safeParse')
    expect(conversationsRoute).toContain('await validateConversationReferences')
    expect(conversationsRoute).not.toContain('name.ilike.%${search}%,email.ilike.%${search}%')
    expect(messagesRoute).toContain('conversationIdSchema.safeParse')
    expect(messagesRoute).toContain('await assertConversationInOrganization')
    expect(messagesRoute.indexOf('await assertConversationInOrganization')).toBeLessThan(
      messagesRoute.indexOf(".from('messages')")
    )
    expect(simulateRoute).toContain('await assertConversationInOrganization')
    expect(simulateRoute).toContain(".eq('organization_id', organizationId)")
    expect(notificationsRoute).toContain('notificationsQuerySchema.safeParse')
    expect(notificationsRoute).toContain('markNotificationsSchema.safeParse')
    expect(notificationsRoute).toContain('.eq("organization_id", organizationId)')
    expect(notificationsRoute).toContain('user_id.eq.${user.id},user_id.is.null')
    expect(notificationsLib).toContain('organization_id: organizationId')
    expect(notificationsLib).toContain("from('organization_members')")
  })

  it('keeps analytics endpoints from returning fake or unbounded data', () => {
    const advancedRoute = readFileSync('app/api/analytics/advanced/route.ts', 'utf8')
    const aggregatedRoute = readFileSync('app/api/analytics/aggregated/route.ts', 'utf8')
    const dashboardRoute = readFileSync('app/api/dashboard/route.ts', 'utf8')
    const analyticsRoute = readFileSync('app/api/analytics/route.ts', 'utf8')
    const pipelineRoute = readFileSync('app/api/analytics/pipeline/route.ts', 'utf8')
    const campaignsRoute = readFileSync('app/api/analytics/campaigns/route.ts', 'utf8')

    expect(advancedRoute).toContain("Advanced analytics is not implemented")
    expect(advancedRoute).not.toContain('total: 125000')
    expect(advancedRoute).not.toContain('Product A')
    expect(aggregatedRoute).toContain('querySchema.safeParse')
    expect(aggregatedRoute).toContain('from("analytics_cache")')
    expect(aggregatedRoute).not.toContain("rpc('get_aggregated_metrics'")
    expect(aggregatedRoute).not.toContain("rpc('aggregate_analytics_by_period'")
    expect(dashboardRoute).toContain('{ count: contactsTotal }')
    expect(dashboardRoute).toContain('value: (contactsTotal || 0).toString()')
    expect(dashboardRoute).toContain('for (let i = 0; i < 30; i++)')
    expect(analyticsRoute).toContain('analyticsQuerySchema.safeParse')
    expect(pipelineRoute).toContain('pipelineQuerySchema.safeParse')
    expect(campaignsRoute).toContain(".eq('organization_id', organizationId)")
    expect(campaignsRoute).toContain('campaignContactIds.length > 0')
  })

  it('validates report configs consistently before run/save/export', () => {
    const contracts = readFileSync('lib/report-contracts.ts', 'utf8')
    const runRoute = readFileSync('app/api/reports/run/route.ts', 'utf8')
    const savedRoute = readFileSync('app/api/reports/saved/route.ts', 'utf8')
    const exportRoute = readFileSync('app/api/reports/export/route.ts', 'utf8')

    expect(contracts).toContain('REPORT_ENTITY_DEFS')
    expect(contracts).toContain('reportConfigSchema')
    expect(contracts).toContain('last_quarter')
    expect(contracts).toContain('all_time')
    expect(contracts).toContain('Filtro no permitido')
    expect(runRoute).toContain('reportConfigSchema.safeParse')
    expect(runRoute).toContain('getReportDateFilter(dateRange)')
    expect(savedRoute).toContain('reportConfigSchema.safeParse')
    expect(savedRoute).toContain('serializeSavedReport')
    expect(exportRoute).toContain('exportPayloadSchema.safeParse')
    expect(exportRoute).toContain('exportFormatSchema.safeParse')
    expect(exportRoute).toContain('safeFilename')
    expect(exportRoute).toContain('rows: z.array(z.record(z.any())).max(5000)')
  })
})
