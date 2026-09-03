-- The trusted Edge Function reserves an email row as PENDING, then updates it
-- to SENT or FAILED after the external provider responds.  It needs UPDATE in
-- addition to the existing INSERT grant; browser roles remain read-only under
-- their existing RLS policy.
grant update on table public.email_logs to service_role;
