-- Add explicit role permissions for manual payment operations.
-- Payments are not a standalone navigation module, but they mutate invoice
-- state and must be governed consistently with billing permissions.

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
    ('owner', 'payments', true, true, true, true, true, true),
    ('admin', 'payments', true, true, true, true, true, true),
    ('manager', 'payments', true, true, true, false, true, false),
    ('member', 'payments', false, true, false, false, false, false),
    ('viewer', 'payments', false, true, false, false, true, false)
ON CONFLICT (role, resource) DO UPDATE SET
    can_create = EXCLUDED.can_create,
    can_read = EXCLUDED.can_read,
    can_update = EXCLUDED.can_update,
    can_delete = EXCLUDED.can_delete,
    can_read_all = EXCLUDED.can_read_all,
    can_manage_all = EXCLUDED.can_manage_all;
