-- Never allow a USER or ADMIN profile to be stored as the salesperson. This
-- protects every write path, including future admin tools and direct RPC use.
create or replace function app.validate_quotation_sales_profile()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
begin
  if new.sales_profile_id is null or not exists (
    select 1
    from public.profiles p
    where p.id = new.sales_profile_id
      and p.role = 'SALE'
      and p.active is true
  ) then
    raise exception 'Selected salesperson is unavailable';
  end if;
  return new;
end;
$$;

drop trigger if exists quotations_validate_sales_profile on public.quotations;
create trigger quotations_validate_sales_profile
before insert or update of sales_profile_id on public.quotations
for each row execute function app.validate_quotation_sales_profile();

revoke all on function app.validate_quotation_sales_profile() from public, authenticated;
