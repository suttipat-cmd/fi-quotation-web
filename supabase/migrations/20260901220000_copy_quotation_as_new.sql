-- Copying a quotation creates a fully independent document. Historical
-- revisions are retained, but no new document may inherit a number or a
-- root_quotation_id from its source.
create or replace function public.copy_quotation_as_new(p_quotation_id uuid)
returns public.quotations
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_source public.quotations;
  v_new public.quotations;
begin
  select * into v_source
  from public.quotations
  where id = p_quotation_id
  for update;

  if not found or not (app.is_admin() or v_source.owner_id = (select auth.uid())) then
    raise exception 'Quotation not found or access denied';
  end if;

  if v_source.status not in ('READY', 'ACCEPTED', 'EXPIRED') then
    raise exception 'A quotation can be copied only from a confirmed, accepted, or expired quotation';
  end if;

  -- `quotations_assign_defaults` assigns a fresh document number because the
  -- root is NULL. Passing NULL for valid_until makes that same trigger apply
  -- the current company default-validity period from today.
  insert into public.quotations (
    document_no, revision_no, root_quotation_id, owner_id, status, issued_at, valid_until,
    customer_id, customer_name, customer_tax_id, customer_branch, customer_address,
    contact_name, contact_position, contact_email, contact_phone, sales_profile_id, sales_name, sales_title, sales_phone, sales_email,
    quotation_discount_type, quotation_discount_value, quotation_discount_satang, vat_rate, wht_rate,
    subtotal_satang, tax_base_satang, vat_amount_satang, wht_amount_satang, net_amount_satang,
    notes, payment_terms, bank_account_id, package_reference_quantity, package_reference_unit,
    included_users, billing_cycle, billing_cycles, recurring_addons, additional_fees, promotion_terms,
    recipient_emails, created_by, updated_by
  ) values (
    'PENDING', 0, null, (select auth.uid()), 'DRAFT', current_date, null,
    v_source.customer_id, v_source.customer_name, v_source.customer_tax_id, v_source.customer_branch, v_source.customer_address,
    v_source.contact_name, v_source.contact_position, v_source.contact_email, v_source.contact_phone,
    v_source.sales_profile_id, v_source.sales_name, v_source.sales_title, v_source.sales_phone, v_source.sales_email,
    v_source.quotation_discount_type, v_source.quotation_discount_value, v_source.quotation_discount_satang,
    v_source.vat_rate, v_source.wht_rate, v_source.subtotal_satang, v_source.tax_base_satang,
    v_source.vat_amount_satang, v_source.wht_amount_satang, v_source.net_amount_satang, v_source.notes,
    v_source.payment_terms, v_source.bank_account_id, v_source.package_reference_quantity,
    v_source.package_reference_unit, v_source.included_users, v_source.billing_cycle, v_source.billing_cycles,
    v_source.recurring_addons, v_source.additional_fees, v_source.promotion_terms, v_source.recipient_emails,
    (select auth.uid()), (select auth.uid())
  ) returning * into v_new;

  insert into public.quotation_items (
    quotation_id, category, service_id, service_code, service_name, description, billing_type, calculation_mode,
    reference_quantity, quantity, unit, unit_price_satang, manual_amount_satang, discount_type, discount_value,
    discount_amount_satang, line_subtotal_satang, line_net_satang, sort_order
  )
  select
    v_new.id, category, service_id, service_code, service_name, description, billing_type, calculation_mode,
    reference_quantity, quantity, unit, unit_price_satang, manual_amount_satang, discount_type, discount_value,
    discount_amount_satang, line_subtotal_satang, line_net_satang, sort_order
  from public.quotation_items
  where quotation_id = v_source.id;

  insert into public.audit_logs (quotation_id, actor_id, action, metadata)
  values (
    v_new.id,
    (select auth.uid()),
    'QUOTATION_COPIED_AS_NEW',
    jsonb_build_object('copy_type', 'independent_new_document')
  );

  return v_new;
end;
$$;

revoke all on function public.copy_quotation_as_new(uuid) from public;
grant execute on function public.copy_quotation_as_new(uuid) to authenticated;

-- The former revision endpoint must not remain callable by cached clients or
-- direct RPC requests, otherwise it could still create linked documents.
revoke all on function public.create_quotation_revision(uuid) from public, authenticated;
