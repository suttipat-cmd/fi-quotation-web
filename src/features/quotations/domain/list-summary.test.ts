import { describe, expect, it } from "vitest";
import { categoryNetAmount, onsiteTraining } from "./list-summary";
import type { Quotation } from "../types";

const quote: Quotation = {
  id: "quotation-1",
  document_no: "QT2608-0001",
  revision_no: 0,
  status: "READY",
  customer_name: "ลูกค้าทดสอบ",
  issued_at: "2026-08-23",
  valid_until: "2026-09-22",
  vat_rate: 7,
  wht_rate: 3,
  subtotal_satang: 1_000_000,
  quotation_discount_satang: 10_000,
  list_items: [
    { category: "RECURRING", service_name: "ค่าบริการซอฟต์แวร์", quantity: 20, unit: "คัน", line_net_satang: 700_000 },
    { category: "ONE_TIME", service_name: "Setup", quantity: 1, unit: "ครั้ง", line_net_satang: 300_000 },
    { category: "ONE_TIME", service_name: "Onsite Training", quantity: 1, unit: "ครั้ง", line_net_satang: 0 },
  ],
};

describe("quotation list summary", () => {
  it("shows each table's net total with the same proportional discount and tax rules", () => {
    expect(categoryNetAmount(quote, "RECURRING")).toBe(720_720);
    expect(categoryNetAmount(quote, "ONE_TIME")).toBe(308_880);
    expect(categoryNetAmount(quote, "RECURRING") + categoryNetAmount(quote, "ONE_TIME")).toBe(1_029_600);
  });

  it("finds Onsite Training by its shared service label", () => {
    expect(onsiteTraining(quote)?.quantity).toBe(1);
  });
});
