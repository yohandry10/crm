import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import { generateQuoteHTML, generateInvoiceHTML } from "@/lib/pdf-generator"
import crypto from "crypto"

const READ_LIMIT = { interval: 60 * 1000, maxRequests: 30 }

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, READ_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, organizationId } = await getAuthenticatedContext()
    const searchParams = request.nextUrl.searchParams
    const quoteId = searchParams.get("quote_id")
    const invoiceId = searchParams.get("invoice_id")
    const format = searchParams.get("format") || "html"

    if (!quoteId && !invoiceId) {
      return NextResponse.json(
        { success: false, error: "quote_id o invoice_id requerido" },
        { status: 400 }
      )
    }

    // Get organization info
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .single()

    let html: string
    let filename: string

    if (quoteId) {
      const { data: quote, error } = await supabase
        .from("quotes")
        .select(`*, contact:contacts(name, email, phone, company, tax_id, address)`)
        .eq("id", quoteId)
        .eq("organization_id", organizationId)
        .single()

      if (error || !quote) {
        return NextResponse.json(
          { success: false, error: "Cotización no encontrada" },
          { status: 404 }
        )
      }

      html = generateQuoteHTML({
        quote_number: quote.quote_number,
        date: new Date(quote.created_at).toLocaleDateString("es-PE"),
        valid_until: new Date(quote.valid_until).toLocaleDateString("es-PE"),
        company_name: org?.name || "Mi Empresa",
        company_ruc: org?.tax_id || "",
        company_address: org?.address || "",
        company_phone: org?.phone || "",
        company_email: org?.email || "",
        client_name: quote.contact?.name || "Cliente",
        client_ruc: quote.contact?.tax_id,
        client_address: quote.contact?.address,
        client_email: quote.contact?.email,
        client_phone: quote.contact?.phone,
        items: quote.items || [],
        subtotal: quote.subtotal,
        tax: quote.tax,
        total: quote.total,
        currency: "S/",
        notes: quote.notes,
        terms: quote.terms,
        payment_terms: quote.payment_terms,
      })
      filename = `cotizacion-${quote.quote_number}.${format === "html" ? "html" : "pdf"}`
    } else {
      const { data: invoice, error } = await supabase
        .from("invoices")
        .select(`*, contact:contacts(name, email, phone, company, tax_id, address)`)
        .eq("id", invoiceId)
        .eq("organization_id", organizationId)
        .single()

      if (error || !invoice) {
        return NextResponse.json(
          { success: false, error: "Factura no encontrada" },
          { status: 404 }
        )
      }

      html = generateInvoiceHTML({
        quote_number: invoice.invoice_number,
        date: new Date(invoice.issue_date).toLocaleDateString("es-PE"),
        valid_until: new Date(invoice.due_date).toLocaleDateString("es-PE"),
        company_name: org?.name || "Mi Empresa",
        company_ruc: org?.tax_id || "",
        company_address: org?.address || "",
        company_phone: org?.phone || "",
        company_email: org?.email || "",
        client_name: invoice.contact?.name || "Cliente",
        client_ruc: invoice.contact?.tax_id,
        client_address: invoice.contact?.address,
        client_email: invoice.contact?.email,
        client_phone: invoice.contact?.phone,
        items: invoice.items || [],
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        currency: "S/",
        notes: invoice.notes,
        invoice_type: invoice.invoice_type || "factura",
        serie: invoice.serie || "F001",
      })
      filename = `factura-${invoice.invoice_number}.${format === "html" ? "html" : "pdf"}`
    }

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `inline; filename="${filename}"`,
      }
    })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/pdf/quote",
      method: "GET",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
