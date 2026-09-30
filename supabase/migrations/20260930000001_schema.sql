-- OfficeHQ client media portal: schema, roles, RLS, triggers, audit, storage.
-- The project was created with "Automatically expose new tables" OFF, so every
-- table below is granted to `authenticated` explicitly. `anon` gets nothing.

-- ---------------------------------------------------------------------------
-- Profiles & roles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  org text not null default '',
  role text not null default 'viewer' check (role in ('viewer', 'editor', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Role helpers. security definer so policies can read profiles without
-- recursing into profiles' own RLS.
create function public.current_app_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid())
$$;

create function public.is_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('editor', 'admin') from public.profiles where id = auth.uid()), false)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- Every new auth user gets a viewer profile. Admins then set name/org/role
-- from Admin → Users (via the service role), never from user metadata.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, lower(new.email), split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Content tables
-- ---------------------------------------------------------------------------
create table public.markets (
  id text primary key check (id in ('au', 'nz', 'uk', 'us')),
  code text not null,
  name text not null,
  country text not null,
  currency text not null check (currency in ('AUD', 'NZD', 'GBP', 'USD')),
  tz text not null,
  tz_label text not null,
  note text not null default '',
  commentary text not null default '',
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.channels (
  id text primary key check (id in ('google', 'meta', 'linkedin', 'programmatic', 'microsoft', 'chatgpt', 'organic')),
  name text not null,
  hex text not null,
  sort int not null default 0
);

create table public.market_channels (
  market_id text not null references public.markets (id) on delete cascade,
  channel_id text not null references public.channels (id) on delete cascade,
  status text not null default 'not_live' check (status in ('live', 'paused', 'planned', 'not_live', 'awaiting')),
  whatagraph_url text not null default '',
  embed boolean not null default false,
  -- Result of the X-Frame-Options / CSP check run when the link is saved.
  -- null = not checked yet, false = Whatagraph refuses framing (toggle hidden).
  embed_allowed boolean,
  notes text not null default '',
  objective text not null default '',
  audiences text not null default '',
  locations text not null default '',
  keywords text not null default '',
  exclusions text not null default '',
  bidding text not null default '',
  schedule text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (market_id, channel_id)
);

create table public.creatives (
  id uuid primary key default gen_random_uuid(),
  market_id text not null references public.markets (id) on delete cascade,
  channel_id text not null references public.channels (id) on delete cascade,
  name text not null default '',
  funnel_stage text not null default '',
  vertical text not null default '',
  message text not null default '',
  cta text not null default '',
  asset_url text not null default '',
  asset_path text,
  status text not null default 'Live' check (status in ('Live', 'Scheduled', 'Paused')),
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
create index creatives_market_channel_idx on public.creatives (market_id, channel_id, sort);

create table public.links (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  description text not null default '',
  url text not null default '',
  icon text not null default 'link',
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.changes (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  market_id text references public.markets (id) on delete cascade,   -- null = all markets
  channel_id text references public.channels (id) on delete cascade, -- null = all channels
  type text not null check (type in ('Creative', 'Budget', 'Targeting', 'Test', 'Tracking', 'Other')),
  text text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index changes_date_idx on public.changes (date desc);

create table public.tracker_rows (
  id uuid primary key default gen_random_uuid(),
  funnel_stage text not null,
  generic text not null default '',
  legal text not null default '',
  finance text not null default '',
  real_estate text not null default '',
  cta text not null default '',
  url text not null default '',
  asset_url text not null default '',
  shared boolean not null default false,
  approval text not null default 'Not started'
    check (approval in ('Not started', 'Awaiting approval', 'Changes requested', 'Approved')),
  live_status text not null default 'Not live' check (live_status in ('Not live', 'Scheduled', 'Live', 'Paused')),
  feedback text not null default '',
  feedback_by uuid references auth.users (id) on delete set null,
  feedback_at timestamptz,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.team (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  role text not null default '',
  focus text not null default '',
  email text not null default '',
  phone text not null default '',
  escalation boolean not null default false,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Performance data
-- ---------------------------------------------------------------------------
-- Raw measures only. Ratios (CTR, CPC, CPL, click→lead) are always recomputed
-- from these totals in the app. Blank cells are stored as null, never 0.
create table public.perf_weekly (
  market_id text not null references public.markets (id) on delete cascade,
  channel_id text not null references public.channels (id) on delete cascade,
  week_start date not null,
  -- The sheet assigns each week column to a month (e.g. w/c 30 Aug is August W5).
  report_month date not null,
  week_label text not null default '',
  spend numeric,
  impressions numeric,
  clicks numeric,
  leads numeric,
  sessions numeric,
  -- The sheet's weekly CTR, kept ONLY to estimate clicks when the clicks cell
  -- is blank (shown with a * flag). Never displayed or summed as a ratio.
  sheet_ctr numeric,
  source_file text not null default '',
  imported_at timestamptz not null default now(),
  primary key (market_id, channel_id, week_start)
);

create table public.perf_topline (
  month date primary key,
  budget_aud numeric,
  spend_aud numeric,
  spend_pct numeric,
  lead_target numeric,
  leads_actual numeric,
  leads_yoy_pct numeric,
  updated_at timestamptz not null default now()
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  weeks_imported int not null default 0,
  imported_by uuid references auth.users (id) on delete set null,
  imported_at timestamptz not null default now(),
  warnings jsonb not null default '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  table_name text not null,
  op text not null,
  row_key text,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index audit_log_at_idx on public.audit_log (at desc);

create function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  b jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  a jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  k text;
begin
  if tg_op = 'UPDATE' and (b - 'updated_at' - 'imported_at') = (a - 'updated_at' - 'imported_at') then
    return new; -- no real change
  end if;
  k := coalesce(a, b) ->> 'id';
  if k is null then
    k := concat_ws(':', coalesce(a, b) ->> 'market_id', coalesce(a, b) ->> 'channel_id',
                   coalesce(a, b) ->> 'week_start', coalesce(a, b) ->> 'month', coalesce(a, b) ->> 'key');
  end if;
  insert into public.audit_log (actor, table_name, op, row_key, before, after)
  values (auth.uid(), tg_table_name, tg_op, k, b, a);
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- updated_at / updated_by triggers
-- ---------------------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.touch_updated_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'markets', 'market_channels', 'creatives', 'links', 'changes',
                           'tracker_rows', 'team', 'settings', 'perf_topline'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
                   t || '_touch', t);
  end loop;
  foreach t in array array['profiles', 'markets', 'channels', 'market_channels', 'creatives', 'links', 'changes',
                           'tracker_rows', 'team', 'settings', 'perf_weekly', 'perf_topline', 'imports'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
                   t || '_audit', t);
  end loop;
end;
$$;

create trigger market_channels_touch_by before insert or update on public.market_channels
  for each row execute function public.touch_updated_by();

-- ---------------------------------------------------------------------------
-- Grants & RLS
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;

grant select, insert, update, delete on
  public.markets, public.channels, public.market_channels, public.creatives, public.links,
  public.changes, public.tracker_rows, public.team, public.settings, public.perf_weekly,
  public.perf_topline, public.imports
to authenticated;
grant select, update, delete on public.profiles to authenticated;
grant select on public.audit_log to authenticated;

alter table public.profiles enable row level security;
alter table public.markets enable row level security;
alter table public.channels enable row level security;
alter table public.market_channels enable row level security;
alter table public.creatives enable row level security;
alter table public.links enable row level security;
alter table public.changes enable row level security;
alter table public.tracker_rows enable row level security;
alter table public.team enable row level security;
alter table public.settings enable row level security;
alter table public.perf_weekly enable row level security;
alter table public.perf_topline enable row level security;
alter table public.imports enable row level security;
alter table public.audit_log enable row level security;

-- Profiles: members can see who has access; only admins change roles or remove.
create policy profiles_select on public.profiles for select to authenticated using (public.is_member());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated using (public.is_admin());

-- Content: read for any profile, write for editors and admins.
do $$
declare t text;
begin
  foreach t in array array['markets', 'channels', 'market_channels', 'creatives', 'links', 'changes',
                           'tracker_rows', 'team', 'settings', 'perf_weekly', 'perf_topline'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_editor())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_editor()) with check (public.is_editor())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_editor())', t || '_delete', t);
  end loop;
end;
$$;

-- Imports and the audit log are Sunny-only.
create policy imports_select on public.imports for select to authenticated using (public.is_editor());
create policy imports_insert on public.imports for insert to authenticated with check (public.is_editor());
create policy imports_update on public.imports for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy imports_delete on public.imports for delete to authenticated using (public.is_editor());
create policy audit_log_select on public.audit_log for select to authenticated using (public.is_editor());

-- ---------------------------------------------------------------------------
-- Viewer approvals on the creative tracker
-- ---------------------------------------------------------------------------
-- Viewers have no UPDATE policy on tracker_rows. The only thing they can
-- change is approval + feedback, only from 'Awaiting approval', and only to
-- 'Approved' or 'Changes requested'. Approve also writes a "What's changed" entry.
create function public.respond_to_tracker(p_row uuid, p_decision text, p_note text default '')
returns public.tracker_rows
language plpgsql security definer set search_path = '' as $$
declare
  r public.tracker_rows;
  who text;
begin
  if not public.is_member() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_decision not in ('Approved', 'Changes requested') then
    raise exception 'Invalid decision';
  end if;
  if p_decision = 'Changes requested' and coalesce(btrim(p_note), '') = '' then
    raise exception 'Tell the team what you would like changed';
  end if;

  select * into r from public.tracker_rows where id = p_row for update;
  if not found then
    raise exception 'Row not found';
  end if;
  if r.approval <> 'Awaiting approval' then
    raise exception 'This row is no longer awaiting approval';
  end if;

  select coalesce(nullif(name, ''), email) into who from public.profiles where id = auth.uid();

  update public.tracker_rows
     set approval = p_decision,
         feedback = case when p_decision = 'Changes requested' then btrim(p_note) else feedback end,
         feedback_by = auth.uid(),
         feedback_at = now()
   where id = p_row
  returning * into r;

  if p_decision = 'Approved' then
    insert into public.changes (date, market_id, channel_id, type, text, created_by)
    values ((now() at time zone 'Australia/Brisbane')::date, null, null, 'Creative',
            format('%s approved messaging for "%s".', who, r.funnel_stage), auth.uid());
  end if;

  return r;
end;
$$;

revoke all on function public.respond_to_tracker(uuid, text, text) from public, anon;
grant execute on function public.respond_to_tracker(uuid, text, text) to authenticated;

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_member() from public, anon;
revoke all on function public.is_editor() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.current_app_role(), public.is_member(), public.is_editor(), public.is_admin() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.audit_row() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('imports', 'imports', false, 20971520),
       ('creative-assets', 'creative-assets', false, 20971520)
on conflict (id) do nothing;

create policy "imports: editors read" on storage.objects for select to authenticated
  using (bucket_id = 'imports' and public.is_editor());
create policy "imports: editors write" on storage.objects for insert to authenticated
  with check (bucket_id = 'imports' and public.is_editor());
create policy "imports: editors delete" on storage.objects for delete to authenticated
  using (bucket_id = 'imports' and public.is_editor());

create policy "creative-assets: members read" on storage.objects for select to authenticated
  using (bucket_id = 'creative-assets' and public.is_member());
create policy "creative-assets: editors write" on storage.objects for insert to authenticated
  with check (bucket_id = 'creative-assets' and public.is_editor());
create policy "creative-assets: editors update" on storage.objects for update to authenticated
  using (bucket_id = 'creative-assets' and public.is_editor());
create policy "creative-assets: editors delete" on storage.objects for delete to authenticated
  using (bucket_id = 'creative-assets' and public.is_editor());
