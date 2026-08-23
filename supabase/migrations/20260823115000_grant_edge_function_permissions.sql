-- Edge Functions use the service_role key for trusted, server-side writes.
-- Keep browser clients on their existing RLS policies; do not grant these
-- privileges to anon or authenticated.
grant select, insert, update on table public.quotation_revisions to service_role;
grant select, update on table public.quotations to service_role;
grant insert on table public.audit_logs, public.email_logs to service_role;
