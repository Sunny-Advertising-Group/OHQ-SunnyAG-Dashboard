-- Latest copy of a Google Sheet tab, formatting included, for the "Media report" page.
-- Written only by the hourly sync (service role); read by anyone with portal access.
create table public.sheet_snapshots (
  gid bigint primary key,
  title text not null,
  snapshot jsonb not null,
  fetched_at timestamptz not null default now(),
  sheet_modified_at timestamptz
);
alter table public.sheet_snapshots enable row level security;
grant select on public.sheet_snapshots to authenticated;
grant all on public.sheet_snapshots to service_role;
create policy sheet_snapshots_select on public.sheet_snapshots for select to authenticated using (public.is_member());
