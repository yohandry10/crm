import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/auth-context"

export async function POST(request: NextRequest) {
  try {
    const { supabase, organizationId } = await getAuthenticatedContext()

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      )
    }

    const { data: contacts } = await request.json()

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: "No hay datos para importar" },
        { status: 400 }
      )
    }

    // Limit batch size
    if (contacts.length > 1000) {
      return NextResponse.json(
        { success: false, error: "Máximo 1000 registros por importación" },
        { status: 400 }
      )
    }

    const errors: string[] = []
    let imported = 0

    // Get existing emails to check for duplicates
    const emailsToCheck = contacts
      .filter((c: any) => c.email)
      .map((c: any) => c.email.toLowerCase().trim())

    const { data: existingContacts } = await supabase
      .from("contacts")
      .select("email")
      .eq("organization_id", organizationId)
      .in("email", emailsToCheck)

    const existingEmails = new Set(
      (existingContacts || []).map((c: any) => c.email?.toLowerCase())
    )

    let skipped = 0

    // Process in batches of 50
    const batchSize = 50
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize)

      const contactsToInsert = batch
        .filter((contact: any) => {
          // Skip if email already exists
          if (contact.email && existingEmails.has(contact.email.toLowerCase().trim())) {
            skipped++
            return false
          }
          return true
        })
        .map((contact: any) => ({
          organization_id: organizationId,
          name: contact.name,
          email: contact.email || null,
          phone: contact.phone || null,
          company: contact.company || null,
          position: contact.position || null,
          lead_source: contact.lead_source || "import",
          notes: contact.notes || null,
          lead_status: "cold",
        }))

      if (contactsToInsert.length === 0) continue

      const { data, error } = await supabase
        .from("contacts")
        .insert(contactsToInsert)
        .select("id")

      if (error) {
        errors.push(`Error en lote ${Math.floor(i / batchSize) + 1}: ${error.message}`)
      } else {
        imported += data?.length || 0
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      imported,
      skipped,
      errors,
      total: contacts.length,
      message: skipped > 0 ? `${skipped} contactos omitidos por email duplicado` : undefined,
    })
  } catch (error: any) {
    console.error("Import contacts error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Error al importar" },
      { status: 500 }
    )
  }
}
