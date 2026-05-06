-- Public payment token hardening
-- Forces payment links to be created through generate_payment_token() and
-- prevents direct authenticated clients from inserting or deleting token rows.

ALTER TABLE public_payment_tokens
    DROP CONSTRAINT IF EXISTS check_quote_or_invoice;

ALTER TABLE public_payment_tokens
    ADD CONSTRAINT check_quote_or_invoice
    CHECK (
        (quote_id IS NOT NULL AND invoice_id IS NULL)
        OR (quote_id IS NULL AND invoice_id IS NOT NULL)
    ) NOT VALID;

DROP POLICY IF EXISTS "Org members can manage payment tokens" ON public_payment_tokens;

CREATE POLICY "Org members can read payment tokens"
ON public_payment_tokens
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = public_payment_tokens.organization_id
          AND om.is_active = TRUE
    )
);

CREATE POLICY "Org members can deactivate payment tokens"
ON public_payment_tokens
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = public_payment_tokens.organization_id
          AND om.is_active = TRUE
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = public_payment_tokens.organization_id
          AND om.is_active = TRUE
    )
);

REVOKE ALL ON public_payment_tokens FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public_payment_tokens FROM authenticated;
GRANT SELECT ON public_payment_tokens TO authenticated;
GRANT UPDATE (is_active) ON public_payment_tokens TO authenticated;

REVOKE EXECUTE ON FUNCTION generate_payment_token(UUID, UUID, UUID, INTEGER)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_payment_token(UUID, UUID, UUID, INTEGER)
TO authenticated;
