import { plusDays, today } from "../../../lib/format";
import {
  ADDITIONAL_USER_FEE_LABEL,
  ADDITIONAL_USER_FEE_UNIT_PRICE_SATANG,
  CUSTOM_FORM_LABEL,
  DEFAULT_PAYMENT_TERMS,
  INCLUDED_USERS_DEFAULT,
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
  sales_title: "",
  sales_profile_id: undefined,
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
  included_users: INCLUDED_USERS_DEFAULT,
  additional_user_fee_waived: false,
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
  unit_price_satang: service.suggested_price_satang ?? 0,
});

export const additionalUserQuantity = (includedUsers?: number | null) =>
  Math.max(0, Math.trunc(Number(includedUsers) || 0) - INCLUDED_USERS_DEFAULT);

export const makeAdditionalUserFeeItem = (includedUsers?: number | null): QuotationItem => ({
  ...makeQuotationItem("ONE_TIME"),
  service_name: ADDITIONAL_USER_FEE_LABEL,
  billing_type: "ONE_TIME",
  calculation_mode: "QUANTITY_X_UNIT_PRICE",
  quantity: additionalUserQuantity(includedUsers),
  unit: "User",
  unit_price_satang: ADDITIONAL_USER_FEE_UNIT_PRICE_SATANG,
});

export const noteLineLimit = (items: QuotationItem[]) =>
  items.some((item) => item.service_name === CUSTOM_FORM_LABEL) &&
  items.some((item) => item.service_name === ADDITIONAL_USER_FEE_LABEL)
    ? 5
    : 9;

export const limitNotesToLines = (value: string, maximumLines: number) =>
  value.replace(/\r/g, "").split("\n").slice(0, maximumLines).join("\n");

export const makeSetupItem = (services: Service[]): QuotationItem => {
  const setupServices = services.filter((service) => SETUP_CHILD_SERVICES.includes(service.name));
  const source = setupServices[0];
  return {
    ...makeQuotationItem("ONE_TIME"),
    service_name: SETUP_LABEL,
    billing_type: source?.default_billing_type || "ONE_TIME",
    calculation_mode: "FIXED_PRICE",
    quantity: 1,
    unit: source?.default_unit || "ครั้ง",
    // Setup is one editable row in a quotation, while its service catalogue
    // entries are split into vehicle and data setup. Combine any defaults so
    // neither catalogue price is silently discarded.
    unit_price_satang: setupServices.reduce(
      (sum, service) => sum + (service.suggested_price_satang ?? 0),
      0,
    ),
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
  sales_title: quote.sales_title || "",
  sales_profile_id: quote.sales_profile_id || undefined,
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
  included_users: Number(quote.included_users) > 0 ? Number(quote.included_users) : INCLUDED_USERS_DEFAULT,
  additional_user_fee_waived: Boolean(quote.additional_user_fee_waived),
  billing_cycles:
    Array.isArray(quote.billing_cycles) && quote.billing_cycles.length
      ? quote.billing_cycles.slice(0, 1)
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
    .filter((item) => item.service_name === CUSTOM_FORM_LABEL || item.service_name === ADDITIONAL_USER_FEE_LABEL)
    .map((item) => ({ ...item, id: item.id || crypto.randomUUID() }));
  return [{ ...recurring, id: recurring.id || crypto.randomUUID() }, setup, ...standardItems, ...customRows];
};

export const validateQuotationDraft = (items: QuotationItem[], form: QuotationForm) => {
  if (!form.customer_name.trim()) return "กรุณาระบุชื่อลูกค้า";
  if (!items.some((item) => item.service_name.trim() && item.quantity >= 0)) {
    return "กรุณาระบุอย่างน้อยหนึ่งบริการ";
  }
  if (form.notes.replace(/\r/g, "").split("\n").length > noteLineLimit(items)) {
    return `หมายเหตุในเอกสารกรอกได้สูงสุด ${noteLineLimit(items)} บรรทัดสำหรับรายการที่เลือก`;
  }
  return null;
};

export const validateQuotationForPdf = (items: QuotationItem[], form: QuotationForm) => {
  const draftError = validateQuotationDraft(items, form);
  if (draftError) return draftError;
  if (!form.issued_at) return "กรุณาระบุวันที่ออกเอกสารก่อนสร้าง PDF";
  if (!form.valid_until) return "กรุณาระบุวันใช้ได้ถึงก่อนสร้าง PDF";
  if (form.valid_until < form.issued_at) return "วันใช้ได้ถึงต้องไม่ก่อนวันที่ออกเอกสาร";
  if (!form.sales_profile_id) return "กรุณาเลือกผู้เสนอราคาก่อนสร้าง PDF";
  if (!form.customer_address.trim()) return "กรุณาระบุที่อยู่ลูกค้าก่อนสร้าง PDF";
  if (form.billing_cycles.length !== 1) return "กรุณาเลือกรอบชำระค่าบริการ 1 รายการ";
  if (!form.recurring_addons.length) return "กรุณาเลือกบริการหลักอย่างน้อย 1 รายการ";
  if (!Number.isFinite(form.package_reference_quantity) || form.package_reference_quantity <= 0) {
    return "กรุณาระบุจำนวนรถมากกว่า 0 ก่อนสร้าง PDF";
  }
  if (!Number.isFinite(form.included_users) || form.included_users <= 0) {
    return "กรุณาระบุจำนวน User ใช้งานมากกว่า 0 ก่อนสร้าง PDF";
  }
  const recurring = items.find((item) => item.category === "RECURRING");
  if (!recurring || !Number.isFinite(recurring.unit_price_satang) || recurring.unit_price_satang < 0) {
    return "กรุณาระบุราคารวมของค่าบริการซอฟต์แวร์";
  }
  return null;
};

export const validateQuotationForEmail = (contactName: string, recipientEmails: string[]) => {
  if (!contactName.trim()) return "กรุณาระบุผู้รับเอกสารก่อนส่งอีเมล";
  if (!recipientEmails.length) return "กรุณาระบุอีเมลผู้รับเอกสารก่อนส่งอีเมล";
  return null;
};
