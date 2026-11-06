export const money = (value = 0) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((value || 0) / 100);

export const fromBaht = (value: string | number) =>
  Math.round(Number(value || 0) * 100);

export const toBaht = (value = 0) => ((value || 0) / 100).toFixed(2);

export const displayDate = (value?: string) => {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}-${month}-${year}` : "—";
};

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const today = () => localDate(new Date());

export const plusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDate(date);
};

export function thaiBaht(value: number) {
  if (!value) return "ศูนย์บาทถ้วน";
  const digits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  const speak = (number: number): string => {
    if (!number) return "";
    const chunk = number % 1000000;
    let output = number >= 1000000 ? `${speak(Math.floor(number / 1000000))}ล้าน` : "";
    String(chunk).padStart(6, "0").split("").forEach((char, index) => {
      const digit = Number(char);
      const position = 5 - index;
      if (!digit) return;
      output += position === 1 && digit === 1
        ? "สิบ"
        : position === 1 && digit === 2
          ? "ยี่สิบ"
          : position === 0 && digit === 1 && chunk > 1
            ? "เอ็ด"
            : `${digits[digit]}${units[position]}`;
    });
    return output;
  };
  const baht = Math.floor(value / 100);
  const satang = value % 100;
  return `${speak(baht)}บาท${satang ? `${speak(satang)}สตางค์` : "ถ้วน"}`;
}
