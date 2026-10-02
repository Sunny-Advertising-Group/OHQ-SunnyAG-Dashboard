-- Performance data now comes from Whatagraph, not the Google Sheet.
--
-- load_whatagraph_weeks() is called by the daily Claude routine (and was used for the
-- first load). It receives the weekly totals it summed from Whatagraph, replaces every
-- week from p_from onwards, sets channel status from spend, and records the run in
-- settings.whatagraph_sync for Admin → Performance data.
--
-- Only rows that actually changed are written, so the audit log stays readable.

create or replace function public.load_whatagraph_weeks(p_rows jsonb, p_from date, p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ins int := 0;
  v_del int := 0;
  v_live int := 0;
  v_off int := 0;
  v_latest date;
  v_status jsonb;
begin
  -- report_month / week_label follow the sheet: the month the Sunday falls in, and that
  -- Sunday's position in the month (W1 = 1st–7th). Worked out here if not given.
  create temp table _wg on commit drop as
  select r.market_id, r.channel_id, r.week_start,
         coalesce(r.report_month, date_trunc('month', r.week_start)::date) as report_month,
         coalesce(r.week_label, 'W' || ((extract(day from r.week_start)::int - 1) / 7 + 1)) as week_label,
         r.spend, r.impressions, r.clicks, r.leads, r.sessions
  from jsonb_to_recordset(p_rows) as r(
    market_id text, channel_id text, week_start date, report_month date, week_label text,
    spend numeric, impressions numeric, clicks numeric, leads numeric, sessions numeric);

  if not exists (select 1 from _wg) then
    raise exception 'No rows given';
  end if;
  if exists (select 1 from _wg where week_start < p_from) then
    raise exception 'Row before p_from (%)', p_from;
  end if;
  if extract(dow from p_from) <> 0 or exists (select 1 from _wg where extract(dow from week_start) <> 0) then
    raise exception 'Weeks must start on a Sunday';
  end if;
  if exists (select 1 from _wg w where not exists (select 1 from market_channels mc
             where mc.market_id = w.market_id and mc.channel_id = w.channel_id)) then
    raise exception 'Unknown market or channel in rows';
  end if;

  -- Weeks in range that Whatagraph no longer reports (e.g. a source with no activity).
  delete from perf_weekly p
  where p.week_start >= p_from
    and not exists (select 1 from _wg w
                    where w.market_id = p.market_id and w.channel_id = p.channel_id and w.week_start = p.week_start);
  get diagnostics v_del = row_count;

  insert into perf_weekly as p (market_id, channel_id, week_start, report_month, week_label,
                               spend, impressions, clicks, leads, sessions, sheet_ctr, source_file, imported_at)
  select market_id, channel_id, week_start, report_month, week_label,
         spend, impressions, clicks, leads, sessions, null, 'Whatagraph', now()
  from _wg
  on conflict (market_id, channel_id, week_start) do update set
    report_month = excluded.report_month,
    week_label = excluded.week_label,
    spend = excluded.spend,
    impressions = excluded.impressions,
    clicks = excluded.clicks,
    leads = excluded.leads,
    sessions = excluded.sessions,
    sheet_ctr = null,
    source_file = excluded.source_file,
    imported_at = excluded.imported_at
  where (p.report_month, p.week_label, p.spend, p.impressions, p.clicks, p.leads, p.sessions, p.source_file)
        is distinct from
        (excluded.report_month, excluded.week_label, excluded.spend, excluded.impressions, excluded.clicks,
         excluded.leads, excluded.sessions, excluded.source_file);
  get diagnostics v_ins = row_count;

  -- Status: a channel is live if it had spend (organic: sessions) in the last four weeks of data.
  -- Anything without it that was marked live becomes not live. Paused / planned / awaiting set by
  -- an editor are left alone unless the channel is spending again.
  select max(week_start) into v_latest from _wg;
  with recent as (
    select market_id, channel_id
    from _wg
    where week_start > v_latest - 28
    group by market_id, channel_id
    having coalesce(sum(spend), 0) > 0 or (channel_id = 'organic' and coalesce(sum(sessions), 0) > 0)
  )
  update market_channels mc set status = 'live'
  from recent r
  where mc.market_id = r.market_id and mc.channel_id = r.channel_id and mc.status <> 'live';
  get diagnostics v_live = row_count;

  with recent as (
    select market_id, channel_id
    from _wg
    where week_start > v_latest - 28
    group by market_id, channel_id
    having coalesce(sum(spend), 0) > 0 or (channel_id = 'organic' and coalesce(sum(sessions), 0) > 0)
  )
  update market_channels mc set status = 'not_live'
  where mc.status = 'live'
    and not exists (select 1 from recent r where r.market_id = mc.market_id and r.channel_id = mc.channel_id);
  get diagnostics v_off = row_count;

  v_status := jsonb_build_object(
    'at', now(),
    'ok', true,
    'from', p_from,
    'latest_week', v_latest,
    'rows', (select count(*) from _wg),
    'changed', v_ins,
    'removed', v_del,
    'marked_live', v_live,
    'marked_not_live', v_off,
    'note', p_note
  );
  insert into settings (key, value) values ('whatagraph_sync', v_status::text)
  on conflict (key) do update set value = excluded.value;
  return v_status;
end;
$$;

revoke all on function public.load_whatagraph_weeks(jsonb, date, text) from public, anon, authenticated;

-- A failed routine run records why, so Admin can show it.
create or replace function public.whatagraph_sync_failed(p_message text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into settings (key, value)
  values ('whatagraph_sync', jsonb_build_object('at', now(), 'ok', false, 'message', p_message)::text)
  on conflict (key) do update set value = excluded.value;
$$;

revoke all on function public.whatagraph_sync_failed(text) from public, anon, authenticated;
