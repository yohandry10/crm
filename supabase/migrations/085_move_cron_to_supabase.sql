  -- =====================================================
  -- MIGRATION: Move cron schedules from Vercel to Supabase
  -- Notes:
  -- - Uses pg_cron for SQL maintenance jobs.
  -- - Uses pg_net to call /api/cron/process-events (Node logic).
  -- - Configure private.app_settings keys:
  --     cron_base_url = https://your-domain (no trailing slash)
  --     cron_secret   = same value as CRON_SECRET in the app
  -- =====================================================

  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  -- SQL-only maintenance jobs
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-cache') THEN
      PERFORM cron.schedule('cleanup-cache', '0 3 * * *', 'SELECT cleanup_analytics_cache();');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-analytics-cache') THEN
      PERFORM cron.schedule('cleanup-analytics-cache', '30 4 * * *', 'SELECT cleanup_analytics_cache_ttl(30);');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-quotes') THEN
      PERFORM cron.schedule('expire-quotes', '0 0 * * *', 'SELECT expire_old_quotes();');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-auditoria') THEN
      PERFORM cron.schedule('cleanup-auditoria', '0 4 * * *', 'SELECT cleanup_auditoria(90);');
    END IF;
  END $$;

  -- HTTP cron for webhook processing (requires base URL + secret)
  DO $$
  DECLARE
    v_base_url TEXT;
    v_secret TEXT;
    v_sql TEXT;
  BEGIN
    SELECT value INTO v_base_url FROM private.app_settings WHERE key = 'cron_base_url';
    SELECT value INTO v_secret FROM private.app_settings WHERE key = 'cron_secret';

    IF v_base_url IS NULL OR v_secret IS NULL THEN
      RAISE NOTICE 'Skipping process-webhook-events schedule: set private.app_settings cron_base_url and cron_secret';
      RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-webhook-events') THEN
      v_sql := format(
        'SELECT net.http_post(url := %L, headers := jsonb_build_object(''authorization'', %L), body := ''{}''::jsonb);',
        v_base_url || '/api/cron/process-events',
        'Bearer ' || v_secret
      );
      PERFORM cron.schedule('process-webhook-events', '*/5 * * * *', v_sql);
    END IF;
  END $$;
