import { SOFTWARE_SERVICE_LABEL } from "../constants";

export const documentServiceName = (value?: string) => {
  if (!value || value === "ค่าบริการประจำ" || value === "ค่าบริการซอฟแวร์ระบบ" || value === "ค่าบริการซอฟแวร์") {
    return SOFTWARE_SERVICE_LABEL;
  }
  return value;
};

export const documentAddonName = (value: string) =>
  value === "ซ่อมบำรุง" ? "อู่ซ่อมบำรุง" : value;
