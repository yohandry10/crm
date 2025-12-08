// Script de prueba para el webhook de N8N
const testWebhook = async () => {
  try {
    const response = await fetch('http://192.168.100.4:3000/api/webhooks/n8n', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-n8n-secret': 'tu-secret-seguro-aqui'
      },
      body: JSON.stringify({
        action: 'update_lead_score',
        organization_id: 'test-org-456',
        data: {
          contact_id: '123',
          score: 75
        }
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
};

testWebhook();
