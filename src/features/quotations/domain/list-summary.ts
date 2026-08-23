import { ONSITE_TRAINING_LABEL } from "../constants";
import type { Category, Quotation, QuotationListItemSummary } from "../types";

const number = (value?: number | null) => Number(value || 0);

export const categoryNetAmount = (
  quote: Quotation,
  category: Category,
): number => {
  const items = quote.list_items || [];
  const subtotal = items
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + number(item.line_net_satang), 0);
  const documentSubtotal = number(quote.subtotal_satang) || items.reduce((sum, item) => sum + number(item.line_net_satang), 0);
  const discount = documentSubtotal
    ? Math.round((number(quote.quotation_discount_satang) * subtotal) / documentSubtotal)
    : 0;
  const taxBase = subtotal - discount;
  return taxBase + Math.round((taxBase * number(quote.vat_rate)) / 100) - Math.round((taxBase * number(quote.wht_rate)) / 100);
};

export const onsiteTraining = (quote: Quotation): QuotationListItemSummary | undefined =>
  quote.list_items?.find((item) => item.service_name === ONSITE_TRAINING_LABEL);
