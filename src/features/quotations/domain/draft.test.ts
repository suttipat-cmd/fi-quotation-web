import { describe, expect, it } from "vitest";
import { defaultQuotationItems, initialQuotationForm, makeServiceItem, validateQuotationForEmail, validateQuotationForPdf } from "./draft";
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
