-- Kept as a separate no-op-safe migration to match the production schema history.
create index if not exists quotations_cancelled_by_idx
  on public.quotations(cancelled_by)
  where cancelled_by is not null;
