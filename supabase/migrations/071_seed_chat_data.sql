-- DUMMY DATA FOR OMNICHANNEL INBOX
-- Checks for an organization and inserts data strictly linked to it.

DO $$
DECLARE
    v_org_id UUID;
    v_start_time TIMESTAMP;
    v_channel_id UUID;
    v_contact_id UUID;
    v_conversation_id UUID;
BEGIN
    -- 1. Pick the first organization found (fallback for dev)
    SELECT id INTO v_org_id FROM organizations LIMIT 1;
    
    IF v_org_id IS NULL THEN
        RAISE NOTICE 'No organization found to seed data.';
        RETURN;
    END IF;

    -- 2. Create a Channel (WhatsApp)
    INSERT INTO channels (organization_id, name, type, identifier, is_active)
    VALUES (v_org_id, 'WhatsApp Principal', 'whatsapp', '+51999999999', true)
    RETURNING id INTO v_channel_id;

    -- 3. Ensure a Contact exists
    INSERT INTO contacts (organization_id, name, email, phone, lead_status, source)
    VALUES (v_org_id, 'Juan Pérez Demostración', 'juan.perez@demo.com', '+51987654321', 'cold', 'facebook')
    ON CONFLICT DO NOTHING; -- Assuming name/email constraints might exist, or just insert new ones
    
    -- Fetch the contact ID (in case of conflict or insert)
    SELECT id INTO v_contact_id FROM contacts WHERE email = 'juan.perez@demo.com' LIMIT 1;

    -- 4. Create a Conversation
    INSERT INTO conversations (organization_id, channel_id, contact_id, status, subject, created_at, last_message_at)
    VALUES (v_org_id, v_channel_id, v_contact_id, 'open', 'Consulta de Precios', NOW() - INTERVAL '1 hour', NOW())
    RETURNING id INTO v_conversation_id;

    -- 5. Insert Messages
    -- Message 1: Inbound (Customer)
    INSERT INTO messages (organization_id, conversation_id, direction, content, status, created_at)
    VALUES (v_org_id, v_conversation_id, 'inbound', 'Hola, buenas tardes. Vi su anuncio en Facebook y me interesa saber más.', 'read', NOW() - INTERVAL '1 hour');

    -- Message 2: Outbound (Agent)
    INSERT INTO messages (organization_id, conversation_id, direction, content, status, created_at)
    VALUES (v_org_id, v_conversation_id, 'outbound', '¡Hola Juan! 👋 Bienvenido. Claro que sí, ¿en qué producto estás interesado específicamente?', 'read', NOW() - INTERVAL '55 minutes');

    -- Message 3: Inbound (Customer)
    INSERT INTO messages (organization_id, conversation_id, direction, content, status, created_at)
    VALUES (v_org_id, v_conversation_id, 'inbound', 'Me interesa el plan Corporativo que ofrecen.', 'read', NOW() - INTERVAL '30 minutes');

    RAISE NOTICE 'Seeded chat data for Org ID: %', v_org_id;
END $$;
