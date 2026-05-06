-- Restore workflow/event emission for authenticated CRM actions without
-- reopening anonymous inserts into webhook_events.

REVOKE INSERT ON TABLE public.webhook_events FROM anon;
GRANT INSERT ON TABLE public.webhook_events TO authenticated;

DROP POLICY IF EXISTS "Service can insert webhook events" ON public.webhook_events;
DROP POLICY IF EXISTS "Authenticated org members can insert webhook events" ON public.webhook_events;

CREATE POLICY "Authenticated org members can insert webhook events"
ON public.webhook_events
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NOT NULL
  AND get_org_role(organization_id) IS NOT NULL
);

COMMENT ON POLICY "Authenticated org members can insert webhook events" ON public.webhook_events
IS 'Allows authenticated CRM users to emit workflow/webhook events only for organizations where they have an active membership.';
