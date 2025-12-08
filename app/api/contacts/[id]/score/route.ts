import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import { calculateLeadScore, type LeadScoreFactors } from "@/lib/lead-scoring"
import crypto from "crypto"

const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 50 }

// POST: Calculate and update lead score
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const { supabase, organizationId } = await getAuthenticatedContext()

    // Get contact data
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single()

    if (contactError || !contact) {
      return NextResponse.json(
        { success: false, error: "Contacto no encontrado" },
        { status: 404 }
      )
    }

    // Get engagement data
    const [emailsResult, tasksResult, eventsResult, opportunitiesResult] = await Promise.all([
      supabase
        .from("synced_emails")
        .select("id")
        .eq("contact_id", id)
        .eq("organization_id", organizationId),
      supabase
        .from("tasks")
        .select("id, status")
        .eq("contact_id", id)
        .eq("organization_id", organizationId),
      supabase
        .from("calendar_events")
        .select("id")
        .eq("contact_id", id)
        .eq("organization_id", organizationId),
      supabase
        .from("opportunities")
        .select("id, stage")
        .eq("contact_id", id)
        .eq("organization_id", organizationId),
    ])

    // Build scoring factors
    const factors: LeadScoreFactors = {
      demographic: {
        hasEmail: !!contact.email,
        hasPhone: !!contact.phone,
        hasCompany: !!contact.company,
        hasPosition: !!contact.position,
        industryMatch: true, // Could be enhanced with industry matching
        locationMatch: true,
      },
      engagement: {
        emailsOpened: emailsResult.data?.length || 0,
        emailsClicked: 0, // Would need tracking
        websiteVisits: 0, // Would need tracking
        pagesViewed: 0,
        formsSubmitted: contact.lead_source === "form" ? 1 : 0,
        documentsDownloaded: 0,
        meetingsScheduled: eventsResult.data?.length || 0,
      },
      behavior: {
        responseTime: contact.last_interaction_at 
          ? getResponseTime(new Date(contact.last_interaction_at))
          : "none",
        interactionFrequency: getInteractionFrequency(
          (emailsResult.data?.length || 0) + 
          (tasksResult.data?.length || 0) + 
          (eventsResult.data?.length || 0)
        ),
        lastInteractionDays: contact.last_interaction_at
          ? Math.floor((Date.now() - new Date(contact.last_interaction_at).getTime()) / (1000 * 60 * 60 * 24))
          : 999,
        requestedQuote: opportunitiesResult.data?.some(o => o.stage === "proposal") || false,
        requestedDemo: (eventsResult.data?.length ?? 0) > 0,
      },
      fit: {
        budgetRange: "unknown",
        decisionMaker: contact.position?.toLowerCase().includes("director") || 
                       contact.position?.toLowerCase().includes("gerente") ||
                       contact.position?.toLowerCase().includes("ceo") || false,
        timeline: "unknown",
        companySize: "unknown",
      },
    }

    // Calculate score
    const scoreResult = calculateLeadScore(factors)

    // Update contact
    const { error: updateError } = await supabase
      .from("contacts")
      .update({
        lead_score: scoreResult.totalScore,
        lead_score_factors: scoreResult.breakdown,
        lead_status: scoreResult.totalScore >= 70 ? "hot" : 
                     scoreResult.totalScore >= 40 ? "warm" : "cold",
      })
      .eq("id", id)
      .eq("organization_id", organizationId)

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      data: {
        score: scoreResult.totalScore,
        grade: scoreResult.grade,
        breakdown: scoreResult.breakdown,
        recommendations: scoreResult.recommendations,
        predictedConversion: scoreResult.predictedConversion,
        nextBestAction: scoreResult.nextBestAction,
      }
    })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: `/api/contacts/${(await params).id}/score`,
      method: "POST",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

function getResponseTime(lastInteraction: Date): "fast" | "medium" | "slow" | "none" {
  const daysSince = Math.floor((Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24))
  if (daysSince <= 1) return "fast"
  if (daysSince <= 3) return "medium"
  if (daysSince <= 7) return "slow"
  return "none"
}

function getInteractionFrequency(totalInteractions: number): "high" | "medium" | "low" {
  if (totalInteractions >= 10) return "high"
  if (totalInteractions >= 3) return "medium"
  return "low"
}
