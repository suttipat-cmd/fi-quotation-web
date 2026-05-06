# FI Quotation Web App v1.1

ระบบสร้างและจัดการใบเสนอราคา ด้วย GitHub Pages + Supabase

## สิ่งที่เพิ่มใน v1.1

- รีดีไซน์ UI ทั้งระบบเป็น Top Navigation ภาษาไทย
- เมนูย่อได้บนหน้าจอแคบด้วยปุ่มเมนู
- ตัดคำอธิบายหน้าเว็บที่ไม่จำเป็นออก
- ปรับ spacing, table, form, card, button และ status badge ให้เป็น design language เดียวกัน
- เพิ่ม loading state แบบ skeleton และ button loading
- เพิ่ม toast แบบ success / error / warning / info
- เพิ่ม guard ลดปัญหากด action ซ้ำและ session ไม่พร้อม
- เปลี่ยน Company Logo จาก URL เป็น Upload ไฟล์ JPG/PNG ผ่าน Supabase Storage
- เพิ่ม SQL patch สำหรับ bucket `company-assets`

## วิธีติดตั้ง

1. Copy `index.html`, `style.css`, `script.js` ไปทับใน repo `fi-quotation-web`
2. Copy โฟลเดอร์ `supabase` ไปไว้ใน repo
3. ไปที่ Supabase SQL Editor แล้วรัน `supabase/patch_v1_1.sql`
4. เปิด Live Server ทดสอบก่อน push
5. Commit และ Push ขึ้น GitHub Pages

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Release v1.1 UX refresh and stability"
git push origin main
```

## ทดสอบหลักหลังติดตั้ง

- Login / Logout
- Top navigation และเมนูย่อบนจอแคบ
- Dashboard โหลดข้อมูลโดยไม่ต้อง refresh
- รายการใบเสนอราคา ค้นหา กรอง และเปิด detail
- สร้าง Draft / แก้ Draft / บันทึก / Confirm / Sent / Duplicate
- Company Profile upload logo JPG/PNG แล้วแสดงในหน้า Print
- Toast และ loading แสดงทุกจุดสำคัญ

## Security Notes

- ใช้เฉพาะ Supabase anon public key ใน frontend
- ห้ามใส่ service_role key ใน `script.js`
- Logo upload ใช้ Supabase Storage bucket `company-assets`
- จำกัด upload เฉพาะ Admin ผ่าน Storage policy
