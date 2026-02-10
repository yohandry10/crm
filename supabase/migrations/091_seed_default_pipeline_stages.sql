-- =====================================================
-- Seed default pipeline stages per organization
-- - Makes Pipeline usable immediately after org creation
-- - Avoids relying on API-side "create defaults" logic
-- - Backfills orgs that currently have zero pipeline stages
-- =====================================================

-- Update org bootstrap trigger to also seed default pipeline stages.
CREATE OR REPLACE FUNCTION handle_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Seed default stages if this org has none yet.
  IF NEW IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pipeline_stages
      WHERE organization_id = NEW.id
      LIMIT 1
    ) THEN
      INSERT INTO pipeline_stages (
        organization_id,
        name,
        position,
        win_probability,
        color,
        is_default,
        active
      )
      VALUES
        (NEW.id, 'Prospección', 1, 10,  '#64748b', TRUE,  TRUE),
        (NEW.id, 'Calificación', 2, 25, '#3b82f6', FALSE, TRUE),
        (NEW.id, 'Propuesta', 3, 50,    '#eab308', FALSE, TRUE),
        (NEW.id, 'Negociación', 4, 75,  '#f97316', FALSE, TRUE),
        (NEW.id, 'Ganado', 5, 100,      '#22c55e', FALSE, TRUE),
        (NEW.id, 'Perdido', 6, 0,       '#ef4444', FALSE, TRUE);
    END IF;
  END IF;

  -- Keep existing bootstrap behavior (owner membership + profile org).
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

-- Backfill default stages for organizations with zero pipeline stages.
WITH orgs_without_stages AS (
  SELECT o.id
  FROM organizations o
  WHERE NOT EXISTS (
    SELECT 1 FROM pipeline_stages ps WHERE ps.organization_id = o.id
  )
)
INSERT INTO pipeline_stages (
  organization_id,
  name,
  position,
  win_probability,
  color,
  is_default,
  active
)
SELECT
  o.id,
  s.name,
  s.position,
  s.win_probability,
  s.color,
  s.is_default,
  TRUE
FROM orgs_without_stages o
CROSS JOIN (
  VALUES
    ('Prospección', 1, 10,  '#64748b', TRUE),
    ('Calificación', 2, 25, '#3b82f6', FALSE),
    ('Propuesta', 3, 50,    '#eab308', FALSE),
    ('Negociación', 4, 75,  '#f97316', FALSE),
    ('Ganado', 5, 100,      '#22c55e', FALSE),
    ('Perdido', 6, 0,       '#ef4444', FALSE)
) AS s(name, position, win_probability, color, is_default);

