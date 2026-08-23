import type { QuoteStatus } from "./types";

export const PAYMENT_OPTIONS = [
  "ค่าบริการชำระรายเดือน",
  "ค่าบริการชำระราย 6 เดือน",
  "ค่าบริการชำระรายปี",
] as const;

export const SOFTWARE_SERVICE_LABEL = "ค่าบริการซอฟต์แวร์";
export const SETUP_LABEL = "Setup";
export const SETUP_CHILD_SERVICES = ["Setup ทะเบียนรถ", "Setup ข้อมูลทั่วไป"];
export const CUSTOM_FORM_LABEL = "Custom Form";
export const ONSITE_TRAINING_LABEL = "Onsite Training";

export const COMPANY_DOCUMENT_CONFIG = {
  name: "บริษัท ฟอร์เวิร์ด อินไซต์ จำกัด",
  addressLine1: "38 ซอย เฉลิมพระเกียรติ ร.9 ซ.42 ถนนเฉลิมพระเกียรติ ร.9",
  addressLine2: "แขวงหนองบอน เขตประเวศ กรุงเทพมหานคร 10250",
  taxId: "0105565050099/สำนักงานใหญ่",
  payment:
    "ชื่อบัญชี บริษัท ฟอร์เวิร์ด อินไซต์ จำกัด\nธ.ไทยพาณิชย์ (SCB) 015-465-8438",
} as const;

export const DEFAULT_PAYMENT_TERMS =
  "1. ค่าใช้โปรแกรมประเภทรายเดือน ชำระค่าใช้โปรแกรม ทุกวันที่ 1 ของเดือน โดยเริ่มชำระเมื่อทำการย้ายข้อมูล\n2. ค่านำข้อมูลเดิมเข้าในระบบใหม่และค่าฝึกอบรม ชำระ 100% เมื่อทำสัญญา (ค่าแรกเข้า)";

export const STATUS_TEXT: Record<QuoteStatus, string> = {
  DRAFT: "ฉบับร่าง",
  READY: "ยืนยันแล้ว",
  ACCEPTED: "ตอบรับแล้ว",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิก",
};

export const CANCELLATION_REASONS = [
  "ลูกค้าปฏิเสธข้อเสนอ",
  "ลูกค้าเลื่อนหรือยกเลิกโครงการ",
  "ข้อมูลในเอกสารไม่ถูกต้อง",
  "ออกใบเสนอราคาซ้ำ",
  "อื่น ๆ",
] as const;
