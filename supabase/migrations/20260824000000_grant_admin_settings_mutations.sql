-- RLS policies only decide which rows are allowed.  The authenticated role
-- also needs table privileges for the administrator settings screens.
grant insert, update, delete on public.services, public.payment_terms, public.bank_accounts to authenticated;
grant update on public.company_settings, public.profiles to authenticated;
