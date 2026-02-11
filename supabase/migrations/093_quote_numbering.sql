-- =====================================================
-- Quote numbering (non-breaking)
-- - Generates quote_number automatically on INSERT
-- - Backfills existing quotes missing quote_number
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;

CREATE OR REPLACE FUNCTION set_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number :=
      'COT-' ||
      TO_CHAR(NOW(), 'YYYYMMDD') ||
      '-' ||
      LPAD(NEXTVAL('quote_number_seq')::TEXT, 5, '0');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_quote_number ON quotes;
CREATE TRIGGER trg_set_quote_number
BEFORE INSERT ON quotes
FOR EACH ROW
EXECUTE FUNCTION set_quote_number();

-- Backfill any existing quotes without a number.
UPDATE quotes
SET quote_number =
  'COT-' ||
  TO_CHAR(COALESCE(created_at, NOW()), 'YYYYMMDD') ||
  '-' ||
  LPAD(NEXTVAL('quote_number_seq')::TEXT, 5, '0')
WHERE quote_number IS NULL OR quote_number = '';

CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON quotes(quote_number);

