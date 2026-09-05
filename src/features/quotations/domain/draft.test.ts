import { describe, expect, it } from "vitest";
import { additionalUserQuantity, defaultQuotationItems, initialQuotationForm, makeAdditionalUserFeeItem, makeQuotationItem, makeServiceItem, noteLineLimit, validateQuotationForEmail, validateQuotationForPdf } from "./draft";
import { ADDITIONAL_USER_FEE_LABEL, CUSTOM_FORM_LABEL } from "../constants";
import type { Service } from "../types";

const services: Service[] = [
  { id: "erp", name: "ERP ขนส่ง", code: "ERP", default_category: "RECURRING", default_billing_type: "MONTHLY", default_calculation_mode: "FIXED_PRICE", default_unit: "คัน", suggested_price_satang: null, active: true, sort_order: 1 },
  { id: "setup", name: "ทะเบียนรถ", code: "SETUP", default_category: "ONE_TIME", default_billing_type: "ONE_TIME", default_calculation_mode: "FIXED_PRICE", default_unit: "ครั้ง", suggested_price_satang: null, active: true, sort_order: 2 },
];

describe("quotation completion validation", () => {
  it("allows a complete PDF quote with a zero price", () => {
    const form = initialQuotationForm("ฝ่ายขาย");
    form.customer_name = "บริษัททดสอบ";
    form.customer_address = "กรุงเทพมหานคร";
    form.sales_profile_id = "sale-1";
    form.recurring_addons = ["ERP ขนส่ง"];
    form.package_reference_quantity = 1;
    expect(validateQuotationForPdf(defaultQuotationItems(services), form)).toBeNull();
  });

  it("defaults the included user count to three and requires a positive value for PDF", () => {
    const form = initialQuotationForm();
    expect(form.included_users).toBe(3);
    form.customer_name = "บริษัททดสอบ";
    form.customer_address = "กรุงเทพมหานคร";
    form.sales_profile_id = "sale-1";
    form.recurring_addons = ["ERP ขนส่ง"];
    form.package_reference_quantity = 1;
    form.included_users = 0;
    expect(validateQuotationForPdf(defaultQuotationItems(services), form)).toBe("กรุณาระบุจำนวน User ใช้งานมากกว่า 0 ก่อนสร้าง PDF");
  });

  it("creates a one-time 500 baht fee for every user above the three included users", () => {
    const item = makeAdditionalUserFeeItem(5);
    expect(additionalUserQuantity(5)).toBe(2);
    expect(item.service_name).toBe(ADDITIONAL_USER_FEE_LABEL);
    expect(item.quantity).toBe(2);
    expect(item.unit).toBe("User");
    expect(item.unit_price_satang).toBe(50_000);
  });

  it("limits notes to five lines only when both additional item types are selected", () => {
    const customForm = { ...makeQuotationItem("ONE_TIME"), service_name: CUSTOM_FORM_LABEL };
    const extraUser = makeAdditionalUserFeeItem(4);
    expect(noteLineLimit([customForm])).toBe(9);
    expect(noteLineLimit([extraUser])).toBe(9);
    expect(noteLineLimit([customForm, extraUser])).toBe(5);
  });

  it("rejects a PDF when notes exceed the active five-line limit", () => {
    const form = initialQuotationForm("ฝ่ายขาย");
    form.customer_name = "บริษัททดสอบ";
    form.customer_address = "กรุงเทพมหานคร";
    form.sales_profile_id = "sale-1";
    form.recurring_addons = ["ERP ขนส่ง"];
    form.package_reference_quantity = 1;
    form.included_users = 4;
    form.notes = "1\n2\n3\n4\n5\n6";
    const items = [...defaultQuotationItems(services), { ...makeQuotationItem("ONE_TIME"), service_name: CUSTOM_FORM_LABEL }, makeAdditionalUserFeeItem(4)];
    expect(validateQuotationForPdf(items, form)).toBe("หมายเหตุในเอกสารกรอกได้สูงสุด 5 บรรทัดสำหรับรายการที่เลือก");
  });

  it("requires the PDF-only details that a draft may omit", () => {
    const form = initialQuotationForm("ฝ่ายขาย");
    form.customer_name = "บริษัททดสอบ";
    expect(validateQuotationForPdf(defaultQuotationItems(services), form)).toBe("กรุณาเลือกผู้เสนอราคาก่อนสร้าง PDF");
  });

  it("requires a recipient and at least one email before sending", () => {
    expect(validateQuotationForEmail("", [])).toBe("กรุณาระบุผู้รับเอกสารก่อนส่งอีเมล");
    expect(validateQuotationForEmail("คุณเอ", [])).toBe("กรุณาระบุอีเมลผู้รับเอกสารก่อนส่งอีเมล");
    expect(validateQuotationForEmail("คุณเอ", ["a@example.com"])).toBeNull();
  });

  it("uses a catalogue suggested price as the initial one-time item price", () => {
    const service: Service = {
      ...services[1],
      suggested_price_satang: 125000,
    };
    expect(makeServiceItem(service).unit_price_satang).toBe(125000);
  });

  it("combines setup catalogue defaults into the single Setup row", () => {
    const setupServices: Service[] = [
      { ...services[1], id: "vehicle-setup", name: "Setup ทะเบียนรถ", suggested_price_satang: 150000 },
      { ...services[1], id: "data-setup", name: "Setup ข้อมูลทั่วไป", suggested_price_satang: 50000 },
    ];
    const setup = defaultQuotationItems(setupServices).find((item) => item.service_name === "Setup");
    expect(setup?.unit_price_satang).toBe(200000);
  });
});
