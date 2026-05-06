import { ValidationError } from "@/lib/error-handler"

export function serializeCalendarEvent(event: any) {
    return {
        ...event,
        start: event.start_time,
        end: event.end_time,
        start_time: event.start_time,
        end_time: event.end_time,
        all_day: false,
    }
}

export async function hydrateCalendarEventOwners(supabase: any, events: any[]) {
    const ownerIds = Array.from(new Set(events.map((event) => event.owner_id).filter(Boolean)))
    if (ownerIds.length === 0) return events

    const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ownerIds)

    if (error) throw error

    const profilesById = new Map((profiles || []).map((profile: any) => [profile.id, profile]))

    return events.map((event) => ({
        ...event,
        owner: profilesById.get(event.owner_id) || null,
    }))
}

export function assertCalendarDateRange(start: string, end: string) {
    if (new Date(end).getTime() <= new Date(start).getTime()) {
        throw new ValidationError("La fecha de fin debe ser posterior a la fecha de inicio")
    }
}

export async function validateCalendarEventReferences(
    supabase: any,
    organizationId: string,
    event: { contact_id?: string | null; opportunity_id?: string | null }
) {
    const contactQuery = event.contact_id
        ? supabase.from("contacts").select("id").eq("id", event.contact_id).eq("organization_id", organizationId).maybeSingle()
        : Promise.resolve({ data: null, error: null })

    const opportunityQuery = event.opportunity_id
        ? supabase.from("opportunities").select("id").eq("id", event.opportunity_id).eq("organization_id", organizationId).maybeSingle()
        : Promise.resolve({ data: null, error: null })

    const [
        { data: contact, error: contactError },
        { data: opportunity, error: opportunityError },
    ] = await Promise.all([contactQuery, opportunityQuery])

    if (contactError) throw contactError
    if (event.contact_id && !contact) {
        throw new ValidationError("El contacto seleccionado no existe o no pertenece a tu organización")
    }

    if (opportunityError) throw opportunityError
    if (event.opportunity_id && !opportunity) {
        throw new ValidationError("La oportunidad seleccionada no existe o no pertenece a tu organización")
    }
}
