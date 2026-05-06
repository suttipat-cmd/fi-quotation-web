# FI Quotation Web App v1.0

ระบบสร้างและจัดการใบเสนอราคา ด้วย GitHub Pages + Supabase

## สิ่งที่รวมใน v1.0

- Login / Logout ผ่าน Supabase Auth
- Dashboard สำหรับ Sales / Manager / Admin
- รายการใบเสนอราคา พร้อมค้นหา กรอง และ Export CSV สำหรับเปิดใน Excel
- สร้าง Draft
- แก้ไข Draft
- Confirm เพื่อสร้างเลข QTN-YYMM-0001
- Mark as Sent
- Cancel Draft
- Duplicate เอกสารที่ Confirm แล้วเป็น Draft ใหม่
- Price Lookup จาก History
- Preview / Print ใบเสนอราคาแบบ A4
- Admin จัดการ Product / Service Master
- Admin แก้ไข Company Profile
- Settings พร้อม QA Checklist

## วิธีติดตั้ง

1. Copy `index.html`, `style.css`, `script.js` ไปทับใน repo `fi-quotation-web`
2. Copy โฟลเดอร์ `supabase` ไปไว้ใน repo
3. ไปที่ Supabase SQL Editor แล้วรัน `supabase/patch_v1_0.sql`
4. เปิด Live Server ทดสอบก่อน push
5. Commit และ Push ขึ้น GitHub Pages

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Release v1.0 consolidated quotation app"
git push origin main
```

## Security Notes

- ใช้ได้เฉพาะ Supabase anon public key ใน frontend
- ห้ามใส่ service_role key ใน `script.js`
- สิทธิ์จริงคุมด้วย Supabase RLS และ RPC
- Admin สร้าง user ผ่าน Supabase Dashboard ตาม Requirement ปัจจุบัน

## Recommended Test

ดู `TEST_CHECKLIST.md`
