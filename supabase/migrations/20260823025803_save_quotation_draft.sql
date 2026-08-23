-- Save a quotation and all of its rows atomically. Client calculations remain
-- visible for preview, but the final persisted snapshot is one transaction.
create or replace function public.save_quotation_draft(
  p_quotation_id uuid,
  p_quotation jsonb,
  p_items jsonb
)
returns public.quotations
language plpgsql
security invoker
set search_path = public, app
as $$
declare
  v_quote public.quotations;
  v_input public.quotations;
  v_item_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Quotation items must be an array';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count = 0 then
    raise exception 'At least one quotation item is required';
  end if;

  select * into v_input from jsonb_populate_record(null::public.quotations, p_quotation);
  if nullif(btrim(coalesce(v_input.customer_name, '')), '') is null then
    raise exception 'Customer name is required';
  end if;

  if p_quotation_id is null then
    insert into public.quotations (
      document_no, customer_name, customer_address, contact_name, contact_position,
      contact_email, recipient_emails, sales_name, issued_at, valid_until, notes,
      payment_terms, vat_rate, wht_rate, quotation_discount_type,
      quotation_discount_value, quotation_discount_satang, subtotal_satang,
      tax_base_satang, vat_amount_satang, wht_amount_satang, net_amount_satang,
      package_reference_quantity, package_reference_unit, included_users,
      billing_cycle, billing_cycles, recurring_addons, additional_fees, promotion_terms,
      created_by, updated_by
    ) values (
      'PENDING', btrim(v_input.customer_name), v_input.customer_address,
      v_input.contact_name, v_input.contact_position, v_input.contact_email,
      coalesce(v_input.recipient_emails, array[]::text[]), v_input.sales_name,
      v_input.issued_at, v_input.valid_until, v_input.notes, v_input.payment_terms,
      v_input.vat_rate, v_input.wht_rate, v_input.quotation_discount_type,
      v_input.quotation_discount_value, v_input.quotation_discount_satang,
      v_input.subtotal_satang, v_input.tax_base_satang, v_input.vat_amount_satang,
      v_input.wht_amount_satang, v_input.net_amount_satang,
      v_input.package_reference_quantity, v_input.package_reference_unit,
      v_input.included_users, v_input.billing_cycle,
      coalesce(v_input.billing_cycles, array[]::text[]),
      coalesce(v_input.recurring_addons, array[]::text[]), v_input.additional_fees,
      v_input.promotion_terms, (select auth.uid()), (select auth.uid())
    ) returning * into v_quote;
  else
    select * into v_quote from public.quotations where id = p_quotation_id for update;
    if not found or not (app.is_admin() or (v_quote.owner_id = (select auth.uid()) and v_quote.status = 'DRAFT')) then
      raise exception 'Quotation not found, access denied, or no longer editable';
    end if;

    update public.quotations
    set customer_name = btrim(v_input.customer_name),
        customer_address = v_input.customer_address,
        contact_name = v_input.contact_name,
        contact_position = v_input.contact_position,
        contact_email = v_input.contact_email,
        recipient_emails = coalesce(v_input.recipient_emails, array[]::text[]),
        sales_name = v_input.sales_name,
        issued_at = v_input.issued_at,
        valid_until = v_input.valid_until,
        notes = v_input.notes,
        payment_terms = v_input.payment_terms,
        vat_rate = v_input.vat_rate,
        wht_rate = v_input.wht_rate,
        quotation_discount_type = v_input.quotation_discount_type,
        quotation_discount_value = v_input.quotation_discount_value,
        quotation_discount_satang = v_input.quotation_discount_satang,
        subtotal_satang = v_input.subtotal_satang,
        tax_base_satang = v_input.tax_base_satang,
        vat_amount_satang = v_input.vat_amount_satang,
        wht_amount_satang = v_input.wht_amount_satang,
        net_amount_satang = v_input.net_amount_satang,
        package_reference_quantity = v_input.package_reference_quantity,
        package_reference_unit = v_input.package_reference_unit,
        included_users = v_input.included_users,
        billing_cycle = v_input.billing_cycle,
        billing_cycles = coalesce(v_input.billing_cycles, array[]::text[]),
        recurring_addons = coalesce(v_input.recurring_addons, array[]::text[]),
        additional_fees = v_input.additional_fees,
        promotion_terms = v_input.promotion_terms,
        updated_by = (select auth.uid())
    where id = v_quote.id
    returning * into v_quote;

    delete from public.quotation_items where quotation_id = v_quote.id;
  end if;

  insert into public.quotation_items (
    quotation_id, category, service_id, service_name, billing_type, calculation_mode,
    reference_quantity, quantity, unit, unit_price_satang, manual_amount_satang,
    discount_type, discount_value, discount_amount_satang, line_subtotal_satang,
    line_net_satang, sort_order
  )
  select
    v_quote.id, row.category::public.item_category, row.service_id, row.service_name,
    row.billing_type, row.calculation_mode::public.calculation_mode,
    row.reference_quantity, row.quantity, row.unit, row.unit_price_satang,
    row.manual_amount_satang, row.discount_type::public.discount_type,
    row.discount_value, row.discount_amount_satang, row.line_subtotal_satang,
    row.line_net_satang, row.sort_order
  from jsonb_to_recordset(p_items) as row(
    category text, service_id uuid, service_name text, billing_type text,
    calculation_mode text, reference_quantity numeric, quantity numeric, unit text,
    unit_price_satang bigint, manual_amount_satang bigint, discount_type text,
    discount_value numeric, discount_amount_satang bigint, line_subtotal_satang bigint,
    line_net_satang bigint, sort_order integer
  )
  where nullif(btrim(row.service_name), '') is not null;

  return v_quote;
end;
$$;

revoke all on function public.save_quotation_draft(uuid, jsonb, jsonb) from public;
grant execute on function public.save_quotation_draft(uuid, jsonb, jsonb) to authenticated;
