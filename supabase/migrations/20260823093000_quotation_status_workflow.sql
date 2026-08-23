-- Status workflow: DRAFT -> READY (after Drive succeeds) -> ACCEPTED.
-- E-mail delivery is an audit event and intentionally does not change quotation status.

alter table public.quotations
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_note text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id);

create index if not exists quotations_cancelled_by_idx
  on public.quotations(cancelled_by)
  where cancelled_by is not null;

-- Retire the old intermediate / rejection states without losing existing documents.
update public.quotations
set status = case
  when status = 'SENT' then 'READY'::public.quotation_status
  when status = 'REJECTED' then 'CANCELLED'::public.quotation_status
  else status
end
where status in ('SENT', 'REJECTED');

-- Acceptance is the only regular user-driven state transition. Cancellation is
-- handled separately so a reason is always captured in the same transaction.
create or replace function public.change_quotation_status(
  p_quotation_id uuid,
  p_status public.quotation_status
)
returns public.quotations
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_quote public.quotations;
begin
  select * into v_quote
  from public.quotations
  where id = p_quotation_id
  for update;

  if not found or not (app.is_admin() or v_quote.owner_id = (select auth.uid())) then
    raise exception 'Quotation not found or access denied';
  end if;

  if v_quote.status <> 'READY' or p_status <> 'ACCEPTED' then
    raise exception 'Invalid status transition from % to %', v_quote.status, p_status;
  end if;

  update public.quotations
  set status = p_status,
      updated_at = now(),
      updated_by = (select auth.uid())
  where id = p_quotation_id
  returning * into v_quote;

  insert into public.audit_logs (quotation_id, actor_id, action, metadata)
  values (p_quotation_id, (select auth.uid()), 'STATUS_CHANGED', jsonb_build_object('status', p_status));

  return v_quote;
end;
$$;

create or replace function public.cancel_quotation(
  p_quotation_id uuid,
  p_reason text,
  p_note text default null
)
returns public.quotations
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_quote public.quotations;
  v_previous_status public.quotation_status;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into v_quote
  from public.quotations
  where id = p_quotation_id
  for update;

  if not found or not (app.is_admin() or v_quote.owner_id = (select auth.uid())) then
    raise exception 'Quotation not found or access denied';
  end if;

  if v_quote.status not in ('DRAFT', 'READY', 'ACCEPTED', 'EXPIRED') then
    raise exception 'Quotation cannot be cancelled from status %', v_quote.status;
  end if;

  if v_reason = '' then
    raise exception 'Cancellation reason is required';
  end if;

  if v_reason = 'อื่น ๆ' and v_note is null then
    raise exception 'Cancellation note is required when reason is other';
  end if;

  v_previous_status := v_quote.status;

  update public.quotations
  set status = 'CANCELLED',
      cancellation_reason = v_reason,
      cancellation_note = v_note,
      cancelled_at = now(),
      cancelled_by = (select auth.uid()),
      updated_at = now(),
      updated_by = (select auth.uid())
  where id = p_quotation_id
  returning * into v_quote;

  insert into public.audit_logs (quotation_id, actor_id, action, metadata)
  values (
    p_quotation_id,
    (select auth.uid()),
    'QUOTATION_CANCELLED',
    jsonb_build_object('reason', v_reason, 'note', v_note, 'previous_status', v_previous_status)
  );

  return v_quote;
end;
$$;

-- Revisions preserve history, but a cancelled document must remain view-only.
create or replace function public.create_quotation_revision(p_quotation_id uuid)
returns public.quotations language plpgsql security definer set search_path = public, app as $$
declare v_source public.quotations; v_new public.quotations;
begin
  select * into v_source from public.quotations where id = p_quotation_id for update;
  if not found or not (app.is_admin() or v_source.owner_id = (select auth.uid())) then
    raise exception 'Quotation not found or access denied';
  end if;
  if v_source.status not in ('READY', 'ACCEPTED', 'EXPIRED') then
    raise exception 'A revision can be created only from a confirmed, accepted, or expired quotation';
  end if;

  insert into public.quotations (
    document_no, revision_no, root_quotation_id, owner_id, status, issued_at, valid_until,
    customer_id, customer_name, customer_tax_id, customer_branch, customer_address,
    contact_name, contact_position, contact_email, contact_phone, sales_name,
    quotation_discount_type, quotation_discount_value, quotation_discount_satang,
    vat_rate, wht_rate, subtotal_satang, tax_base_satang, vat_amount_satang, wht_amount_satang,
    net_amount_satang, notes, payment_terms, bank_account_id,
    package_reference_quantity, package_reference_unit, included_users, billing_cycle,
    billing_cycles, recurring_addons, additional_fees, promotion_terms, recipient_emails,
    created_by, updated_by
  ) values (
    v_source.document_no, v_source.revision_no + 1, coalesce(v_source.root_quotation_id, v_source.id),
    (select auth.uid()), 'DRAFT', current_date, current_date + 30,
    v_source.customer_id, v_source.customer_name, v_source.customer_tax_id, v_source.customer_branch, v_source.customer_address,
    v_source.contact_name, v_source.contact_position, v_source.contact_email, v_source.contact_phone, v_source.sales_name,
    v_source.quotation_discount_type, v_source.quotation_discount_value, v_source.quotation_discount_satang,
    v_source.vat_rate, v_source.wht_rate, v_source.subtotal_satang, v_source.tax_base_satang, v_source.vat_amount_satang, v_source.wht_amount_satang,
    v_source.net_amount_satang, v_source.notes, v_source.payment_terms, v_source.bank_account_id,
    v_source.package_reference_quantity, v_source.package_reference_unit, v_source.included_users, v_source.billing_cycle,
    v_source.billing_cycles, v_source.recurring_addons, v_source.additional_fees, v_source.promotion_terms, v_source.recipient_emails,
    (select auth.uid()), (select auth.uid())
  ) returning * into v_new;

  insert into public.quotation_items (
    quotation_id, category, service_id, service_code, service_name, description, billing_type, calculation_mode,
    reference_quantity, quantity, unit, unit_price_satang, manual_amount_satang, discount_type, discount_value,
    discount_amount_satang, line_subtotal_satang, line_net_satang, sort_order
  ) select v_new.id, category, service_id, service_code, service_name, description, billing_type, calculation_mode,
    reference_quantity, quantity, unit, unit_price_satang, manual_amount_satang, discount_type, discount_value,
    discount_amount_satang, line_subtotal_satang, line_net_satang, sort_order
  from public.quotation_items where quotation_id = v_source.id;

  insert into public.audit_logs (quotation_id, actor_id, action, metadata)
  values (v_new.id, (select auth.uid()), 'REVISION_CREATED', jsonb_build_object('source_quotation_id', v_source.id, 'revision_no', v_new.revision_no));
  return v_new;
end;
$$;

-- Expire confirmed quotations once per Bangkok day. The job itself runs in UTC,
-- while the date comparison is explicitly Bangkok time.
create extension if not exists pg_cron;
select cron.unschedule(jobid)
from cron.job
where jobname = 'expire-confirmed-quotations';

select cron.schedule(
  'expire-confirmed-quotations',
  '10 17 * * *',
  $$
    with expired as (
      update public.quotations
      set status = 'EXPIRED', updated_at = now()
      where status = 'READY'
        and valid_until < (timezone('Asia/Bangkok', now())::date)
      returning id
    )
    insert into public.audit_logs (quotation_id, action, metadata)
    select id, 'QUOTATION_EXPIRED', jsonb_build_object('source', 'scheduled_job')
    from expired;
  $$
);

revoke all on function public.change_quotation_status(uuid, public.quotation_status) from public;
revoke all on function public.cancel_quotation(uuid, text, text) from public;
revoke all on function public.create_quotation_revision(uuid) from public;
grant execute on function public.change_quotation_status(uuid, public.quotation_status) to authenticated;
grant execute on function public.cancel_quotation(uuid, text, text) to authenticated;
grant execute on function public.create_quotation_revision(uuid) to authenticated;
