import { describe, expect, it } from "vitest";
import { includedUserCount, softwareServiceTitle } from "./document";

describe("quotation document labels", () => {
  it("places selected package services in the software-service label", () => {
    expect(softwareServiceTitle(["ERP ขนส่ง", "ซ่อมบำรุง", "WMS"])).toBe(
      "ค่าบริการซอฟต์แวร์ ERP ขนส่ง, อู่ซ่อมบำรุง, WMS",
    );
  });

  it("uses three users for legacy quotations without a saved count", () => {
    expect(includedUserCount(null)).toBe(3);
    expect(includedUserCount(0)).toBe(3);
    expect(includedUserCount(8)).toBe(8);
  });
});
