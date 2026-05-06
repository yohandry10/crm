-- Performance hardening for tenant-heavy list endpoints and dashboard metrics.

create index if not exists idx_org_members_user_org_active
  on public.organization_members (user_id, organization_id)
  where is_active = true;

create index if not exists idx_org_members_org_user_active
  on public.organization_members (organization_id, user_id)
  where is_active = true;

create index if not exists idx_opportunities_org_created
  on public.opportunities (organization_id, created_at desc);

create index if not exists idx_opportunities_org_stage_created
  on public.opportunities (organization_id, stage_id, created_at desc);

create index if not exists idx_opportunities_org_status_created
  on public.opportunities (organization_id, status, created_at desc);

create index if not exists idx_invoices_org_issue_created
  on public.invoices (organization_id, issue_date desc, created_at desc);

create index if not exists idx_invoices_org_status_issue_created
  on public.invoices (organization_id, status, issue_date desc, created_at desc);

create index if not exists idx_products_org_created
  on public.products (organization_id, created_at desc);

create index if not exists idx_products_org_service_created
  on public.products (organization_id, is_service, created_at desc);

create index if not exists idx_tasks_org_due_created
  on public.tasks (organization_id, due_date asc nulls last, created_at desc);

create index if not exists idx_tickets_org_created
  on public.tickets (organization_id, created_at desc);

create index if not exists idx_calendar_events_org_start_end
  on public.calendar_events (organization_id, start_time, end_time);

create index if not exists idx_contacts_org_lead_created
  on public.contacts (organization_id, created_at desc)
  where lead_status is not null;

create index if not exists idx_products_name_trgm
  on public.products using gin (name gin_trgm_ops);

create index if not exists idx_opportunities_name_trgm
  on public.opportunities using gin (name gin_trgm_ops);

create index if not exists idx_tickets_title_trgm
  on public.tickets using gin (title gin_trgm_ops);

create or replace function public.get_dashboard_metrics(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text := 'America/Lima';
  v_now timestamptz := now();
  v_today date;
  v_this_month_start date;
  v_next_month_start date;
  v_last_month_start date;
  v_last_30_start date;
  v_this_month_start_utc timestamptz;
  v_next_month_start_utc timestamptz;
  v_last_month_start_utc timestamptz;
  v_last_30_start_utc timestamptz;
  v_tomorrow_start_utc timestamptz;
  v_contacts_total integer := 0;
  v_contacts_this_month integer := 0;
  v_contacts_last_month integer := 0;
  v_inventory_total integer := 0;
  v_invoice_count_this_month integer := 0;
  v_sales_this_month numeric := 0;
  v_sales_last_month numeric := 0;
  v_activity jsonb := '[]'::jsonb;
  v_pipeline jsonb := '[]'::jsonb;
  v_recent_invoices jsonb := '[]'::jsonb;
begin
  if v_user_id is null and current_setting('role', true) <> 'service_role' then
    raise exception 'Authentication required';
  end if;

  if current_setting('role', true) <> 'service_role' and not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = v_user_id
      and om.is_active = true
  ) then
    raise exception 'Not authorized for organization %', p_organization_id;
  end if;

  select coalesce(nullif(o.timezone, ''), 'America/Lima')
    into v_timezone
  from public.organizations o
  where o.id = p_organization_id;

  v_timezone := coalesce(v_timezone, 'America/Lima');
  v_today := (v_now at time zone v_timezone)::date;
  v_this_month_start := date_trunc('month', v_today)::date;
  v_next_month_start := (v_this_month_start + interval '1 month')::date;
  v_last_month_start := (v_this_month_start - interval '1 month')::date;
  v_last_30_start := v_today - 29;
  v_this_month_start_utc := v_this_month_start::timestamp at time zone v_timezone;
  v_next_month_start_utc := v_next_month_start::timestamp at time zone v_timezone;
  v_last_month_start_utc := v_last_month_start::timestamp at time zone v_timezone;
  v_last_30_start_utc := v_last_30_start::timestamp at time zone v_timezone;
  v_tomorrow_start_utc := (v_today + 1)::timestamp at time zone v_timezone;

  select count(*)::integer
    into v_contacts_total
  from public.contacts c
  where c.organization_id = p_organization_id;

  select count(*)::integer
    into v_contacts_this_month
  from public.contacts c
  where c.organization_id = p_organization_id
    and c.created_at >= v_this_month_start_utc
    and c.created_at < v_next_month_start_utc;

  select count(*)::integer
    into v_contacts_last_month
  from public.contacts c
  where c.organization_id = p_organization_id
    and c.created_at >= v_last_month_start_utc
    and c.created_at < v_this_month_start_utc;

  select count(*)::integer
    into v_inventory_total
  from public.products p
  where p.organization_id = p_organization_id
    and p.is_service = false;

  select
    count(*)::integer,
    coalesce(sum(i.total), 0)
    into v_invoice_count_this_month, v_sales_this_month
  from public.invoices i
  where i.organization_id = p_organization_id
    and i.issue_date >= v_this_month_start
    and i.issue_date < v_next_month_start
    and i.status in ('paid', 'sent');

  select coalesce(sum(i.total), 0)
    into v_sales_last_month
  from public.invoices i
  where i.organization_id = p_organization_id
    and i.issue_date >= v_last_month_start
    and i.issue_date < v_this_month_start
    and i.status in ('paid', 'sent');

  with days as (
    select generate_series(v_last_30_start, v_today, interval '1 day')::date as day
  ),
  lead_counts as (
    select (c.created_at at time zone v_timezone)::date as day, count(*)::integer as leads
    from public.contacts c
    where c.organization_id = p_organization_id
      and c.lead_status is not null
      and c.created_at >= v_last_30_start_utc
      and c.created_at < v_tomorrow_start_utc
    group by 1
  ),
  deal_counts as (
    select (o.created_at at time zone v_timezone)::date as day, count(*)::integer as deals
    from public.opportunities o
    where o.organization_id = p_organization_id
      and o.created_at >= v_last_30_start_utc
      and o.created_at < v_tomorrow_start_utc
    group by 1
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', d.day::text,
      'leads', coalesce(l.leads, 0),
      'deals', coalesce(dc.deals, 0)
    )
    order by d.day
  ), '[]'::jsonb)
    into v_activity
  from days d
  left join lead_counts l on l.day = d.day
  left join deal_counts dc on dc.day = d.day;

  with stage_totals as (
    select
      ps.id,
      ps.name,
      ps.position,
      coalesce(sum(o.expected_revenue), 0) as value,
      count(o.id)::integer as count
    from public.pipeline_stages ps
    left join public.opportunities o
      on o.stage_id = ps.id
      and o.organization_id = ps.organization_id
    where ps.organization_id = p_organization_id
      and coalesce(ps.active, true) = true
    group by ps.id, ps.name, ps.position
  )
  select coalesce(jsonb_agg(
    jsonb_build_object('stage', name, 'value', value, 'count', count)
    order by position
  ), '[]'::jsonb)
    into v_pipeline
  from stage_totals;

  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
    into v_recent_invoices
  from (
    select invoice_number, total, status, issue_date
    from public.invoices i
    where i.organization_id = p_organization_id
    order by issue_date desc, created_at desc
    limit 5
  ) row_data;

  return jsonb_build_object(
    'timezone', v_timezone,
    'stats', jsonb_build_array(
      jsonb_build_object(
        'title', 'Contactos Totales',
        'value', v_contacts_total::text,
        'change', (case when v_contacts_last_month > 0 then
          concat(case when (v_contacts_this_month - v_contacts_last_month) >= 0 then '+' else '' end,
            round((((v_contacts_this_month - v_contacts_last_month)::numeric / v_contacts_last_month) * 100), 1)::text,
            '%')
          else '+0.0%' end),
        'changeType', case when (v_contacts_this_month - v_contacts_last_month) >= 0 then 'positive' else 'negative' end,
        'icon', 'Users'
      ),
      jsonb_build_object(
        'title', 'Ventas del Mes',
        'value', concat('S/ ', to_char(v_sales_this_month, 'FM999G999G999G990D00')),
        'change', (case when v_sales_last_month > 0 then
          concat(case when (v_sales_this_month - v_sales_last_month) >= 0 then '+' else '' end,
            round((((v_sales_this_month - v_sales_last_month) / v_sales_last_month) * 100), 1)::text,
            '%')
          else '+0.0%' end),
        'changeType', case when (v_sales_this_month - v_sales_last_month) >= 0 then 'positive' else 'negative' end,
        'icon', 'DollarSign'
      ),
      jsonb_build_object(
        'title', 'Inventario Total',
        'value', v_inventory_total::text,
        'change', 'Items',
        'changeType', 'neutral',
        'icon', 'Package'
      ),
      jsonb_build_object(
        'title', 'Facturas Generadas',
        'value', v_invoice_count_this_month::text,
        'change', concat(v_invoice_count_this_month::text, ' este mes'),
        'changeType', 'positive',
        'icon', 'FileText'
      )
    ),
    'activityOverview', v_activity,
    'pipeline', v_pipeline,
    'recentInvoices', v_recent_invoices
  );
end;
$$;

revoke all on function public.get_dashboard_metrics(uuid) from public, anon;
grant execute on function public.get_dashboard_metrics(uuid) to authenticated, service_role;

create or replace function public.verify_performance_indexes()
returns table(check_name text, pass boolean, details text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('role', true) <> 'service_role' then
    raise exception 'verify_performance_indexes requires service_role';
  end if;

  return query
  with required_indexes(index_name) as (
    values
      ('idx_org_members_user_org_active'),
      ('idx_org_members_org_user_active'),
      ('idx_opportunities_org_created'),
      ('idx_opportunities_org_stage_created'),
      ('idx_opportunities_org_status_created'),
      ('idx_invoices_org_issue_created'),
      ('idx_invoices_org_status_issue_created'),
      ('idx_products_org_created'),
      ('idx_products_org_service_created'),
      ('idx_tasks_org_due_created'),
      ('idx_tickets_org_created'),
      ('idx_calendar_events_org_start_end'),
      ('idx_contacts_org_lead_created'),
      ('idx_products_name_trgm'),
      ('idx_opportunities_name_trgm'),
      ('idx_tickets_title_trgm')
  )
  select
    'performance_index:' || r.index_name,
    to_regclass('public.' || r.index_name) is not null,
    case when to_regclass('public.' || r.index_name) is null then 'missing index' else null end
  from required_indexes r;

  return query
  select
    'dashboard_metrics_rpc'::text,
    to_regprocedure('public.get_dashboard_metrics(uuid)') is not null,
    case when to_regprocedure('public.get_dashboard_metrics(uuid)') is null then 'missing RPC' else null end;
end;
$$;

revoke all on function public.verify_performance_indexes() from public, anon, authenticated;
grant execute on function public.verify_performance_indexes() to service_role;
