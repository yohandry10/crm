-- Atomic public booking
-- Prevents concurrent double booking by serializing public bookings per owner/day
-- and checking overlapping calendar_events inside the same transaction.

CREATE OR REPLACE FUNCTION book_public_calendar_slot(
    p_config_id UUID,
    p_slot_start TIMESTAMPTZ,
    p_name TEXT,
    p_email TEXT,
    p_phone TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_answers JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    event_id UUID,
    contact_id UUID,
    organization_id UUID,
    owner_id UUID,
    booking_name TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_config booking_configs%ROWTYPE;
    v_slot_end TIMESTAMPTZ;
    v_contact_id UUID;
    v_event_id UUID;
    v_allowed_start TIME;
    v_allowed_end TIME;
BEGIN
    IF p_config_id IS NULL OR p_slot_start IS NULL THEN
        RAISE EXCEPTION 'config_id and slot_start are required';
    END IF;

    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION 'Name is required';
    END IF;

    IF p_email IS NULL OR p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
        RAISE EXCEPTION 'Valid email is required';
    END IF;

    SELECT *
    INTO v_config
    FROM booking_configs
    WHERE id = p_config_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Configuración no encontrada' USING ERRCODE = 'P0002';
    END IF;

    v_slot_end := p_slot_start + (v_config.duration * INTERVAL '1 minute');

    IF p_slot_start <= NOW() THEN
        RAISE EXCEPTION 'No se puede reservar un horario pasado';
    END IF;

    IF p_slot_start > NOW() + (COALESCE(v_config.max_advance_days, 30) * INTERVAL '1 day') THEN
        RAISE EXCEPTION 'El horario excede la anticipación máxima permitida';
    END IF;

    IF NOT (EXTRACT(DOW FROM p_slot_start)::INTEGER = ANY(v_config.available_days)) THEN
        RAISE EXCEPTION 'El día seleccionado no está disponible';
    END IF;

    v_allowed_start := COALESCE(v_config.available_hours->>'start', '00:00')::TIME;
    v_allowed_end := COALESCE(v_config.available_hours->>'end', '00:00')::TIME;

    IF p_slot_start::DATE <> v_slot_end::DATE THEN
        RAISE EXCEPTION 'El horario seleccionado no puede cruzar de día';
    END IF;

    IF p_slot_start::TIME < v_allowed_start OR v_slot_end::TIME > v_allowed_end THEN
        RAISE EXCEPTION 'El horario seleccionado está fuera de la ventana disponible';
    END IF;

    -- Serialize bookings for the same owner/day so overlapping slots cannot pass
    -- a read-before-insert race under concurrent public requests.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            v_config.owner_id::TEXT || ':' || date_trunc('day', p_slot_start)::DATE::TEXT,
            0
        )
    );

    IF EXISTS (
        SELECT 1
        FROM calendar_events ce
        WHERE ce.organization_id = v_config.organization_id
          AND ce.owner_id = v_config.owner_id
          AND ce.status <> 'cancelled'
          AND ce.start_time < v_slot_end
          AND ce.end_time > p_slot_start
    ) THEN
        RAISE EXCEPTION 'Este horario ya no está disponible' USING ERRCODE = '40001';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            v_config.organization_id::TEXT || ':contact:' || lower(btrim(p_email)),
            1
        )
    );

    SELECT c.id
    INTO v_contact_id
    FROM contacts c
    WHERE c.organization_id = v_config.organization_id
      AND lower(c.email) = lower(btrim(p_email))
    LIMIT 1;

    IF v_contact_id IS NULL THEN
        INSERT INTO contacts (
            organization_id,
            name,
            email,
            phone,
            source,
            lead_status
        )
        VALUES (
            v_config.organization_id,
            btrim(p_name),
            lower(btrim(p_email)),
            NULLIF(btrim(COALESCE(p_phone, '')), ''),
            'booking',
            'warm'
        )
        RETURNING id INTO v_contact_id;
    END IF;

    INSERT INTO calendar_events (
        organization_id,
        owner_id,
        contact_id,
        title,
        description,
        start_time,
        end_time,
        event_type,
        attendees,
        booking_data
    )
    VALUES (
        v_config.organization_id,
        v_config.owner_id,
        v_contact_id,
        v_config.name || ' - ' || btrim(p_name),
        NULLIF(btrim(COALESCE(p_notes, '')), ''),
        p_slot_start,
        v_slot_end,
        'meeting',
        jsonb_build_array(jsonb_build_object('email', lower(btrim(p_email)), 'name', btrim(p_name))),
        jsonb_build_object(
            'config_id', v_config.id,
            'answers', COALESCE(p_answers, '{}'::jsonb)
        )
    )
    RETURNING id INTO v_event_id;

    RETURN QUERY
    SELECT
        v_event_id,
        v_contact_id,
        v_config.organization_id,
        v_config.owner_id,
        v_config.name,
        p_slot_start,
        v_slot_end;
END;
$$;

REVOKE EXECUTE ON FUNCTION book_public_calendar_slot(UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION book_public_calendar_slot(UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB)
TO service_role;
