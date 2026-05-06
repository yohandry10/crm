/**
 * Email Sync Integration
 * Soporta: Gmail API y Microsoft Graph API
 */

export interface EmailAccount {
  id: string
  provider: 'gmail' | 'outlook'
  email: string
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export interface Email {
  id: string
  threadId?: string
  from: string
  to: string[]
  cc?: string[]
  subject: string
  body: string
  bodyHtml?: string
  date: Date
  isRead: boolean
  hasAttachments: boolean
  attachments?: EmailAttachment[]
  labels?: string[]
}

export interface EmailAttachment {
  id: string
  filename: string
  mimeType: string
  size: number
}

export interface SendEmailParams {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  bodyHtml?: string
  attachments?: { filename: string; content: string; mimeType: string }[]
  replyToMessageId?: string
}

/**
 * Gmail API Integration
 */
export class GmailClient {
  private accessToken: string
  private baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me'

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Lista emails con filtros
   */
  async listEmails(params: {
    query?: string
    maxResults?: number
    pageToken?: string
    labelIds?: string[]
  }): Promise<{ emails: Email[]; nextPageToken?: string }> {
    const searchParams = new URLSearchParams()
    if (params.query) searchParams.set('q', params.query)
    if (params.maxResults) searchParams.set('maxResults', params.maxResults.toString())
    if (params.pageToken) searchParams.set('pageToken', params.pageToken)
    if (params.labelIds) searchParams.set('labelIds', params.labelIds.join(','))

    const data = await this.request(`/messages?${searchParams.toString()}`)
    
    const emails: Email[] = []
    for (const msg of data.messages || []) {
      const fullMessage = await this.getMessage(msg.id)
      emails.push(fullMessage)
    }

    return { emails, nextPageToken: data.nextPageToken }
  }

  /**
   * Obtiene un email específico
   */
  async getMessage(messageId: string): Promise<Email> {
    const data = await this.request(`/messages/${messageId}?format=full`)
    return this.parseGmailMessage(data)
  }

  /**
   * Busca emails por contacto
   */
  async getEmailsByContact(contactEmail: string, maxResults = 20): Promise<Email[]> {
    const { emails } = await this.listEmails({
      query: `from:${contactEmail} OR to:${contactEmail}`,
      maxResults,
    })
    return emails
  }

  /**
   * Envía un email
   */
  async sendEmail(params: SendEmailParams): Promise<{ id: string; threadId: string }> {
    const raw = this.createRawEmail(params)
    
    const data = await this.request('/messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw }),
    })

    return { id: data.id, threadId: data.threadId }
  }

  /**
   * Responde a un email
   */
  async replyToEmail(messageId: string, params: SendEmailParams): Promise<{ id: string }> {
    const originalMessage = await this.getMessage(messageId)
    
    const replyParams = {
      ...params,
      subject: params.subject.startsWith('Re:') ? params.subject : `Re: ${params.subject}`,
      replyToMessageId: messageId,
    }

    const raw = this.createRawEmail(replyParams)
    
    const data = await this.request('/messages/send', {
      method: 'POST',
      body: JSON.stringify({ 
        raw,
        threadId: originalMessage.threadId,
      }),
    })

    return { id: data.id }
  }

  private parseGmailMessage(data: any): Email {
    const headers = data.payload?.headers || []
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value

    let body = ''
    let bodyHtml = ''

    // Extraer body del mensaje
    if (data.payload?.body?.data) {
      body = Buffer.from(data.payload.body.data, 'base64').toString('utf-8')
    } else if (data.payload?.parts) {
      for (const part of data.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8')
        }
        if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8')
        }
      }
    }

    return {
      id: data.id,
      threadId: data.threadId,
      from: getHeader('From') || '',
      to: (getHeader('To') || '').split(',').map((e: string) => e.trim()),
      cc: getHeader('Cc')?.split(',').map((e: string) => e.trim()),
      subject: getHeader('Subject') || '(Sin asunto)',
      body,
      bodyHtml,
      date: new Date(parseInt(data.internalDate)),
      isRead: !data.labelIds?.includes('UNREAD'),
      hasAttachments: data.payload?.parts?.some((p: any) => p.filename) || false,
      labels: data.labelIds,
    }
  }

  private createRawEmail(params: SendEmailParams): string {
    const boundary = `boundary_${Date.now()}`
    
    const email = [
      `To: ${params.to.join(', ')}`,
      params.cc ? `Cc: ${params.cc.join(', ')}` : '',
      params.bcc ? `Bcc: ${params.bcc.join(', ')}` : '',
      `Subject: ${params.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      params.body,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      '',
      params.bodyHtml || params.body,
      '',
      `--${boundary}--`,
    ].filter(Boolean).join('\r\n')

    return Buffer.from(email).toString('base64url')
  }
}

/**
 * Microsoft Graph API Integration (Outlook)
 */
export class OutlookClient {
  private accessToken: string
  private baseUrl = 'https://graph.microsoft.com/v1.0/me'

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Microsoft Graph API error: ${response.status}`)
    }

    return response.json()
  }

  async listEmails(params: { top?: number; skip?: number; filter?: string }): Promise<Email[]> {
    const searchParams = new URLSearchParams()
    if (params.top) searchParams.set('$top', params.top.toString())
    if (params.skip) searchParams.set('$skip', params.skip.toString())
    if (params.filter) searchParams.set('$filter', params.filter)

    const data = await this.request(`/messages?${searchParams.toString()}`)
    return data.value.map(this.parseOutlookMessage)
  }

  async getEmailsByContact(contactEmail: string): Promise<Email[]> {
    return this.listEmails({
      filter: `from/emailAddress/address eq '${contactEmail}' or toRecipients/any(r: r/emailAddress/address eq '${contactEmail}')`,
      top: 20,
    })
  }

  async sendEmail(params: SendEmailParams): Promise<{ id: string }> {
    const message = {
      subject: params.subject,
      body: {
        contentType: params.bodyHtml ? 'HTML' : 'Text',
        content: params.bodyHtml || params.body,
      },
      toRecipients: params.to.map(email => ({ emailAddress: { address: email } })),
      ccRecipients: params.cc?.map(email => ({ emailAddress: { address: email } })),
    }

    const data = await this.request('/sendMail', {
      method: 'POST',
      body: JSON.stringify({ message, saveToSentItems: true }),
    })

    return { id: data.id || 'sent' }
  }

  private parseOutlookMessage(data: any): Email {
    return {
      id: data.id,
      from: data.from?.emailAddress?.address || '',
      to: data.toRecipients?.map((r: any) => r.emailAddress?.address) || [],
      cc: data.ccRecipients?.map((r: any) => r.emailAddress?.address),
      subject: data.subject || '(Sin asunto)',
      body: data.body?.content || '',
      bodyHtml: data.body?.contentType === 'html' ? data.body?.content : undefined,
      date: new Date(data.receivedDateTime),
      isRead: data.isRead,
      hasAttachments: data.hasAttachments,
    }
  }
}

/**
 * Factory para crear cliente de email según proveedor
 */
export function createEmailClient(provider: 'gmail' | 'outlook', accessToken: string) {
  if (provider === 'gmail') {
    return new GmailClient(accessToken)
  }
  return new OutlookClient(accessToken)
}
