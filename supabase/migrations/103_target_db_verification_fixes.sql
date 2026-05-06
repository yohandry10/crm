-- Target DB verification fixes
-- Aligns existing Supabase projects with the production readiness contract.

REVOKE ALL ON TABLE organizations_decrypted FROM PUBLIC, anon, authenticated;

ALTER TABLE public_payment_tokens
  DROP CONSTRAINT IF EXISTS public_payment_tokens_single_resource_check;

ALTER TABLE public_payment_tokens
  ADD CONSTRAINT public_payment_tokens_single_resource_check
  CHECK (
    (quote_id IS NOT NULL AND invoice_id IS NULL)
    OR (quote_id IS NULL AND invoice_id IS NOT NULL)
  ) NOT VALID;
