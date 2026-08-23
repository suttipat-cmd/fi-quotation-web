-- RLS policies and quotation RPCs call authorization helpers in the private
-- `app` schema. The authenticated role already has EXECUTE on the specific
-- helpers, but PostgreSQL also requires schema USAGE to resolve them.
-- This does not grant access to any table or to other app functions.
grant usage on schema app to authenticated;
