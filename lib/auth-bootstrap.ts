import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"

const MAX_SLUG_RETRIES = 5

export type EnsureUserBootstrapInput = {
  userId: string
  email?: string | null
  fullName?: string | null
  avatarUrl?: string | null
  organizationName?: string | null
  createOrganizationIfMissing?: boolean
}

export type EnsureUserBootstrapResult = {
  profileCreated: boolean
  organizationCreated: boolean
  organizationId: string | null
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48)
}

function deriveOrganizationName(fullName?: string | null, email?: string | null): string {
  if (fullName?.trim()) return `${fullName.trim()} Workspace`
  if (email?.trim()) return `${email.split("@")[0]} Workspace`
  return "Mi Organizacion"
}

function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase env vars for auth bootstrap")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function createOrganizationWithUniqueSlug(
  supabaseAdmin: SupabaseClient,
  userId: string,
  organizationName: string,
  organizationEmail?: string | null
): Promise<string> {
  const baseSlug = slugify(organizationName) || `workspace-${userId.slice(0, 8)}`
  let lastError: any = null

  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 7)}`
    const slug = `${baseSlug}${suffix}`

    const { data, error } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: organizationName,
        slug,
        email: organizationEmail || null,
        created_by: userId,
      })
      .select("id")
      .single()

    if (!error && data?.id) return data.id
    if (error?.code !== "23505") {
      throw error
    }

    lastError = error
  }

  throw lastError || new Error("Could not generate unique organization slug")
}

export async function ensureUserBootstrap(
  input: EnsureUserBootstrapInput
): Promise<EnsureUserBootstrapResult> {
  const supabaseAdmin = createSupabaseAdminClient()
  const createOrganizationIfMissing = input.createOrganizationIfMissing === true
  const now = new Date().toISOString()
  const safeEmail =
    input.email?.trim().toLowerCase() || `missing-${input.userId.slice(0, 8)}@invalid.local`

  // Read current profile state first so we can report if this is a new profile.
  const { data: existingProfile, error: profileReadError } = await supabaseAdmin
    .from("profiles")
    .select("id, current_organization_id")
    .eq("id", input.userId)
    .maybeSingle()

  if (profileReadError) throw profileReadError

  const profilePayload: Record<string, any> = {
    id: input.userId,
    email: safeEmail,
    updated_at: now,
  }

  if (input.fullName !== undefined) profilePayload.full_name = input.fullName || null
  if (input.avatarUrl !== undefined) profilePayload.avatar_url = input.avatarUrl || null

  const { error: profileUpsertError } = await supabaseAdmin
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" })

  if (profileUpsertError) throw profileUpsertError

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", input.userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError) throw membershipError

  let organizationId = membership?.organization_id || existingProfile?.current_organization_id || null
  let organizationCreated = false

  if (!organizationId && createOrganizationIfMissing) {
    const organizationName = input.organizationName?.trim() || deriveOrganizationName(input.fullName, input.email)

    organizationId = await createOrganizationWithUniqueSlug(
      supabaseAdmin,
      input.userId,
      organizationName,
      input.email
    )
    organizationCreated = true

    const { error: memberUpsertError } = await supabaseAdmin
      .from("organization_members")
      .upsert(
        {
          organization_id: organizationId,
          user_id: input.userId,
          role: "owner",
          is_active: true,
          invited_by: input.userId,
          accepted_at: now,
          updated_at: now,
        },
        { onConflict: "organization_id,user_id" }
      )

    if (memberUpsertError) throw memberUpsertError
  }

  if (organizationId) {
    const { data: profileAfter, error: profileAfterError } = await supabaseAdmin
      .from("profiles")
      .select("current_organization_id")
      .eq("id", input.userId)
      .maybeSingle()

    if (profileAfterError) throw profileAfterError

    if (!profileAfter?.current_organization_id) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from("profiles")
        .update({
          current_organization_id: organizationId,
          updated_at: now,
        })
        .eq("id", input.userId)

      if (profileUpdateError) throw profileUpdateError
    }
  }

  const result = {
    profileCreated: !existingProfile,
    organizationCreated,
    organizationId,
  }

  logger.info("Auth bootstrap completed", {
    userId: input.userId,
    profileCreated: result.profileCreated,
    organizationCreated: result.organizationCreated,
    organizationId: result.organizationId,
  })

  return result
}
