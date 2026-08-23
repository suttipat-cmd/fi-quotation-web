import { plusDays, today } from "../../../lib/format";
import {
  CUSTOM_FORM_LABEL,
  DEFAULT_PAYMENT_TERMS,
  ONSITE_TRAINING_LABEL,
  SETUP_CHILD_SERVICES,
  SETUP_LABEL,
  SOFTWARE_SERVICE_LABEL,
} from "../constants";
import type { Quotation, QuotationForm, QuotationItem, Service } from "../types";

export const initialQuotationForm = (salesName = ""): QuotationForm => ({
  customer_name: "",
  customer_address: "",
  contact_name: "",
  contact_position: "",
  contact_email: "",
  recipient_emails: [],
  sales_name: salesName,
  issued_at: today(),
  valid_until: plusDays(30),
  notes: "",
  payment_terms: DEFAULT_PAYMENT_TERMS,
  vat_rate: 7,
  wht_rate: 3,
  quotation_discount_type: "NONE",
  quotation_discount_value: 0,
  package_reference_quantity: 0,
  package_reference_unit: "คัน",
  included_users: 0,
  billing_cycles: ["ค่าบริการชำระรายเดือน"],
  recurring_addons: [],
  additional_fees: "",
  promotion_terms: "",
});

export const makeQuotationItem = (category: QuotationItem["category"]): QuotationItem => ({
  id: crypto.randomUUID(),
  category,
  service_id: null,
  service_name: "",
  billing_type: category === "RECURRING" ? "MONTHLY" : "ONE_TIME",
  calculation_mode: "FIXED_PRICE",
  reference_quantity: 0,
  quantity: 1,
  unit: category === "RECURRING" ? "คัน" : "ครั้ง",
  unit_price_satang: 0,
  manual_amount_satang: 0,
  discount_type: "NONE",
  discount_value: 0,
});

export const makeRecurringItem = (): QuotationItem => ({
  ...makeQuotationItem("RECURRING"),
  service_name: SOFTWARE_SERVICE_LABEL,
  quantity: 1,
  unit: "คัน",
});

export const makeServiceItem = (service: Service, quantity = 1): QuotationItem => ({
  ...makeQuotationItem("ONE_TIME"),
  service_id: service.id,
  service_name: service.name,
  billing_type: service.default_billing_type,
  calculation_mode: service.default_calculation_mode,
  quantity,
  unit: service.default_unit || "ครั้ง",
});

export const makeSetupItem = (services: Service[]): QuotationItem => {
  const source = services.find((service) => SETUP_CHILD_SERVICES.includes(service.name));
  return {
    ...makeQuotationItem("ONE_TIME"),
    service_name: SETUP_LABEL,
    billing_type: source?.default_billing_type || "ONE_TIME",
    calculation_mode: "FIXED_PRICE",
    quantity: 1,
    unit: source?.default_unit || "ครั้ง",
  };
};

export const defaultQuotationItems = (services: Service[]) => [
  makeRecurringItem(),
  makeSetupItem(services),
  ...services
    .filter(
      (service) =>
        service.default_category === "ONE_TIME" &&
        !SETUP_CHILD_SERVICES.includes(service.name) &&
        service.name !== CUSTOM_FORM_LABEL,
    )
    .map((service) => makeServiceItem(service, service.name === ONSITE_TRAINING_LABEL ? 0 : 1)),
];

export const formFromQuotation = (quote: Quotation): QuotationForm => ({
  customer_name: quote.customer_name || "",
  customer_address: quote.customer_address || "",
  contact_name: quote.contact_name || "",
  contact_position: quote.contact_position || "",
  contact_email: quote.contact_email || "",
  recipient_emails: Array.isArray(quote.recipient_emails)
    ? quote.recipient_emails
    : quote.contact_email
      ? [quote.contact_email]
      : [],
  sales_name: quote.sales_name || "",
  issued_at: quote.issued_at || today(),
  valid_until: quote.valid_until || plusDays(30),
  notes: quote.notes || "",
  payment_terms: quote.payment_terms || DEFAULT_PAYMENT_TERMS,
  vat_rate: Number(quote.vat_rate || 0),
  wht_rate: Number(quote.wht_rate || 0),
  quotation_discount_type: quote.quotation_discount_type || "NONE",
  quotation_discount_value: Number(quote.quotation_discount_value || 0),
  package_reference_quantity: Number(quote.package_reference_quantity || 0),
  package_reference_unit: quote.package_reference_unit || "คัน",
  included_users: Number(quote.included_users || 0),
  billing_cycles:
    Array.isArray(quote.billing_cycles) && quote.billing_cycles.length
      ? quote.billing_cycles
      : quote.billing_cycle
        ? [quote.billing_cycle]
        : [],
  recurring_addons: Array.isArray(quote.recurring_addons) ? quote.recurring_addons : [],
  additional_fees: quote.additional_fees || "",
  promotion_terms: quote.promotion_terms || "",
});

export const normalizeQuotationItems = (
  saved: Array<QuotationItem & { line_net_satang?: number | null }>,
  services: Service[],
): QuotationItem[] => {
  const recurring = saved.find((item) => item.category === "RECURRING") || makeRecurringItem();
  const savedOneTime = saved.filter((item) => item.category === "ONE_TIME");
  const savedSetup = savedOneTime.find((item) => item.service_name === SETUP_LABEL);
  const legacySetup = savedOneTime.filter((item) => SETUP_CHILD_SERVICES.includes(item.service_name));
  const setup = savedSetup
    ? { ...savedSetup, id: savedSetup.id || crypto.randomUUID() }
    : legacySetup.length
      ? {
          ...makeSetupItem(services),
          unit_price_satang: legacySetup.reduce(
            (sum, item) => sum + Number(item.line_net_satang || 0),
            0,
          ),
          quantity: legacySetup.some((item) => Number(item.quantity) > 0) ? 1 : 0,
        }
      : makeSetupItem(services);
  const standardItems = services
    .filter(
      (service) =>
        service.default_category === "ONE_TIME" &&
        !SETUP_CHILD_SERVICES.includes(service.name) &&
        service.name !== CUSTOM_FORM_LABEL,
    )
    .map((service) => {
      const found = savedOneTime.find(
        (item) => item.service_id === service.id || item.service_name === service.name,
      );
      return found
        ? { ...found, id: found.id || crypto.randomUUID() }
        : makeServiceItem(service, service.name === ONSITE_TRAINING_LABEL ? 0 : 1);
    });
  const customRows = savedOneTime
    .filter((item) => item.service_name === CUSTOM_FORM_LABEL)
    .map((item) => ({ ...item, id: item.id || crypto.randomUUID() }));
  return [{ ...recurring, id: recurring.id || crypto.randomUUID() }, setup, ...standardItems, ...customRows];
};

export const validateQuotationDraft = (items: QuotationItem[], form: QuotationForm) => {
  if (!form.customer_name.trim()) return "กรุณาระบุชื่อลูกค้า";
  if (!items.some((item) => item.service_name.trim() && item.quantity >= 0)) {
    return "กรุณาระบุอย่างน้อยหนึ่งบริการ";
  }
  return null;
};
