// Email service using Resend
// Install: npm install resend

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
}

interface EmailResult {
  success: boolean
  id?: string
  error?: string
}

// Read at runtime to ensure Next.js loads .env.local properly
function getResendApiKey() {
  return process.env.RESEND_API_KEY
}

function getDefaultFrom() {
  return process.env.EMAIL_FROM || "CRM <noreply@tudominio.com>"
}

export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  const RESEND_API_KEY = getResendApiKey()
  const DEFAULT_FROM = getDefaultFrom()

  // Debug logs
  console.log("--- DEBUG EMAIL SENDING ---")
  console.log("Process ID:", process.pid)
  console.log("RESEND_API_KEY configured:", !!RESEND_API_KEY)
  console.log("RESEND_API_KEY length:", RESEND_API_KEY?.length || 0)
  console.log("First 3 chars:", RESEND_API_KEY?.substring(0, 3) || "N/A")
  console.log("NODE_ENV:", process.env.NODE_ENV)
  console.log("---------------------------")

  if (!RESEND_API_KEY) {
    console.log("❌ Email not sent (Resend not configured):", params.subject, "to:", params.to)
    return { success: false, error: "Email service not configured (Key missing)" }
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.from || DEFAULT_FROM,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        reply_to: params.replyTo,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || "Failed to send email")
    }

    return { success: true, id: data.id }
  } catch (error: any) {
    console.error("Email send error:", error)
    return { success: false, error: error.message }
  }
}

// Email Templates

export function invitationEmailTemplate(params: {
  organizationName: string
  inviterName?: string
  role: string
  inviteLink: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #0891b2; margin: 0;">CRM</h1>
  </div>
  
  <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: #1e293b;">¡Has sido invitado!</h2>
    <p>
      ${params.inviterName ? `<strong>${params.inviterName}</strong> te ha invitado a` : "Has sido invitado a"} 
      unirte a <strong>${params.organizationName}</strong> como <strong>${params.role}</strong>.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.inviteLink}" 
         style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
        Aceptar Invitación
      </a>
    </div>
    
    <p style="font-size: 14px; color: #64748b;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
      <a href="${params.inviteLink}" style="color: #0891b2; word-break: break-all;">${params.inviteLink}</a>
    </p>
  </div>
  
  <p style="font-size: 12px; color: #94a3b8; text-align: center;">
    Este enlace expira en 7 días. Si no solicitaste esta invitación, puedes ignorar este email.
  </p>
</body>
</html>
`
}

export function trialExpiringEmailTemplate(params: {
  organizationName: string
  daysRemaining: number
  upgradeLink: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #0891b2; margin: 0;">CRM</h1>
  </div>
  
  <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: #92400e;">⏰ Tu prueba termina ${params.daysRemaining === 0 ? "hoy" : params.daysRemaining === 1 ? "mañana" : `en ${params.daysRemaining} días`}</h2>
    <p>
      El período de prueba de <strong>${params.organizationName}</strong> está por terminar.
      Suscríbete ahora para no perder acceso a tus datos y continuar usando todas las funciones.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.upgradeLink}" 
         style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
        Ver Planes y Suscribirse
      </a>
    </div>
  </div>
  
  <p style="font-size: 14px; color: #64748b;">
    ¿Tienes preguntas? Responde a este email y te ayudaremos.
  </p>
</body>
</html>
`
}

export function paymentFailedEmailTemplate(params: {
  organizationName: string
  updatePaymentLink: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #0891b2; margin: 0;">CRM</h1>
  </div>
  
  <div style="background: #fef2f2; border: 1px solid #ef4444; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: #991b1b;">⚠️ Problema con tu pago</h2>
    <p>
      No pudimos procesar el pago de tu suscripción de <strong>${params.organizationName}</strong>.
      Por favor actualiza tu método de pago para evitar la suspensión del servicio.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.updatePaymentLink}" 
         style="display: inline-block; background: #ef4444; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
        Actualizar Método de Pago
      </a>
    </div>
  </div>
  
  <p style="font-size: 14px; color: #64748b;">
    Si crees que esto es un error, por favor contáctanos respondiendo a este email.
  </p>
</body>
</html>
`
}

export function welcomeEmailTemplate(params: {
  userName: string
  organizationName: string
  loginLink: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #0891b2; margin: 0;">CRM</h1>
  </div>
  
  <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: #166534;">🎉 ¡Bienvenido, ${params.userName}!</h2>
    <p>
      Tu cuenta en <strong>${params.organizationName}</strong> ha sido creada exitosamente.
      Ya puedes empezar a usar el CRM para gestionar tus contactos, ventas y más.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.loginLink}" 
         style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
        Ir al CRM
      </a>
    </div>
    
    <h3 style="color: #166534;">Próximos pasos:</h3>
    <ul style="color: #166534;">
      <li>Completa tu perfil</li>
      <li>Importa tus contactos</li>
      <li>Configura tu pipeline de ventas</li>
    </ul>
  </div>
  
  <p style="font-size: 14px; color: #64748b;">
    ¿Necesitas ayuda? Responde a este email y te asistiremos.
  </p>
</body>
</html>
`
}

// Helper to check if email is configured
export function isEmailConfigured(): boolean {
  return !!getResendApiKey()
}

// Invoice Email Template
export function invoiceEmailTemplate(params: {
  customerName: string
  invoiceNumber: string
  issueDate: string
  dueDate: string
  total: string
  currency?: string
  viewLink: string
  downloadLink?: string
  organizationName?: string
  logoUrl?: string
  items?: Array<{ description: string; quantity: number; unitPrice: string; total: string }>
  // Payment methods
  yapePhone?: string
  yapeQrUrl?: string
  plinPhone?: string
  plinQrUrl?: string
  bankName?: string
  bankAccount?: string
  bankCci?: string
  bankHolder?: string
}): string {
  const itemsHtml = params.items?.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.unitPrice}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.total}</td>
    </tr>
  `).join('') || ''

  // Build payment methods section
  const hasPaymentMethods = params.yapePhone || params.plinPhone || params.bankName

  const paymentMethodsHtml = hasPaymentMethods ? `
    <!-- Payment Methods -->
    <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 16px;">💰 Medios de Pago</h3>
      
      ${params.yapePhone ? `
      <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #bbf7d0;">
        <strong style="color: #7c3aed;">📱 Yape</strong>
        <p style="margin: 5px 0;">Número: <strong>${params.yapePhone}</strong></p>
        ${params.yapeQrUrl ? `<img src="${params.yapeQrUrl}" alt="QR Yape" style="max-width: 120px; margin-top: 10px;" />` : ''}
      </div>
      ` : ''}
      
      ${params.plinPhone ? `
      <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #bbf7d0;">
        <strong style="color: #0891b2;">📱 Plin</strong>
        <p style="margin: 5px 0;">Número: <strong>${params.plinPhone}</strong></p>
        ${params.plinQrUrl ? `<img src="${params.plinQrUrl}" alt="QR Plin" style="max-width: 120px; margin-top: 10px;" />` : ''}
      </div>
      ` : ''}
      
      ${params.bankName ? `
      <div>
        <strong style="color: #059669;">🏦 Transferencia Bancaria</strong>
        <table style="margin-top: 10px; font-size: 14px;">
          <tr><td style="color: #64748b; padding: 3px 10px 3px 0;">Banco:</td><td><strong>${params.bankName}</strong></td></tr>
          ${params.bankHolder ? `<tr><td style="color: #64748b; padding: 3px 10px 3px 0;">Titular:</td><td>${params.bankHolder}</td></tr>` : ''}
          ${params.bankAccount ? `<tr><td style="color: #64748b; padding: 3px 10px 3px 0;">Cuenta:</td><td><strong>${params.bankAccount}</strong></td></tr>` : ''}
          ${params.bankCci ? `<tr><td style="color: #64748b; padding: 3px 10px 3px 0;">CCI:</td><td>${params.bankCci}</td></tr>` : ''}
        </table>
      </div>
      ` : ''}
      
      <p style="margin: 15px 0 0 0; font-size: 13px; color: #166534;">
        <strong>Referencia:</strong> ${params.invoiceNumber} - ${params.currency || 'S/'} ${params.total}
      </p>
    </div>
  ` : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #06b6d4, #3b82f6); padding: 30px; text-align: center;">
      ${params.logoUrl ? `<img src="${params.logoUrl}" alt="Logo" style="max-height: 50px; margin-bottom: 10px;" />` : ''}
      <h1 style="color: white; margin: 0; font-size: 24px;">${params.organizationName || 'CRM'}</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Factura ${params.invoiceNumber}</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <p style="margin-top: 0;">Estimado/a <strong>${params.customerName}</strong>,</p>
      <p>Adjuntamos la factura correspondiente a los servicios/productos adquiridos.</p>
      
      <!-- Invoice Details -->
      <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Número de Factura:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${params.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Fecha de Emisión:</td>
            <td style="padding: 8px 0; text-align: right;">${params.issueDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Fecha de Vencimiento:</td>
            <td style="padding: 8px 0; text-align: right;">${params.dueDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 18px;">Total a Pagar:</td>
            <td style="padding: 8px 0; text-align: right; font-size: 24px; font-weight: 700; color: #0891b2;">${params.currency || 'S/'} ${params.total}</td>
          </tr>
        </table>
      </div>
      
      ${params.items && params.items.length > 0 ? `
      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 12px; text-align: left; font-weight: 600;">Descripción</th>
            <th style="padding: 12px; text-align: center; font-weight: 600;">Cant.</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">P. Unit.</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      ` : ''}
      
      ${paymentMethodsHtml}
      
      <!-- CTA Buttons -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.viewLink}" 
           style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 5px;">
          Ver Factura
        </a>
        ${params.downloadLink ? `
        <a href="${params.downloadLink}" 
           style="display: inline-block; background: #64748b; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 5px;">
          Descargar PDF
        </a>
        ` : ''}
      </div>
      
      <p style="color: #64748b; font-size: 14px;">
        Si tiene alguna pregunta sobre esta factura, no dude en contactarnos.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
        Este es un correo automático generado por el sistema CRM.
      </p>
    </div>
  </div>
</body>
</html>
`
}

/**
 * Get email template by name
 * Used by workflow actions to send templated emails
 */
export function getEmailTemplate(
  templateName: string,
  params: Record<string, any>
): { subject: string; html: string } {
  switch (templateName) {
    case 'welcome':
      return {
        subject: `¡Bienvenido a ${params.organizationName || 'CRM'}!`,
        html: welcomeEmailTemplate({
          userName: params.name || params.userName || 'Usuario',
          organizationName: params.organizationName || 'CRM',
          loginLink: params.loginLink || `${process.env.NEXT_PUBLIC_APP_URL || ''}/login`
        })
      }

    case 'task_assigned':
      return {
        subject: `Nueva tarea asignada: ${params.title || 'Sin título'}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 12px; padding: 30px;">
    <h2 style="margin-top: 0; color: #0369a1;">📋 Nueva Tarea Asignada</h2>
    <p><strong>Título:</strong> ${params.title || 'Sin título'}</p>
    ${params.description ? `<p><strong>Descripción:</strong> ${params.description}</p>` : ''}
    ${params.due_date ? `<p><strong>Fecha límite:</strong> ${params.due_date}</p>` : ''}
    ${params.priority ? `<p><strong>Prioridad:</strong> ${params.priority}</p>` : ''}
    <div style="text-align: center; margin-top: 20px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/tasks" 
         style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
        Ver Tarea
      </a>
    </div>
  </div>
</body>
</html>`
      }

    case 'order_completed':
      return {
        subject: `Pedido completado: ${params.order_number || params.id || ''}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 12px; padding: 30px;">
    <h2 style="margin-top: 0; color: #166534;">✅ Pedido Completado</h2>
    <p>El pedido <strong>${params.order_number || params.id || ''}</strong> ha sido completado exitosamente.</p>
    ${params.total ? `<p><strong>Total:</strong> S/ ${params.total}</p>` : ''}
    ${params.customer_name ? `<p><strong>Cliente:</strong> ${params.customer_name}</p>` : ''}
  </div>
</body>
</html>`
      }

    case 'invoice_reminder':
      return {
        subject: `Recordatorio: Factura ${params.invoice_number || ''} pendiente`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 12px; padding: 30px;">
    <h2 style="margin-top: 0; color: #92400e;">⚠️ Recordatorio de Pago</h2>
    <p>La factura <strong>${params.invoice_number || ''}</strong> está pendiente de pago.</p>
    ${params.total ? `<p><strong>Monto:</strong> S/ ${params.total}</p>` : ''}
    ${params.due_date ? `<p><strong>Vencimiento:</strong> ${params.due_date}</p>` : ''}
    <div style="text-align: center; margin-top: 20px;">
      <a href="${params.viewLink || `${process.env.NEXT_PUBLIC_APP_URL || ''}/invoicing`}" 
         style="display: inline-block; background: #f59e0b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
        Ver Factura
      </a>
    </div>
  </div>
</body>
</html>`
      }

    case 'lead_converted':
      return {
        subject: `🎉 Lead convertido: ${params.name || ''}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 12px; padding: 30px;">
    <h2 style="margin-top: 0; color: #166534;">🎉 ¡Lead Convertido!</h2>
    <p>El lead <strong>${params.name || ''}</strong> ha sido convertido a cliente.</p>
    ${params.email ? `<p><strong>Email:</strong> ${params.email}</p>` : ''}
    ${params.company ? `<p><strong>Empresa:</strong> ${params.company}</p>` : ''}
  </div>
</body>
</html>`
      }

    default:
      // Generic notification template
      return {
        subject: params.subject || 'Notificación del CRM',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px;">
    <h2 style="margin-top: 0; color: #1e293b;">${params.title || 'Notificación'}</h2>
    <p>${params.body || params.message || 'Tienes una nueva notificación del CRM.'}</p>
    ${params.actionUrl ? `
    <div style="text-align: center; margin-top: 20px;">
      <a href="${params.actionUrl}" 
         style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
        Ver Detalles
      </a>
    </div>
    ` : ''}
  </div>
</body>
</html>`
      }
  }
}
