import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import crypto from "crypto"

// Función para generar HTML de la factura
function generateInvoiceHTML(invoice: any, settings: any): string {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount || 0)
    }

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('es-PE', {
            year: 'numeric', month: 'long', day: 'numeric'
        })
    }

    const itemsHTML = invoice.items?.map((item: any) => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.total)}</td>
        </tr>
    `).join('') || ''

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Factura ${invoice.invoice_number}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #1f2937; line-height: 1.5; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .company-info h1 { font-size: 24px; color: #6366f1; margin-bottom: 8px; }
        .company-info p { color: #6b7280; font-size: 13px; }
        .invoice-info { text-align: right; }
        .invoice-info h2 { font-size: 28px; color: #1f2937; margin-bottom: 8px; }
        .invoice-info .number { font-size: 16px; color: #6366f1; font-weight: 600; }
        .invoice-info .date { color: #6b7280; font-size: 13px; margin-top: 4px; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .status-draft { background: #f3f4f6; color: #6b7280; }
        .status-sent { background: #dbeafe; color: #1d4ed8; }
        .status-paid { background: #d1fae5; color: #059669; }
        .status-overdue { background: #fee2e2; color: #dc2626; }
        .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .party { width: 45%; }
        .party h3 { font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; letter-spacing: 0.5px; }
        .party p { margin-bottom: 4px; }
        .party .name { font-weight: 600; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f9fafb; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; }
        th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
        .totals { margin-left: auto; width: 300px; }
        .totals .row { display: flex; justify-content: space-between; padding: 8px 0; }
        .totals .row.total { border-top: 2px solid #1f2937; font-size: 18px; font-weight: 700; padding-top: 12px; margin-top: 8px; }
        .notes { background: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 30px; }
        .notes h3 { font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
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
                <p>${settings?.company_email || ''}</p>
            </div>
            <div class="invoice-info">
                <h2>FACTURA</h2>
                <p class="number">${invoice.invoice_number}</p>
                <p class="date">Emitida: ${formatDate(invoice.issue_date)}</p>
                <p class="date">Vence: ${formatDate(invoice.due_date)}</p>
                <div style="margin-top: 12px;">
                    <span class="status status-${invoice.status}">${invoice.status === 'draft' ? 'Borrador' :
            invoice.status === 'sent' ? 'Enviada' :
                invoice.status === 'paid' ? 'Pagada' :
                    invoice.status === 'overdue' ? 'Vencida' : invoice.status
        }</span>
                </div>
            </div>
        </div>

        <div class="parties">
            <div class="party">
                <h3>Facturar a</h3>
                <p class="name">${invoice.contact?.name || 'Cliente'}</p>
                ${invoice.contact?.ruc ? `<p>RUC: ${invoice.contact.ruc}</p>` : ''}
                ${invoice.contact?.address ? `<p>${invoice.contact.address}</p>` : ''}
                ${invoice.contact?.email ? `<p>${invoice.contact.email}</p>` : ''}
                ${invoice.contact?.phone ? `<p>${invoice.contact.phone}</p>` : ''}
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
                <span>${formatCurrency(invoice.subtotal)}</span>
            </div>
            <div class="row">
                <span>IGV (18%):</span>
                <span>${formatCurrency(invoice.tax)}</span>
            </div>
            <div class="row total">
                <span>Total:</span>
                <span>${formatCurrency(invoice.total)}</span>
            </div>
        </div>

        ${invoice.notes ? `
        <div class="notes">
            <h3>Notas</h3>
            <p>${invoice.notes}</p>
        </div>
        ` : ''}

        <div class="footer">
            <p>Gracias por su preferencia</p>
            <p>${settings?.company_name || 'Mi Empresa'} - ${settings?.company_ruc || ''}</p>
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

        // Obtener factura con items y contacto
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .select(`
                *,
                contact:contacts(id, name, email, phone, ruc, address),
                items:invoice_items(id, description, quantity, unit_price, total)
            `)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (invoiceError || !invoice) {
            return NextResponse.json({ success: false, error: "Factura no encontrada" }, { status: 404 })
        }

        // Obtener configuración de la organización (ahora está en organizations)
        const { data: org } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', organizationId)
            .single()

        // Map to frontend/template expected format
        const orgSettings = {
            ...org,
            company_name: org.name,
            company_ruc: org.ruc,
            company_address: org.address,
            company_phone: org.phone,
            company_email: org.email,
        }

        // Generar HTML
        const html = generateInvoiceHTML(invoice, orgSettings)

        // Retornar HTML (el cliente puede usar window.print() o una librería como html2pdf)
        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': `inline; filename="factura-${invoice.invoice_number}.html"`,
            },
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/invoices/[id]/pdf", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
