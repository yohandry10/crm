import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const PASSWORD = "E2E-role-6559234.y"

type TenantSeed = {
  orgAId: string
  orgBId: string
  userAEmail: string
  userBEmail: string
  multiUserEmail: string
  contactAId: string
  contactBId: string
  quoteBId: string
  contactAName: string
  contactBName: string
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var ${name}`)
  return value
}

function adminClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function upsertAuthUser(admin: SupabaseClient, email: string, fullName: string) {
  const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers()
  if (listError) throw listError

  const existing = existingUsers.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
  if (existing) {
    const updated = await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (updated.error) throw updated.error
    return existing.id
  }

  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (created.error || !created.data.user) throw created.error || new Error(`Cannot create ${email}`)
  return created.data.user.id
}

async function seedTenantAudit(): Promise<TenantSeed> {
  const admin = adminClient()
  const stamp = Date.now()
  const orgASlug = `tenant-a-${stamp}`
  const orgBSlug = `tenant-b-${stamp}`
  const userAEmail = `tenant.a.${stamp}@example.org`
  const userBEmail = `tenant.b.${stamp}@example.org`
  const multiUserEmail = `tenant.multi.${stamp}@example.org`
  const contactAName = `Tenant A Contact ${stamp}`
  const contactBName = `Tenant B Contact ${stamp}`

  const userAId = await upsertAuthUser(admin, userAEmail, "Tenant A Owner")
  const userBId = await upsertAuthUser(admin, userBEmail, "Tenant B Owner")
  const multiUserId = await upsertAuthUser(admin, multiUserEmail, "Tenant Multi Owner")

  const { data: orgA, error: orgAError } = await admin
    .from("organizations")
    .insert({
      name: `Tenant A ${stamp}`,
      slug: orgASlug,
      subscription_status: "active",
      subscription_plan: "professional",
      onboarding_completed: true,
      created_by: userAId,
    })
    .select("id")
    .single()
  if (orgAError || !orgA) throw orgAError || new Error("Cannot create org A")

  const { data: orgB, error: orgBError } = await admin
    .from("organizations")
    .insert({
      name: `Tenant B ${stamp}`,
      slug: orgBSlug,
      subscription_status: "active",
      subscription_plan: "professional",
      onboarding_completed: true,
      created_by: userBId,
    })
    .select("id")
    .single()
  if (orgBError || !orgB) throw orgBError || new Error("Cannot create org B")

  const memberships = [
    { organization_id: orgA.id, user_id: userAId, role: "owner", invited_by: userAId },
    { organization_id: orgB.id, user_id: userBId, role: "owner", invited_by: userBId },
    { organization_id: orgA.id, user_id: multiUserId, role: "owner", invited_by: userAId },
    { organization_id: orgB.id, user_id: multiUserId, role: "owner", invited_by: userBId },
  ].map((membership) => ({
    ...membership,
    is_active: true,
    accepted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  const { error: membershipError } = await admin
    .from("organization_members")
    .upsert(memberships, { onConflict: "organization_id,user_id" })
  if (membershipError) throw membershipError

  const { error: profileError } = await admin
    .from("profiles")
    .upsert([
      { id: userAId, email: userAEmail, full_name: "Tenant A Owner", current_organization_id: orgA.id, is_platform_admin: false },
      { id: userBId, email: userBEmail, full_name: "Tenant B Owner", current_organization_id: orgB.id, is_platform_admin: false },
      { id: multiUserId, email: multiUserEmail, full_name: "Tenant Multi Owner", current_organization_id: orgA.id, is_platform_admin: false },
    ], { onConflict: "id" })
  if (profileError) throw profileError

  const { data: contacts, error: contactsError } = await admin
    .from("contacts")
    .insert([
      {
        organization_id: orgA.id,
        created_by: userAId,
        name: contactAName,
        email: `tenant.a.contact.${stamp}@example.org`,
        phone: "+51999001001",
        lead_status: "warm",
        source: "tenant-audit",
      },
      {
        organization_id: orgB.id,
        created_by: userBId,
        name: contactBName,
        email: `tenant.b.contact.${stamp}@example.org`,
        phone: "+51999001002",
        lead_status: "warm",
        source: "tenant-audit",
      },
    ])
    .select("id, organization_id, name")
  if (contactsError || !contacts || contacts.length !== 2) throw contactsError || new Error("Cannot create tenant contacts")

  const { data: quoteB, error: quoteBError } = await admin
    .from("quotes")
    .insert({
      organization_id: orgB.id,
      created_by: userBId,
      contact_id: contacts.find((contact) => contact.organization_id === orgB.id)!.id,
      quote_number: `QT-TENANT-B-${stamp}`,
      status: "draft",
      total_amount: 100,
      currency: "PEN",
    })
    .select("id")
    .single()
  if (quoteBError || !quoteB) throw quoteBError || new Error("Cannot create tenant B quote")

  return {
    orgAId: orgA.id,
    orgBId: orgB.id,
    userAEmail,
    userBEmail,
    multiUserEmail,
    contactAId: contacts.find((contact) => contact.organization_id === orgA.id)!.id,
    contactBId: contacts.find((contact) => contact.organization_id === orgB.id)!.id,
    quoteBId: quoteB.id,
    contactAName,
    contactBName,
  }
}

async function loginContext(baseURL: string | undefined, email: string) {
  const context = await playwrightRequest.newContext({ baseURL })
  const response = await context.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return context
}

async function expectContactList(context: APIRequestContext, expected: string, forbidden: string, headers?: Record<string, string>) {
  const response = await context.get("/api/contacts?limit=100", { headers })
  expect(response.ok(), await response.text()).toBeTruthy()
  const json = await response.json()
  const names = json.data.map((contact: any) => contact.name)
  expect(names).toContain(expected)
  expect(names).not.toContain(forbidden)
}

test("organization tenants are isolated across read, write, headers, and cross references", async ({ baseURL }) => {
  test.setTimeout(180_000)

  const seed = await seedTenantAudit()
  const tenantA = await loginContext(baseURL, seed.userAEmail)
  const tenantB = await loginContext(baseURL, seed.userBEmail)
  const multiTenant = await loginContext(baseURL, seed.multiUserEmail)

  try {
    await expectContactList(tenantA, seed.contactAName, seed.contactBName)
    await expectContactList(tenantB, seed.contactBName, seed.contactAName)

    const forgedHeaderRead = await tenantA.get("/api/contacts?limit=100", {
      headers: { "x-organization-id": seed.orgBId },
    })
    expect(forgedHeaderRead.status(), await forgedHeaderRead.text()).toBe(403)

    const crossTenantContact = await tenantA.get(`/api/contacts/${seed.contactBId}`)
    expect(crossTenantContact.status(), await crossTenantContact.text()).toBe(404)

    const crossTenantOpportunity = await tenantA.post("/api/opportunities", {
      data: {
        name: `Cross Tenant Opportunity ${Date.now()}`,
        contact_id: seed.contactBId,
        stage_id: "prospecting",
        expected_revenue: 100,
        probability: 10,
      },
    })
    expect(crossTenantOpportunity.status(), await crossTenantOpportunity.text()).toBe(400)

    const crossTenantPaymentLink = await tenantA.post("/api/payment-links", {
      data: {
        quote_id: seed.quoteBId,
        expires_days: 30,
      },
    })
    expect([400, 403]).toContain(crossTenantPaymentLink.status())

    await expectContactList(multiTenant, seed.contactAName, seed.contactBName)
    await expectContactList(multiTenant, seed.contactBName, seed.contactAName, { "x-organization-id": seed.orgBId })

    // A header-scoped request must not poison the default tenant context.
    await expectContactList(multiTenant, seed.contactAName, seed.contactBName)
  } finally {
    await tenantA.dispose()
    await tenantB.dispose()
    await multiTenant.dispose()
  }
})
