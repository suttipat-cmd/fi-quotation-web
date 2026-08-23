import { describe, expect, it } from "vitest";
import { initialQuotationForm } from "./draft";
import { calculateCategoryTotals, calculateItemTotal, calculateQuotationTotals } from "./calculator";
import type { QuotationItem } from "../types";

const item = (patch: Partial<QuotationItem>): QuotationItem => ({
  id: "item-1",
  category: "RECURRING",
  service_id: null,
  service_name: "ค่าบริการซอฟต์แวร์",
  billing_type: "MONTHLY",
  calculation_mode: "FIXED_PRICE",
  reference_quantity: 0,
  quantity: 1,
  unit: "คัน",
  unit_price_satang: 0,
  manual_amount_satang: 0,
  discount_type: "NONE",
  discount_value: 0,
  ...patch,
});

describe("quotation calculator", () => {
  it("calculates a line discount without going below zero", () => {
    expect(calculateItemTotal(item({ unit_price_satang: 10_000, discount_type: "FIXED_AMOUNT", discount_value: 200 }))).toEqual({
      subtotal: 10_000,
      discount: 10_000,
      net: 0,
    });
  });

  it("allocates quotation discount and tax across categories consistently", () => {
    const form = { ...initialQuotationForm(), quotation_discount_type: "FIXED_AMOUNT", quotation_discount_value: 100, vat_rate: 7, wht_rate: 3 };
    const items = [
      item({ unit_price_satang: 700_000 }),
      item({ id: "item-2", category: "ONE_TIME", service_name: "Setup", unit_price_satang: 300_000 }),
    ];
    const total = calculateQuotationTotals(form, items);
    const recurring = calculateCategoryTotals("RECURRING", form, items, total);
    const oneTime = calculateCategoryTotals("ONE_TIME", form, items, total);

    expect(total).toEqual({ subtotal: 1_000_000, discount: 10_000, taxBase: 990_000, vat: 69_300, wht: 29_700, net: 1_029_600 });
    expect(recurring.net + oneTime.net).toBe(total.net);
  });
});
