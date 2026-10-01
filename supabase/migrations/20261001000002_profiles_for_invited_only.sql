-- Only people invited from Admin → People & access get a profile (and so any access).
-- A self-made account (e.g. a direct Supabase sign-up) gets no profile, so RLS shows it nothing
-- and the portal sends it back to the login page.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.invited_at is null then
    return new;
  end if;
  insert into public.profiles (id, email, name)
  values (new.id, lower(new.email), split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;
