import { fromBaht } from "../../../lib/format";
import type { Category, QuoteGroupTotals, QuotationForm, QuotationItem, QuotationTotals } from "../types";

export const calculateItemTotal = (item: QuotationItem) => {
  const raw =
    item.category === "ONE_TIME" && item.quantity === 0
      ? 0
      : item.calculation_mode === "INCLUDED"
        ? 0
        : item.calculation_mode === "MANUAL_AMOUNT"
          ? item.manual_amount_satang
          : item.calculation_mode === "QUANTITY_X_UNIT_PRICE"
            ? Math.round(item.quantity * item.unit_price_satang)
            : item.unit_price_satang;
  const discount =
    item.discount_type === "PERCENTAGE"
      ? Math.round((raw * item.discount_value) / 100)
      : item.discount_type === "FIXED_AMOUNT"
        ? fromBaht(item.discount_value)
        : 0;
  return { subtotal: raw, discount: Math.min(raw, discount), net: Math.max(0, raw - discount) };
};

export const calculateQuotationTotals = (
  form: Pick<QuotationForm, "quotation_discount_type" | "quotation_discount_value" | "vat_rate" | "wht_rate">,
  items: QuotationItem[],
): QuotationTotals => {
  const subtotal = items.reduce((sum, item) => sum + calculateItemTotal(item).net, 0);
  const discount = Math.min(
    subtotal,
    form.quotation_discount_type === "PERCENTAGE"
      ? Math.round((subtotal * form.quotation_discount_value) / 100)
      : form.quotation_discount_type === "FIXED_AMOUNT"
        ? fromBaht(form.quotation_discount_value)
        : 0,
  );
  const taxBase = subtotal - discount;
  const vat = Math.round((taxBase * form.vat_rate) / 100);
  const wht = Math.round((taxBase * form.wht_rate) / 100);
  return { subtotal, discount, taxBase, vat, wht, net: taxBase + vat - wht };
};

export const calculateCategoryTotals = (
  category: Category,
  form: Pick<QuotationForm, "vat_rate" | "wht_rate">,
  items: QuotationItem[],
  total: QuotationTotals,
): QuoteGroupTotals => {
  const subtotal = items
    .filter((item) => item.category === category && item.service_name.trim())
    .reduce((sum, item) => sum + calculateItemTotal(item).net, 0);
  const discount = total.subtotal ? Math.round((total.discount * subtotal) / total.subtotal) : 0;
  const taxBase = subtotal - discount;
  const vat = Math.round((taxBase * form.vat_rate) / 100);
  const wht = Math.round((taxBase * form.wht_rate) / 100);
  return { subtotal, discount, vat, wht, net: taxBase + vat - wht };
};
