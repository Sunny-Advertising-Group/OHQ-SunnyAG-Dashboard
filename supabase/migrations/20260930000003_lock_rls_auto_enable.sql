-- Supabase's "automatic RLS" event-trigger helper doesn't need to be callable over the API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
