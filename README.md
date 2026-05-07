# FI Quotation Web App v1.5

## v1.5 Print Layout Redesign

Release นี้ปรับหน้า Preview / Print ใบเสนอราคาใหม่ตามแนวทาง Modern Compact Hybrid โดยเน้นให้ลูกค้าแยกดูยอดชำระได้ชัดเจน:

- ตารางค่าบริการใช้งานรายเดือน / รายปี มีสรุปยอดของตัวเอง
- ตารางค่าบริการครั้งเดียว / ค่าแรกเข้า มีสรุปยอดของตัวเอง
- แต่ละตารางแสดง VAT, หัก ณ ที่จ่าย, ยอดรวมสุทธิ และจำนวนเงินตัวอักษรแยกกัน
- เพิ่มยอดรวมทั้งฉบับแบบย่อเฉพาะกรณีมีมากกว่า 1 section
- ปรับ CSS Print A4 ให้ compact ขึ้น และลดปัญหาหน้า 2 ว่าง
- เพิ่ม Smart Compact Mode เพื่อช่วยบีบ spacing เมื่อเนื้อหาเกือบเกิน 1 หน้า
- มี SQL RPC ใหม่ `calculate_quotation_section_totals` สำหรับคำนวณยอดแยก section ฝั่ง Database
- Frontend มี fallback calculation หากยังไม่ได้รัน SQL แต่แนะนำให้รัน patch เพื่อความแม่นยำของจำนวนเงินตัวอักษร

## ไฟล์ใน package

```text
index.html
style.css
script.js
README.md
TEST_CHECKLIST.md
supabase/patch_v1_5.sql
```

## วิธีติดตั้ง

1. Copy ไฟล์ทั้งหมดไปทับใน repo `fi-quotation-web`
2. ไปที่ Supabase → SQL Editor
3. รันไฟล์นี้:

```text
supabase/patch_v1_5.sql
```

4. เปิด Live Server แล้วทดสอบหน้า Preview / Print
5. ถ้าผ่านแล้ว push ขึ้น GitHub Pages

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Release v1.5 print layout redesign"
git push origin main
```

## หมายเหตุสำคัญ

- v1.5 ไม่เปลี่ยน flow สร้าง Draft / Confirm / Sent / Paid
- v1.5 กระทบหลัก ๆ ที่หน้า Preview / Print และ SQL RPC สำหรับยอดแยก section
- ถ้า one-time subtotal เป็น 0 ระบบจะไม่แสดง section ค่าแรกเข้าในหน้า Print เพื่อลดความยาวเอกสาร
- ยอดในแต่ละ section ใช้สำหรับสื่อสารการชำระเงินแยกกัน โดยยอดรวมทั้งฉบับเป็นภาพรวมเท่านั้น
