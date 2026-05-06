-- Extend RBAC coverage to resources that already exist in the application but
-- previously relied only on tenant RLS or ad hoc route checks.

INSERT INTO role_permissions (
    role,
    resource,
    can_create,
    can_read,
    can_update,
    can_delete,
    can_read_all,
    can_manage_all
)
VALUES
    -- Accounts follow contact/account-management semantics.
    ('owner', 'accounts', true, true, true, true, true, true),
    ('admin', 'accounts', true, true, true, true, true, true),
    ('manager', 'accounts', true, true, true, true, true, true),
    ('member', 'accounts', true, true, true, false, false, false),
    ('viewer', 'accounts', false, true, false, false, true, false),

    -- Activities are customer timeline entries.
    ('owner', 'activities', true, true, true, true, true, true),
    ('admin', 'activities', true, true, true, true, true, true),
    ('manager', 'activities', true, true, true, true, true, true),
    ('member', 'activities', true, true, true, false, false, false),
    ('viewer', 'activities', false, true, false, false, true, false),

    -- Sales orders follow revenue permissions.
    ('owner', 'orders', true, true, true, true, true, true),
    ('admin', 'orders', true, true, true, true, true, true),
    ('manager', 'orders', true, true, true, false, true, false),
    ('member', 'orders', true, true, false, false, false, false),
    ('viewer', 'orders', false, true, false, false, true, false),

    -- Pipeline configuration is an admin/owner responsibility.
    ('owner', 'pipeline_stages', true, true, true, true, true, true),
    ('admin', 'pipeline_stages', true, true, true, true, true, true),
    ('manager', 'pipeline_stages', false, true, false, false, true, false),
    ('member', 'pipeline_stages', false, true, false, false, false, false),
    ('viewer', 'pipeline_stages', false, true, false, false, true, false),

    -- Lead source catalog is shared sales configuration.
    ('owner', 'lead_sources', true, true, true, true, true, true),
    ('admin', 'lead_sources', true, true, true, true, true, true),
    ('manager', 'lead_sources', true, true, true, false, true, false),
    ('member', 'lead_sources', false, true, false, false, false, false),
    ('viewer', 'lead_sources', false, true, false, false, true, false)
ON CONFLICT (role, resource) DO UPDATE SET
    can_create = EXCLUDED.can_create,
    can_read = EXCLUDED.can_read,
    can_update = EXCLUDED.can_update,
    can_delete = EXCLUDED.can_delete,
    can_read_all = EXCLUDED.can_read_all,
    can_manage_all = EXCLUDED.can_manage_all;
