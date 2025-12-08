/**
 * Generador de PDFs para Cotizaciones y Facturas
 * Usa HTML to PDF approach (compatible con edge)
 */

export interface QuoteItem {
  description: string
  quantity: number
  unit_price: number
  discount?: number
  tax_rate?: number
}

export interface QuoteData {
  quote_number: string
  date: string
  valid_until: string
  
  // Company info
  company_name: string
  company_ruc: string
  company_address: string
  company_phone: string
  company_email: string
  company_logo?: string
  
  // Client info
  client_name: string
  client_ruc?: string
  client_address?: string
  client_email?: string
  client_phone?: string
  
  // Items
  items: QuoteItem[]
  
  // Totals
  subtotal: number
  tax: number
  total: number
  currency: string
  
  // Additional
  notes?: string
  terms?: string
  payment_terms?: string
  
  // Salesperson
  salesperson_name?: string
  salesperson_email?: string
  salesperson_phone?: string
}

export function generateQuoteHTML(data: QuoteData): string {
  const formatCurrency = (amount: number) => {
    return `${data.currency} ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
  }

  const itemsHTML = data.items.map((item, index) => {
    const lineTotal = item.quantity * item.unit_price * (1 - (item.discount || 0) / 100)
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.discount || 0}%</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">${formatCurrency(lineTotal)}</td>
      </tr>
    `
  }).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Cotización ${data.quote_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; line-height: 1.5; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #3b82f6; }
    .quote-info { text-align: right; }
    .quote-number { font-size: 20px; font-weight: bold; color: #3b82f6; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .address-block { width: 45%; }
    .address-title { font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; font-weight: 600; }
    .address-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 40px; }
    .totals-table { width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .totals-row.total { font-size: 18px; font-weight: bold; color: #3b82f6; border-bottom: 2px solid #3b82f6; }
    .notes { background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .notes-title { font-weight: 600; margin-bottom: 8px; }
    .terms { font-size: 12px; color: #6b7280; }
    .footer { text-align: center; padding-top: 30px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
    .signature-area { margin-top: 60px; display: flex; justify-content: space-between; }
    .signature-line { width: 200px; border-top: 1px solid #1f2937; padding-top: 8px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="logo">${data.company_name}</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">RUC: ${data.company_ruc}</div>
      </div>
      <div class="quote-info">
        <div class="quote-number">COTIZACIÓN</div>
        <div style="font-size: 18px; font-weight: 600;">${data.quote_number}</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">
          Fecha: ${data.date}<br>
          Válido hasta: ${data.valid_until}
        </div>
      </div>
    </div>

    <!-- Addresses -->
    <div class="addresses">
      <div class="address-block">
        <div class="address-title">De</div>
        <div class="address-name">${data.company_name}</div>
        <div style="font-size: 14px; color: #4b5563;">
          ${data.company_address}<br>
          Tel: ${data.company_phone}<br>
          ${data.company_email}
        </div>
      </div>
      <div class="address-block">
        <div class="address-title">Para</div>
        <div class="address-name">${data.client_name}</div>
        <div style="font-size: 14px; color: #4b5563;">
          ${data.client_ruc ? `RUC: ${data.client_ruc}<br>` : ''}
          ${data.client_address || ''}<br>
          ${data.client_email || ''}<br>
          ${data.client_phone || ''}
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <table>
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>Descripción</th>
          <th style="width: 80px; text-align: center;">Cant.</th>
          <th style="width: 120px; text-align: right;">P. Unit.</th>
          <th style="width: 80px; text-align: center;">Desc.</th>
          <th style="width: 120px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="totals-table">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${formatCurrency(data.subtotal)}</span>
        </div>
        <div class="totals-row">
          <span>IGV (18%)</span>
          <span>${formatCurrency(data.tax)}</span>
        </div>
        <div class="totals-row total">
          <span>TOTAL</span>
          <span>${formatCurrency(data.total)}</span>
        </div>
      </div>
    </div>

    <!-- Notes -->
    ${data.notes ? `
    <div class="notes">
      <div class="notes-title">Notas</div>
      <div>${data.notes}</div>
    </div>
    ` : ''}

    <!-- Terms -->
    ${data.terms || data.payment_terms ? `
    <div class="terms">
      <strong>Términos y Condiciones:</strong><br>
      ${data.payment_terms ? `Condiciones de pago: ${data.payment_terms}<br>` : ''}
      ${data.terms || 'Esta cotización es válida por 15 días. Los precios no incluyen envío.'}
    </div>
    ` : ''}

    <!-- Signature Area -->
    <div class="signature-area">
      <div class="signature-line">
        ${data.salesperson_name || 'Vendedor'}<br>
        <span style="font-size: 10px; color: #6b7280;">${data.company_name}</span>
      </div>
      <div class="signature-line">
        Cliente<br>
        <span style="font-size: 10px; color: #6b7280;">Firma de aceptación</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      ${data.company_name} | ${data.company_address} | ${data.company_phone} | ${data.company_email}
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Genera HTML para factura (similar pero con datos fiscales)
 */
export function generateInvoiceHTML(data: QuoteData & { 
  invoice_type: 'factura' | 'boleta'
  serie: string
}): string {
  // Similar al quote pero con formato de factura SUNAT
  const baseHTML = generateQuoteHTML(data)
  return baseHTML
    .replace('COTIZACIÓN', data.invoice_type === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA')
    .replace(data.quote_number, `${data.serie}-${data.quote_number}`)
}
