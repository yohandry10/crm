import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import crypto from "crypto"

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * POST /api/quotes/[id]/send
 * Send quote to client via email or other channels
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { supabase, organizationId, organization } = await getAuthenticatedContext()
        const { id: quoteId } = await params
        const body = await request.json()

        const { method, to, message, payment_link } = body

        if (!quoteId) {
            throw new ValidationError("ID de cotización requerido")
        }

        // Get quote with items and contact
        const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .select(`
                *,
                contact:contacts(id, name, email, phone),
                items:quote_items(*)
            `)
            .eq('id', quoteId)
            .eq('organization_id', organizationId)
            .single()

        if (quoteError || !quote) {
            throw new ValidationError("Cotización no encontrada")
        }

        if (method === 'email') {
            if (!to) {
                throw new ValidationError("Correo del destinatario requerido")
            }

            // Import email module
            const { sendEmail } = await import('@/lib/email')

            // Format items for email
            const itemsHtml = quote.items?.map((item: any) => `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">S/ ${Number(item.unit_price).toFixed(2)}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">S/ ${Number(item.total).toFixed(2)}</td>
                </tr>
            `).join('') || ''

            // Build email HTML
            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
        .quote-info { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #f3f4f6; padding: 12px 8px; text-align: left; font-weight: 600; }
        .total-row { font-weight: bold; font-size: 18px; }
        .btn { display: inline-block; background: #06b6d4; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 24px;">📋 Cotización #${quote.quote_number}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${organization?.name || 'Nuestra Empresa'}</p>
        </div>
        
        <div class="content">
            <p>Hola <strong>${quote.contact?.name || 'Cliente'}</strong>,</p>
            
            <p>Gracias por tu interés. A continuación te presentamos nuestra cotización:</p>
            
            <div class="quote-info">
                <p><strong>Número:</strong> ${quote.quote_number}</p>
                <p><strong>Fecha:</strong> ${new Date(quote.created_at).toLocaleDateString('es-PE')}</p>
                ${quote.valid_until ? `<p><strong>Válida hasta:</strong> ${new Date(quote.valid_until).toLocaleDateString('es-PE')}</p>` : ''}
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Descripción</th>
                        <th style="text-align: center;">Cant.</th>
                        <th style="text-align: right;">P. Unit.</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="3" style="padding: 12px 8px; text-align: right;">TOTAL:</td>
                        <td style="padding: 12px 8px; text-align: right; color: #06b6d4;">S/ ${Number(quote.total_amount).toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
            
            ${quote.notes ? `<p><strong>Notas:</strong> ${quote.notes}</p>` : ''}
            ${quote.terms ? `<p><strong>Términos:</strong> ${quote.terms}</p>` : ''}
            
            ${payment_link ? `
            <div style="text-align: center; margin: 30px 0;">
                <p>Para ver los detalles completos y realizar el pago:</p>
                <a href="${payment_link}" class="btn">Ver Cotización y Pagar</a>
            </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <p>${organization?.name || ''}</p>
            <p>${organization?.email || ''} ${organization?.phone ? `• ${organization.phone}` : ''}</p>
        </div>
    </div>
</body>
</html>
`

            // Send email
            const result = await sendEmail({
                to,
                subject: `Cotización #${quote.quote_number} - ${organization?.name || 'Nueva Cotización'}`,
                html: emailHtml
            })

            if (!result.success) {
                throw new Error(result.error || "Error al enviar email")
            }

            return NextResponse.json({
                success: true,
                message: "Cotización enviada por correo"
            })
        }

        // For WhatsApp, we just return success as the frontend handles opening WhatsApp
        if (method === 'whatsapp') {
            return NextResponse.json({
                success: true,
                message: "Mensaje preparado para WhatsApp"
            })
        }

        throw new ValidationError("Método de envío no válido")

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/quotes/[id]/send`,
            method: "POST",
            error
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
