/**
 * WhatsApp Business API Integration
 * Soporta: Meta Cloud API y proveedores como Twilio
 */

export interface WhatsAppConfig {
  provider: 'meta' | 'twilio' | 'messagebird'
  phoneNumberId?: string // Meta
  accessToken?: string
  accountSid?: string // Twilio
  authToken?: string
}

export interface WhatsAppMessage {
  to: string // Phone number with country code
  type: 'text' | 'template' | 'image' | 'document'
  content: string | WhatsAppTemplate
}

export interface WhatsAppTemplate {
  name: string
  language: string
  components?: WhatsAppTemplateComponent[]
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button'
  parameters: { type: string; text?: string; image?: { link: string } }[]
}

export interface WhatsAppMessageResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Envía mensaje de WhatsApp via Meta Cloud API
 */
export async function sendWhatsAppMessage(
  message: WhatsAppMessage,
  config?: Partial<WhatsAppConfig>
): Promise<WhatsAppMessageResult> {
  const phoneNumberId = config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = config?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'WhatsApp not configured' }
  }

  try {
    const payload: any = {
      messaging_product: 'whatsapp',
      to: formatPhoneNumber(message.to),
      type: message.type,
    }

    if (message.type === 'text') {
      payload.text = { body: message.content }
    } else if (message.type === 'template') {
      const template = message.content as WhatsAppTemplate
      payload.template = {
        name: template.name,
        language: { code: template.language },
        components: template.components,
      }
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )

    const data = await response.json()

    if (data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id }
    }

    return { success: false, error: data.error?.message || 'Unknown error' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Plantillas predefinidas para CRM
 */
export const WHATSAPP_TEMPLATES = {
  // Bienvenida a nuevo lead
  welcome_lead: (name: string, company: string) => ({
    name: 'welcome_lead',
    language: 'es',
    components: [
      {
        type: 'body' as const,
        parameters: [
          { type: 'text', text: name },
          { type: 'text', text: company },
        ],
      },
    ],
  }),

  // Seguimiento de cotización
  quote_followup: (name: string, quoteNumber: string, amount: string) => ({
    name: 'quote_followup',
    language: 'es',
    components: [
      {
        type: 'body' as const,
        parameters: [
          { type: 'text', text: name },
          { type: 'text', text: quoteNumber },
          { type: 'text', text: amount },
        ],
      },
    ],
  }),

  // Recordatorio de pago
  payment_reminder: (name: string, invoiceNumber: string, amount: string, dueDate: string) => ({
    name: 'payment_reminder',
    language: 'es',
    components: [
      {
        type: 'body' as const,
        parameters: [
          { type: 'text', text: name },
          { type: 'text', text: invoiceNumber },
          { type: 'text', text: amount },
          { type: 'text', text: dueDate },
        ],
      },
    ],
  }),

  // Confirmación de cita
  appointment_confirmation: (name: string, date: string, time: string) => ({
    name: 'appointment_confirmation',
    language: 'es',
    components: [
      {
        type: 'body' as const,
        parameters: [
          { type: 'text', text: name },
          { type: 'text', text: date },
          { type: 'text', text: time },
        ],
      },
    ],
  }),
}

/**
 * Formatea número de teléfono para WhatsApp
 */
function formatPhoneNumber(phone: string): string {
  // Remover espacios, guiones, paréntesis
  let cleaned = phone.replace(/[\s\-\(\)]/g, '')
  
  // Si empieza con 0, removerlo
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
  }
  
  // Si no tiene código de país, agregar Perú (+51)
  if (!cleaned.startsWith('+') && !cleaned.startsWith('51')) {
    cleaned = '51' + cleaned
  }
  
  // Remover el + si existe
  cleaned = cleaned.replace('+', '')
  
  return cleaned
}

/**
 * Genera link de WhatsApp Web/App
 */
export function generateWhatsAppLink(phone: string, message?: string): string {
  const formattedPhone = formatPhoneNumber(phone)
  const encodedMessage = message ? encodeURIComponent(message) : ''
  return `https://wa.me/${formattedPhone}${encodedMessage ? `?text=${encodedMessage}` : ''}`
}

/**
 * Mensajes rápidos predefinidos
 */
export const QUICK_MESSAGES = {
  greeting: (name: string) => 
    `¡Hola ${name}! 👋 Soy de [EMPRESA]. ¿En qué puedo ayudarte hoy?`,
  
  quote_sent: (name: string, quoteNumber: string) =>
    `Hola ${name}, te acabo de enviar la cotización ${quoteNumber} a tu correo. ¿Tienes alguna pregunta?`,
  
  followup: (name: string) =>
    `Hola ${name}, ¿pudiste revisar la información que te envié? Quedo atento a tus comentarios.`,
  
  thank_you: (name: string) =>
    `¡Gracias por tu preferencia ${name}! 🙏 Cualquier consulta, estamos para ayudarte.`,
  
  appointment_reminder: (name: string, date: string, time: string) =>
    `Hola ${name}, te recuerdo nuestra cita para el ${date} a las ${time}. ¡Te esperamos!`,
}
