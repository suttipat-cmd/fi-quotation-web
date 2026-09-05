import { supabase } from "../../../supabase";
import { calculateItemTotal } from "../domain/calculator";
import type { Profile, Quotation, QuotationForm, QuotationItem, QuotationTotals } from "../types";

export const toQuotationPayload = (
  form: QuotationForm,
  totals: QuotationTotals,
  profile?: Profile | null,
) => ({
  customer_name: form.customer_name.trim(),
  customer_address: form.customer_address || null,
  contact_name: form.contact_name || null,
  contact_position: form.contact_position || null,
  contact_email: form.contact_email || null,
  recipient_emails: form.recipient_emails,
  sales_name: form.sales_name || profile?.display_name || null,
  sales_title: form.sales_title || null,
  sales_profile_id: form.sales_profile_id || profile?.id || null,
  issued_at: form.issued_at,
  valid_until: form.valid_until,
  notes: form.notes || null,
  payment_terms: form.payment_terms || null,
  vat_rate: form.vat_rate,
  wht_rate: form.wht_rate,
  quotation_discount_type: form.quotation_discount_type,
  quotation_discount_value: form.quotation_discount_value,
  quotation_discount_satang: totals.discount,
  subtotal_satang: totals.subtotal,
  tax_base_satang: totals.taxBase,
  vat_amount_satang: totals.vat,
  wht_amount_satang: totals.wht,
  net_amount_satang: totals.net,
  package_reference_quantity: form.package_reference_quantity || null,
  package_reference_unit: form.package_reference_unit || null,
  included_users: form.included_users > 0 ? form.included_users : 3,
  additional_user_fee_waived: form.additional_user_fee_waived,
  billing_cycle: form.billing_cycles[0] || null,
  billing_cycles: form.billing_cycles.slice(0, 1),
  recurring_addons: form.recurring_addons,
  additional_fees: form.additional_fees || null,
  promotion_terms: form.promotion_terms || null,
});

export const toQuotationItemRows = (items: QuotationItem[]) =>
  items
    .filter((item) => item.service_name.trim())
    .map((item, index) => {
      const value = calculateItemTotal(item);
      return {
        category: item.category,
        service_id: item.service_id,
        service_name: item.service_name,
        billing_type: item.billing_type,
        calculation_mode: item.calculation_mode,
        reference_quantity: item.reference_quantity || null,
        quantity: item.quantity,
        unit: item.unit || null,
        unit_price_satang: item.unit_price_satang,
        manual_amount_satang: item.manual_amount_satang,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        discount_amount_satang: value.discount,
        line_subtotal_satang: value.subtotal,
        line_net_satang: value.net,
        sort_order: index,
      };
    });

export async function saveQuotationDraft(input: {
  id?: string | null;
  form: QuotationForm;
  items: QuotationItem[];
  totals: QuotationTotals;
  profile?: Profile | null;
}) {
  const result = await supabase.rpc("save_quotation_draft", {
    p_quotation_id: input.id || null,
    p_quotation: toQuotationPayload(input.form, input.totals, input.profile),
    p_items: toQuotationItemRows(input.items),
  });
  if (result.error || !result.data) {
    throw new Error(result.error?.message || "บันทึกใบเสนอราคาไม่สำเร็จ");
  }
  return result.data as Quotation;
}

export async function getQuotationItems(quotationId: string) {
  const result = await supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("sort_order");
  if (result.error) throw result.error;
  return (result.data || []).map((item) => ({
    ...item,
    id: item.id || crypto.randomUUID(),
    reference_quantity: Number(item.reference_quantity || 0),
    quantity: Number(item.quantity || 0),
    unit_price_satang: Number(item.unit_price_satang || 0),
    manual_amount_satang: Number(item.manual_amount_satang || 0),
    discount_value: Number(item.discount_value || 0),
  })) as Array<QuotationItem & { line_net_satang?: number | null }>;
}

export async function updateQuotationRecipientDetails(input: {
  quotationId: string;
  contactName: string;
  contactPosition: string;
  recipientEmails: string[];
}) {
  const result = await supabase.rpc("update_quotation_recipient_details", {
    p_quotation_id: input.quotationId,
    p_contact_name: input.contactName,
    p_contact_position: input.contactPosition,
    p_recipient_emails: input.recipientEmails,
  });
  if (result.error || !result.data) {
    throw new Error(result.error?.message || "บันทึกข้อมูลผู้รับเอกสารไม่สำเร็จ");
  }
  return result.data as Quotation;
}
