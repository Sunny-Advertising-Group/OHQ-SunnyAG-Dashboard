-- Never leave the portal without an admin: block demoting or removing the last one.
create function public.keep_one_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    if not exists (select 1 from public.profiles where role = 'admin' and id <> old.id) then
      raise exception 'There must always be at least one admin.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function public.keep_one_admin() from public, anon, authenticated;

create trigger profiles_keep_one_admin before update of role or delete on public.profiles
  for each row execute function public.keep_one_admin();
