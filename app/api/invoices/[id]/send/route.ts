import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/auth-context"
import { sendEmail, invoiceEmailTemplate } from "@/lib/email"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, organizationId } = await getAuthenticatedContext()
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

    // Get invoice with contact and items
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        contact:contacts(name, email),
        items:invoice_items(
          description,
          quantity,
          unit_price,
          total
        )
      `)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { success: false, error: "Factura no encontrada" },
        { status: 404 }
      )
    }

    // Check if contact has email
    if (!invoice.contact?.email) {
      return NextResponse.json(
        { success: false, error: "El contacto no tiene email registrado" },
        { status: 400 }
      )
    }

    // Get organization name
    // Get organization name and details
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .single()

    // Format dates
    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      })
    }

    // Format currency
    const formatCurrency = (amount: number) => amount.toFixed(2)

    // Build email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/+$/, "") || request.nextUrl.origin
    const viewLink = `${appUrl}/invoicing/${invoice.id}`
    const downloadLink = `${appUrl}/api/invoices/${invoice.id}/pdf`

    const emailHtml = invoiceEmailTemplate({
      customerName: invoice.contact.name,
      invoiceNumber: invoice.invoice_number,
      issueDate: formatDate(invoice.issue_date),
      dueDate: formatDate(invoice.due_date),
      total: formatCurrency(invoice.total),
      currency: "S/",
      viewLink,
      downloadLink,
      organizationName: org?.name || "CRM",
      items: invoice.items?.map((item: any) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: formatCurrency(item.unit_price),
        total: formatCurrency(item.total)
      }))
    })

    // Send email
    const result = await sendEmail({
      to: invoice.contact.email,
      subject: `Factura ${invoice.invoice_number} - ${org?.name || "CRM"}`,
      html: emailHtml
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Error al enviar email" },
        { status: 500 }
      )
    }

    // Update invoice status to 'sent' if it was draft
    if (invoice.status === "draft") {
      await supabase
        .from("invoices")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", organizationId)
    }

    // Log the email sent
    await supabase.from("activity_logs").insert({
      organization_id: organizationId,
      entity_type: "invoice",
      entity_id: id,
      action: "email_sent",
      changes: { to: invoice.contact.email, email_id: result.id }
    })

    return NextResponse.json({
      success: true,
      message: `Factura enviada a ${invoice.contact.email}`,
      emailId: result.id
    })
  } catch (error: any) {
    console.error("Error sending invoice:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
