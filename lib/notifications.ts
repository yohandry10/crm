import { logError } from "./error-logging"
import { createSupabaseServiceClient } from "./supabase-service"
import crypto from "crypto"
import { logger } from "./logger"

export interface NotificationPayload {
    userId: string
    title: string
    body: string
    type?: 'info' | 'warning' | 'success' | 'error' | 'reminder'
    actionUrl?: string
    relatedType?: string
    relatedId?: string
    data?: any
}

/**
 * Envía una notificación al usuario
 * - Guarda en BD para mostrar en la UI
 * - Envía email si está configurado
 */
export async function sendNotification(payload: NotificationPayload) {
    try {
        const supabase = createSupabaseServiceClient()

        // 1. Guardar notificación en BD
        const { data: notification, error: dbError } = await supabase
            .from('notifications')
            .insert({
                user_id: payload.userId,
                title: payload.title,
                message: payload.body,
                type: payload.type || 'info',
                action_url: payload.actionUrl,
                related_type: payload.relatedType,
                related_id: payload.relatedId,
                is_read: false,
                channel: 'in_app'
            })
            .select()
            .single()

        if (dbError) {
            logger.error('Error saving notification', dbError, { userId: payload.userId, type: payload.type })
        }

        // 2. Enviar email si Resend está configurado
        if (process.env.RESEND_API_KEY) {
            try {
                const { sendEmail } = await import('./email')
                await sendEmail({
                    to: payload.data?.email || '',
                    subject: payload.title,
                    html: `<p>${payload.body}</p>${payload.actionUrl ? `<p><a href="${payload.actionUrl}">Ver más</a></p>` : ''}`
                })
            } catch (emailError) {
                logger.warn('Email notification failed', { error: emailError, userId: payload.userId })
            }
        }

        return { 
            success: true, 
            notificationId: notification?.id || crypto.randomUUID()
        }
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "internal/notifications",
            method: "SEND",
            error,
        })
        return { success: false, error: error.message }
    }
}

/**
 * Envía notificación cuando se crea un nuevo lead
 */
export async function notifyNewLead(userId: string, leadName: string, leadId: string) {
    return sendNotification({
        userId,
        title: '🎯 Nuevo Lead',
        body: `${leadName} ha sido agregado como nuevo lead`,
        type: 'success',
        actionUrl: `/contacts?id=${leadId}`,
        relatedType: 'contact',
        relatedId: leadId
    })
}

/**
 * Envía notificación cuando una factura está por vencer
 */
export async function notifyInvoiceDue(userId: string, invoiceNumber: string, invoiceId: string, daysUntilDue: number) {
    return sendNotification({
        userId,
        title: '⚠️ Factura por vencer',
        body: `La factura ${invoiceNumber} vence en ${daysUntilDue} días`,
        type: 'warning',
        actionUrl: `/invoicing?id=${invoiceId}`,
        relatedType: 'invoice',
        relatedId: invoiceId
    })
}

/**
 * Envía notificación cuando se recibe un pago
 */
export async function notifyPaymentReceived(userId: string, amount: number, invoiceNumber: string) {
    return sendNotification({
        userId,
        title: '💰 Pago recibido',
        body: `Se recibió un pago de S/ ${amount.toLocaleString()} para la factura ${invoiceNumber}`,
        type: 'success',
        actionUrl: '/invoicing'
    })
}

/**
 * Envía notificación de tarea pendiente
 */
export async function notifyTaskDue(userId: string, taskTitle: string, taskId: string) {
    return sendNotification({
        userId,
        title: '📋 Tarea pendiente',
        body: `La tarea "${taskTitle}" está por vencer`,
        type: 'reminder',
        actionUrl: `/tasks?id=${taskId}`,
        relatedType: 'task',
        relatedId: taskId
    })
}

// Mantener compatibilidad con código existente
export const sendPushNotification = sendNotification
