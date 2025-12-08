import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import crypto from "crypto"

function generateQuoteHTML(quote: any, settings: any): string {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount || 0)
    }

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('es-PE', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        })
    }

    const itemsHTML = quote.items?.map((item: any) => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.total)}</td>
        </tr>
    `).join('') || ''

    const statusLabels: Record<string, string> = {
        draft: 'Borrador',
        sent: 'Enviada',
        accepted: 'Aceptada',
        rejected: 'Rechazada',
        expired: 'Expirada'
    }
    const statusLabel = statusLabels[quote.status] || quote.status

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Cotización ${quote.quote_number}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #1f2937; line-height: 1.5; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .company-info h1 { font-size: 24px; color: #6366f1; margin-bottom: 8px; }
        .company-info p { color: #6b7280; font-size: 13px; }
        .quote-info { text-align: right; }
        .quote-info h2 { font-size: 28px; color: #1f2937; margin-bottom: 8px; }
        .quote-info .number { font-size: 16px; color: #6366f1; font-weight: 600; }
        .quote-info .date { color: #6b7280; font-size: 13px; margin-top: 4px; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
        .status-draft { background: #f3f4f6; color: #6b7280; }
        .status-sent { background: #dbeafe; color: #1d4ed8; }
        .status-accepted { background: #d1fae5; color: #059669; }
        .status-rejected { background: #fee2e2; color: #dc2626; }
        .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .party { width: 45%; }
        .party h3 { font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
        .party .name { font-weight: 600; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f9fafb; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; }
        .totals { margin-left: auto; width: 300px; }
        .totals .row { display: flex; justify-content: space-between; padding: 8px 0; }
        .totals .row.total { border-top: 2px solid #1f2937; font-size: 18px; font-weight: 700; padding-top: 12px; }
        .validity { background: #fef3c7; padding: 16px; border-radius: 8px; margin-top: 30px; text-align: center; }
        .notes { background: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 20px; }
        .footer { margin-top: 60px; text-align: center; color: #9ca3af; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="company-info">
                <h1>${settings?.company_name || 'Mi Empresa'}</h1>
                <p>RUC: ${settings?.company_ruc || '20000000000'}</p>
                <p>${settings?.company_address || ''}</p>
                <p>${settings?.company_phone || ''}</p>
            </div>
            <div class="quote-info">
                <h2>COTIZACIÓN</h2>
                <p class="number">#${quote.quote_number}</p>
                <p class="date">Fecha: ${formatDate(quote.created_at)}</p>
                <div style="margin-top: 12px;">
                    <span class="status status-${quote.status}">${statusLabel}</span>
                </div>
            </div>
        </div>

        <div class="parties">
            <div class="party">
                <h3>Cliente</h3>
                <p class="name">${quote.contact?.name || 'Cliente'}</p>
                ${quote.contact?.ruc ? `<p>RUC: ${quote.contact.ruc}</p>` : ''}
                ${quote.contact?.email ? `<p>${quote.contact.email}</p>` : ''}
                ${quote.contact?.phone ? `<p>${quote.contact.phone}</p>` : ''}
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Descripción</th>
                    <th style="text-align: center;">Cantidad</th>
                    <th style="text-align: right;">Precio Unit.</th>
                    <th style="text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHTML}
            </tbody>
        </table>

        <div class="totals">
            <div class="row">
                <span>Subtotal:</span>
                <span>${formatCurrency(quote.subtotal || quote.total_amount * 0.82)}</span>
            </div>
            <div class="row">
                <span>IGV (18%):</span>
                <span>${formatCurrency(quote.tax || quote.total_amount * 0.18)}</span>
            </div>
            <div class="row total">
                <span>Total:</span>
                <span>${formatCurrency(quote.total_amount)}</span>
            </div>
        </div>

        ${quote.valid_until ? `
        <div class="validity">
            <strong>Validez de la cotización:</strong> hasta el ${formatDate(quote.valid_until)}
        </div>
        ` : ''}

        ${quote.notes ? `
        <div class="notes">
            <h3 style="font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px;">Términos y Condiciones</h3>
            <p>${quote.notes}</p>
        </div>
        ` : ''}

        <div class="footer">
            <p>Gracias por su interés en nuestros servicios</p>
            <p>${settings?.company_name || 'Mi Empresa'}</p>
        </div>
    </div>
</body>
</html>
    `
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { supabase, organizationId } = await getAuthenticatedContext()

        const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .select(`
                *,
                contact:contacts(id, name, email, phone, ruc),
                items:quote_items(id, description, quantity, unit_price, total)
            `)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (quoteError || !quote) {
            return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 })
        }

        // Obtener configuración de la organización (ahora está en organizations)
        const { data: orgSettings } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', organizationId)
            .single()

        const html = generateQuoteHTML(quote, orgSettings)

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': `inline; filename="cotizacion-${quote.quote_number}.html"`,
            },
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/quotes/[id]/pdf", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
