/**
 * Script de prueba para enviar un evento de lead creado a N8N
 * Ejecutar: node scripts/test-n8n-webhook.js
 */

const N8N_WEBHOOK_URL = 'http://localhost:5678/webhook-test/crm-lead-created'

const testPayload = {
  event: 'lead_created',
  timestamp: new Date().toISOString(),
  data: {
    id: 'test-lead-123',
    email: 'juan.perez@example.com',
    name: 'Juan Pérez',
    company: 'Acme Corp',
    phone: '+1234567890',
    lead_status: 'new',
    lead_score: 50,
    source: 'website',
    organization_id: 'test-org-456'
  }
}

async function sendTestEvent() {
  console.log('🚀 Enviando evento de prueba a N8N...')
  console.log('URL:', N8N_WEBHOOK_URL)
  console.log('Payload:', JSON.stringify(testPayload, null, 2))
  
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    })

    if (response.ok) {
      const result = await response.json()
      console.log('✅ Evento enviado exitosamente!')
      console.log('Respuesta:', JSON.stringify(result, null, 2))
    } else {
      console.error('❌ Error:', response.status, response.statusText)
      const text = await response.text()
      console.error('Respuesta:', text)
    }
  } catch (error) {
    console.error('❌ Error al enviar:', error.message)
  }
}

sendTestEvent()
