import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { request, type FullConfig } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required E2E env var: ${name}`)
  return value
}

async function globalSetup(config: FullConfig) {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.BASE_URL ||
    config.projects[0]?.use?.baseURL?.toString() ||
    "http://localhost:3000"

  const authDir = path.join(process.cwd(), "tests/e2e/.auth")

  await mkdir(authDir, { recursive: true })

  async function ensureConfiguredE2EAccounts() {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    const userEmail = requireEnv("TEST_USER_EMAIL").toLowerCase()
    const userPassword = requireEnv("TEST_USER_PASSWORD")
    const adminEmail = requireEnv("TEST_ADMIN_EMAIL").toLowerCase()
    const adminPassword = requireEnv("TEST_ADMIN_PASSWORD")
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userProfile, error: userProfileError } = await admin
      .from("profiles")
      .select("id,current_organization_id")
      .eq("email", userEmail)
      .single()

    if (userProfileError || !userProfile?.current_organization_id) {
      throw new Error(`Cannot resolve TEST_USER_EMAIL profile/current organization: ${userProfileError?.message || "missing org"}`)
    }

    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers()
    if (listError) throw listError

    async function ensureAuthUser(email: string, password: string, fullName: string) {
      const existing = existingUsers.users.find((candidate) => candidate.email?.toLowerCase() === email)
      if (!existing) {
        const created = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        })
        if (created.error) throw created.error
        return created.data.user
      }

      const updated = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (updated.error) throw updated.error
      return updated.data.user
    }

    const regularUser = await ensureAuthUser(userEmail, userPassword, "E2E Usuario Real")
    const platformAdmin = await ensureAuthUser(adminEmail, adminPassword, "Super Admin")
    if (!regularUser || !platformAdmin) throw new Error("Unable to provision configured E2E accounts")

    const { error: regularProfileError } = await admin
      .from("profiles")
      .upsert({
        id: regularUser.id,
        email: userEmail,
        full_name: "E2E Usuario Real",
        is_platform_admin: false,
        current_organization_id: userProfile.current_organization_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })
    if (regularProfileError) throw regularProfileError

    const { error: regularMembershipError } = await admin
      .from("organization_members")
      .upsert({
        organization_id: userProfile.current_organization_id,
        user_id: regularUser.id,
        role: "owner",
        is_active: true,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,user_id" })
    if (regularMembershipError) throw regularMembershipError

    const { data: adminProfile } = await admin
      .from("profiles")
      .select("current_organization_id")
      .eq("id", platformAdmin.id)
      .maybeSingle()

    const { error: platformProfileError } = await admin
      .from("profiles")
      .upsert({
        id: platformAdmin.id,
        email: adminEmail,
        full_name: "Super Admin",
        is_platform_admin: true,
        current_organization_id: adminProfile?.current_organization_id || userProfile.current_organization_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })
    if (platformProfileError) throw platformProfileError
  }

  async function ensureRoleUsers() {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    const ownerEmail = requireEnv("TEST_USER_EMAIL").toLowerCase()
    const password = "E2E-role-6559234.y"
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: ownerProfile, error: ownerProfileError } = await admin
      .from("profiles")
      .select("id,current_organization_id")
      .eq("email", ownerEmail)
      .single()

    if (ownerProfileError || !ownerProfile?.current_organization_id) {
      throw new Error(`Cannot resolve E2E owner organization: ${ownerProfileError?.message || "missing org"}`)
    }

    const organizationId = ownerProfile.current_organization_id
    const roles = ["owner", "admin", "manager", "member", "viewer"] as const

    const { data: existingContact, error: existingContactError } = await admin
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", "e2e.seed.contact@example.com")
      .maybeSingle()

    if (existingContactError) throw existingContactError

    if (!existingContact) {
      const { error: seedContactError } = await admin
        .from("contacts")
        .insert({
          organization_id: organizationId,
          created_by: ownerProfile.id,
          name: "E2E Contacto Base",
          email: "e2e.seed.contact@example.com",
          phone: "+51999000000",
          lead_status: "warm",
          source: "e2e",
        })

      if (seedContactError) throw seedContactError
    }

    for (const role of roles) {
      const email = `e2e.${role}.crm@example.com`
      const fullName = `E2E ${role}`
      const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers()
      if (listError) throw listError

      let user = existingUsers.users.find((candidate) => candidate.email?.toLowerCase() === email)
      if (!user) {
        const created = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        })
        if (created.error) throw created.error
        user = created.data.user
      } else {
        const updated = await admin.auth.admin.updateUserById(user.id, {
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        })
        if (updated.error) throw updated.error
      }

      if (!user) throw new Error(`Unable to provision ${role} E2E user`)

      const { error: profileError } = await admin
        .from("profiles")
        .upsert({
          id: user.id,
          email,
          full_name: fullName,
          is_platform_admin: false,
          current_organization_id: organizationId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" })

      if (profileError) throw profileError

      const { error: membershipError } = await admin
        .from("organization_members")
        .upsert({
          organization_id: organizationId,
          user_id: user.id,
          role,
          is_active: true,
          invited_by: ownerProfile.id,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id,user_id" })

      if (membershipError) throw membershipError
    }
  }

  async function login(emailEnv: string, passwordEnv: string, authFileName: string) {
    const email = requireEnv(emailEnv)
    const password = requireEnv(passwordEnv)
    const context = await request.newContext({ baseURL })
    const response = await context.post("/api/auth/login", {
      data: { email, password },
    })

    if (!response.ok()) {
      throw new Error(`E2E login failed for ${emailEnv}: ${response.status()} ${await response.text()}`)
    }

    const authPath = path.join(authDir, authFileName)
    await context.storageState({ path: authPath })
    await context.dispose()

    const storageState = JSON.parse(await readFile(authPath, "utf8"))
    const origin = new URL(baseURL).origin
    const existingOrigin = storageState.origins?.find((entry: any) => entry.origin === origin)
    const tourFlag = { name: "hasSeenWelcomeTour", value: "true" }

    if (existingOrigin) {
      existingOrigin.localStorage = [
        ...(existingOrigin.localStorage || []).filter((item: any) => item.name !== tourFlag.name),
        tourFlag,
      ]
    } else {
      storageState.origins = [
        ...(storageState.origins || []),
        { origin, localStorage: [tourFlag] },
      ]
    }

    await writeFile(authPath, `${JSON.stringify(storageState, null, 2)}\n`)
  }

  await ensureConfiguredE2EAccounts()
  await ensureRoleUsers()

  await login("TEST_USER_EMAIL", "TEST_USER_PASSWORD", "user.json")
  await login("TEST_ADMIN_EMAIL", "TEST_ADMIN_PASSWORD", "superadmin.json")

  for (const role of ["owner", "admin", "manager", "member", "viewer"]) {
    process.env[`TEST_ROLE_${role.toUpperCase()}_EMAIL`] = `e2e.${role}.crm@example.com`
    process.env[`TEST_ROLE_${role.toUpperCase()}_PASSWORD`] = "E2E-role-6559234.y"
    await login(`TEST_ROLE_${role.toUpperCase()}_EMAIL`, `TEST_ROLE_${role.toUpperCase()}_PASSWORD`, `${role}.json`)
  }
}

export default globalSetup
