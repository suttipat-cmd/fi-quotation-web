-- A USER can read only their own assignment in order to choose an authorised
-- salesperson on a quotation form. Administrators retain full management.
create policy "users read own sales scope"
on public.user_sales_scopes
for select
to authenticated
using (user_id = (select auth.uid()));
