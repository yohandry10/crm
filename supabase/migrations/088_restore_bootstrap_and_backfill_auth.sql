-- =====================================================
-- Restore auth bootstrap triggers and backfill core data
-- =====================================================

-- Align profiles schema with app usage
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Recreate user bootstrap trigger (auth.users -> public.profiles)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW IS NOT NULL THEN
    INSERT INTO profiles (id, email, full_name, avatar_url, created_at, updated_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, CONCAT('missing-', NEW.id::text, '@invalid.local')),
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
      COALESCE(NEW.created_at, NOW()),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
          avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
          updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Recreate organization bootstrap trigger (organizations -> owner membership)
CREATE OR REPLACE FUNCTION handle_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW IS NOT NULL AND NEW.created_by IS NOT NULL THEN
    INSERT INTO organization_members (
      organization_id,
      user_id,
      role,
      is_active,
      invited_by,
      accepted_at,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.created_by,
      'owner'::org_role,
      TRUE,
      NEW.created_by,
      NOW(),
      COALESCE(NEW.created_at, NOW()),
      NOW()
    )
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    UPDATE profiles
    SET current_organization_id = NEW.id,
        updated_at = NOW()
    WHERE id = NEW.created_by
      AND current_organization_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_organization_created ON organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_organization();

-- Backfill profiles for already existing auth users
INSERT INTO profiles (id, email, full_name, avatar_url, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.email, CONCAT('missing-', u.id::text, '@invalid.local')),
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  COALESCE(u.created_at, NOW()),
  NOW()
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill owner memberships for orgs that have created_by but no owner row
INSERT INTO organization_members (
  organization_id,
  user_id,
  role,
  is_active,
  invited_by,
  accepted_at,
  created_at,
  updated_at
)
SELECT
  o.id,
  o.created_by,
  'owner'::org_role,
  TRUE,
  o.created_by,
  COALESCE(o.created_at, NOW()),
  COALESCE(o.created_at, NOW()),
  NOW()
FROM organizations o
LEFT JOIN organization_members om
  ON om.organization_id = o.id
 AND om.user_id = o.created_by
WHERE o.created_by IS NOT NULL
  AND om.id IS NULL;

-- Backfill current organization for profiles with active memberships
WITH first_active_org AS (
  SELECT DISTINCT ON (om.user_id)
    om.user_id,
    om.organization_id
  FROM organization_members om
  WHERE om.is_active = TRUE
  ORDER BY om.user_id, COALESCE(om.accepted_at, om.created_at) ASC
)
UPDATE profiles p
SET current_organization_id = fao.organization_id,
    updated_at = NOW()
FROM first_active_org fao
WHERE p.id = fao.user_id
  AND (p.current_organization_id IS NULL OR p.current_organization_id <> fao.organization_id);
