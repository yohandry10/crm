
export type ChannelType = 'whatsapp' | 'email' | 'messenger' | 'instagram' | 'webchat'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed'
export type ConversationStatus = 'open' | 'closed' | 'snoozed'

export interface Channel {
    id: string
    organization_id: string
    name: string
    type: ChannelType
    identifier: string
    is_active: boolean
    created_at: string
}

export interface Conversation {
    id: string
    organization_id: string
    channel_id: string | null
    contact_id: string | null
    assigned_to: string | null
    status: ConversationStatus
    subject: string | null
    last_message_at: string
    unread_count: number
    metadata: Record<string, any>
    created_at: string
    updated_at: string
    // Joins
    contact?: {
        id: string
        name: string
        avatar_url?: string
        email?: string
        phone?: string
    }
    channel?: Channel
    last_message?: Message
}

export interface Message {
    id: string
    organization_id: string
    conversation_id: string
    sender_id: string | null
    direction: MessageDirection
    content: string | null
    content_type: 'text' | 'image' | 'file' | 'template' | 'note'
    attachments: any[]
    status: MessageStatus
    external_id: string | null
    metadata: Record<string, any>
    created_at: string
    // Joins
    sender?: {
        id: string
        full_name: string
        avatar_url?: string
    }
}
