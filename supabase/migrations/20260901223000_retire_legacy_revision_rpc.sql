-- This migration applies the retirement to databases that already received
-- copy_quotation_as_new before the legacy revoke was added to that migration.
revoke all on function public.create_quotation_revision(uuid) from public, authenticated;
