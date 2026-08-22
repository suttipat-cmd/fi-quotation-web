-- Resolve non-functional advisor findings and make helper behaviour explicit.
create or replace function app.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public, app as $$
begin new.updated_at = now(); return new; end;
$$;

create policy "quote counters never exposed to clients" on public.quote_counters
  for all to authenticated using (false) with check (false);

-- This event-trigger helper is not an RPC and must not be callable through the Data API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
