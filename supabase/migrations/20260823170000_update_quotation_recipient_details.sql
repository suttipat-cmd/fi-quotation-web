-- Recipient details are operational data: they may be updated after a quotation
-- is confirmed, without reopening any pricing or status fields.
create or replace function public.update_quotation_recipient_details(
  p_quotation_id uuid,
  p_contact_name text,
  p_contact_position text,
  p_recipient_emails text[]
)
returns public.quotations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotations;
  v_recipients text[];
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not app.can_access_quotation(p_quotation_id) then
    raise exception 'Quotation not found or access denied';
  end if;

  select coalesce(array_agg(email order by email), array[]::text[])
  into v_recipients
  from (
    select distinct lower(btrim(email)) as email
    from unnest(coalesce(p_recipient_emails, array[]::text[])) as value(email)
    where nullif(btrim(email), '') is not null
  ) cleaned;

  update public.quotations
  set contact_name = nullif(btrim(p_contact_name), ''),
      contact_position = nullif(btrim(p_contact_position), ''),
      recipient_emails = v_recipients,
      contact_email = nullif(v_recipients[1], ''),
      updated_by = (select auth.uid())
  where id = p_quotation_id
  returning * into v_quote;

  return v_quote;
end;
$$;

revoke all on function public.update_quotation_recipient_details(uuid, text, text, text[]) from public, anon;
grant execute on function public.update_quotation_recipient_details(uuid, text, text, text[]) to authenticated;
