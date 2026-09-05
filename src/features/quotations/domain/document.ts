import { SOFTWARE_SERVICE_LABEL } from "../constants";

export const documentServiceName = (value?: string) => {
  if (!value || value === "ค่าบริการประจำ" || value === "ค่าบริการซอฟแวร์ระบบ" || value === "ค่าบริการซอฟแวร์") {
    return SOFTWARE_SERVICE_LABEL;
  }
  return value;
};

export const documentAddonName = (value: string) =>
  value === "ซ่อมบำรุง" ? "อู่ซ่อมบำรุง" : value;

export const softwareServiceTitle = (addons: string[] = []) => {
  const mainServices = addons.map(documentAddonName).filter(Boolean).join(", ");
  return mainServices ? `${SOFTWARE_SERVICE_LABEL} ${mainServices}` : SOFTWARE_SERVICE_LABEL;
};

// Quotations created before this field was exposed may not have a value.  Keep
// their rendered document consistent with the new default without overwriting
// an explicitly saved positive value.
export const includedUserCount = (value?: number | null) =>
  Number.isFinite(value) && Number(value) > 0 ? Number(value) : 3;
