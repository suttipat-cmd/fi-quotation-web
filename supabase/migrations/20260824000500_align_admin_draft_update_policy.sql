-- Administrators can already pass app.can_edit_draft(), but the original
-- WITH CHECK still required ownership. Align both halves of the policy.
drop policy if exists "draft quotations updated by owner" on public.quotations;
create policy "draft quotations updated by owner or admin"
on public.quotations
for update
to authenticated
using (app.can_edit_draft(id))
with check (app.is_admin() or (owner_id = (select auth.uid()) and status = 'DRAFT'));
