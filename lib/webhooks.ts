import crypto from "crypto"
import { logger } from "./logger"
import { decryptSecret } from "./encryption"

export const WEBHOOK_EVENTS = [
  "contact.created",
  "contact.updated",
  "contact.deleted",
  "lead.created",
  "lead.converted",
  "opportunity.created",
  "opportunity.updated",
  "opportunity.won",
  "opportunity.lost",
  "invoice.created",
  "invoice.paid",
  "invoice.overdue",
  "task.created",
  "task.completed",
  "quote.created",
  "quote.accepted",
] as const

export type WebhookEvent = typeof WEBHOOK_EVENTS[number]

/**
 * Utility function to send webhook
 * Called from other parts of the application
 */
export async function sendWebhook(
  organizationId: string,
  event: WebhookEvent,
  payload: any,
  supabase: any
) {
  try {
    // Get active webhooks for this event
    const { data: webhooks } = await supabase
      .from("webhooks")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .contains("events", [event])

    if (!webhooks || webhooks.length === 0) return

    const timestamp = Date.now()

    for (const webhook of webhooks) {
      const body = JSON.stringify({
        event,
        timestamp,
        data: payload,
      })

      let webhookSecret: string | null = webhook.secret ?? null
      if (!webhookSecret && webhook.secret_encrypted) {
        try {
          webhookSecret = decryptSecret(webhook.secret_encrypted)
        } catch (error) {
          logger.warn("Failed to decrypt webhook secret", { webhookId: webhook.id })
          continue
        }
      }

      if (!webhookSecret) {
        logger.warn("Webhook secret missing, skipping delivery", { webhookId: webhook.id })
        continue
      }

      // Generate signature
      const signature = crypto
        .createHmac("sha256", webhookSecret)
        .update(body)
        .digest("hex")

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "X-Webhook-Event": event,
            "X-Webhook-Timestamp": timestamp.toString(),
            ...webhook.headers,
          },
          body,
        })

        // Log delivery
        await supabase
          .from("webhook_deliveries")
          .insert({
            webhook_id: webhook.id,
            event,
            payload,
            response_status: response.status,
            response_body: await response.text().catch(() => null),
            delivered_at: new Date().toISOString(),
            success: response.ok,
          })

      } catch (deliveryError: any) {
        // Log failed delivery
        await supabase
          .from("webhook_deliveries")
          .insert({
            webhook_id: webhook.id,
            event,
            payload,
            error: deliveryError.message,
            delivered_at: new Date().toISOString(),
            success: false,
          })
      }
    }
  } catch (error) {
    logger.error("Error sending webhooks", error)
  }
}
