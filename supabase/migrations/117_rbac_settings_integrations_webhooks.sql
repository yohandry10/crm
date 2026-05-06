-- Align settings, integrations and webhooks with the central RBAC matrix.

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
    -- Integrations can contain operational credentials, so only owner/admin manage them.
    ('owner', 'integrations', true, true, true, true, true, true),
    ('admin', 'integrations', true, true, true, true, true, true),
    ('manager', 'integrations', false, true, false, false, true, false),
    ('member', 'integrations', false, false, false, false, false, false),
    ('viewer', 'integrations', false, true, false, false, true, false),

    -- Webhook configuration controls outbound data flows.
    ('owner', 'webhooks', true, true, true, true, true, true),
    ('admin', 'webhooks', true, true, true, true, true, true),
    ('manager', 'webhooks', false, true, false, false, true, false),
    ('member', 'webhooks', false, false, false, false, false, false),
    ('viewer', 'webhooks', false, true, false, false, true, false)
ON CONFLICT (role, resource) DO UPDATE SET
    can_create = EXCLUDED.can_create,
    can_read = EXCLUDED.can_read,
    can_update = EXCLUDED.can_update,
    can_delete = EXCLUDED.can_delete,
    can_read_all = EXCLUDED.can_read_all,
    can_manage_all = EXCLUDED.can_manage_all;
