-- Saving a quotation writes a quotation and its item rows in one transaction.
-- The function is an authenticated service boundary: it verifies the caller,
-- ownership, selected sales scope, and draft-only updates before bypassing the
-- circular RLS checks required by INSERT ... RETURNING and child item rows.
alter function public.save_quotation_draft(uuid, jsonb, jsonb) security definer;
alter function public.save_quotation_draft(uuid, jsonb, jsonb) set search_path = public, app;
revoke all on function public.save_quotation_draft(uuid, jsonb, jsonb) from public;
grant execute on function public.save_quotation_draft(uuid, jsonb, jsonb) to authenticated;
