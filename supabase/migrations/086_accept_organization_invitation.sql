-- =====================================================
-- Accept organization invitations for existing users
-- - Adds accepted_at to organization_invitations (the UI expects it)
-- - Adds SECURITY DEFINER RPC to accept invitation atomically
-- =====================================================

ALTER TABLE organization_invitations
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_org_invitations_token_pending
  ON organization_invitations(token)
  WHERE status = 'pending' AND accepted_at IS NULL;

-- Atomic accept: validates token, inserts membership, marks invitation accepted.
CREATE OR REPLACE FUNCTION accept_organization_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_inv organization_invitations%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User email not found');
  END IF;

  SELECT * INTO v_inv
  FROM organization_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND accepted_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation invalid or expired');
  END IF;

  IF lower(v_inv.email) <> lower(v_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation email mismatch');
  END IF;

  INSERT INTO organization_members (organization_id, user_id, role, is_active, accepted_at)
  VALUES (v_inv.organization_id, v_user_id, v_inv.role, TRUE, NOW())
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = TRUE,
        accepted_at = COALESCE(organization_members.accepted_at, NOW()),
        updated_at = NOW();

  UPDATE organization_invitations
  SET status = 'accepted',
      accepted_at = NOW()
  WHERE id = v_inv.id;

  UPDATE profiles
  SET current_organization_id = v_inv.organization_id,
      updated_at = NOW()
  WHERE id = v_user_id
    AND (current_organization_id IS NULL OR current_organization_id <> v_inv.organization_id);

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_inv.organization_id,
    'role', v_inv.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_organization_invitation(TEXT) TO authenticated;
