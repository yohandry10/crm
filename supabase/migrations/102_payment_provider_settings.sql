-- Payment provider settings
-- Active production billing uses Culqi/PagoEfectivo or manual confirmation.

ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS culqi_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pagoefectivo_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE platform_settings
SET
  stripe_enabled = FALSE,
  mercadopago_enabled = FALSE
WHERE id = 1;
