-- Marca el usuario owner como platform admin
UPDATE profiles
SET is_platform_admin = true
WHERE id = 'f700987a-2bef-4928-b78f-48446a50d1e1';
