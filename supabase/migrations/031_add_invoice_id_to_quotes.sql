-- Add invoice_id to quotes for conversion tracking
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_invoice ON quotes(invoice_id);
