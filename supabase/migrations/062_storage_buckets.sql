-- =====================================================
-- MIGRATION: Create Storage Buckets for Organization Assets and Payment Proofs
-- =====================================================

-- Note: Storage buckets are typically created via Supabase Dashboard or CLI
-- This SQL creates the RLS policies for the buckets once they are created

-- 1. Create buckets (run this in Supabase SQL Editor or use Dashboard)
-- These commands only work if storage.buckets table exists and is accessible

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'organization-assets',
    'organization-assets',
    true,  -- Public bucket for logos and QR codes
    5242880,  -- 5MB limit
    ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'payment-proofs',
    'payment-proofs',
    false,  -- Private bucket for payment screenshots
    10485760,  -- 10MB limit
    ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- 2. RLS Policies for organization-assets (public read, authenticated write)

-- Anyone can view organization assets (logos, QR codes)
CREATE POLICY "Public read organization assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'organization-assets');

-- Only authenticated users can upload to their org folder
CREATE POLICY "Authenticated users can upload organization assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'organization-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own uploads
CREATE POLICY "Users can update own organization assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'organization-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own uploads
CREATE POLICY "Users can delete own organization assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'organization-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. RLS Policies for payment-proofs (private)

-- Only org members can view payment proofs
CREATE POLICY "Org members can view payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'payment-proofs' AND
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
);

-- Authenticated users can upload payment proofs to their org folder
CREATE POLICY "Users can upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'payment-proofs' AND
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
);

-- Users can delete payment proofs in their org
CREATE POLICY "Users can delete payment proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'payment-proofs' AND
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
);
