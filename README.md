# FI Quotation Web App v1.6

## v1.6 Form UX + Product Code Rule + Excel Report + Reliability Fix

Release นี้ต่อยอดจาก v1.5.2 โดยเพิ่ม/แก้ตาม requirement ล่าสุด:

- ปรับ `*` ของ required fields ให้เป็นสีแดงทั่วระบบ
- เปลี่ยนกติกา Product Master:
  - รหัสสินค้า / Code สามารถซ้ำกันได้
  - ชื่อสินค้า/บริการต้องไม่ซ้ำกัน
- ปรับ Excel Export เป็นรายงานหลายชีต:
  - `Summary`
  - `Quotations`
  - `Items`
  - `By Sales`
  - `By Status`
- Excel report แยกยอดรายเดือน/รายปี และยอดครั้งเดียว
- เพิ่ม loading watchdog และ retry state เพื่อลดปัญหาเปิดเว็บอื่นแล้วกลับมาเว็บตัวเองแล้ว loading ค้าง
- ปรับ resume recovery ให้ตรวจ session, re-render หน้าเดิม และไม่ค้างอยู่ที่ loading ตลอด

## ไฟล์ใน package

```text
index.html
style.css
script.js
README.md
TEST_CHECKLIST.md
supabase/patch_v1_5.sql
supabase/patch_v1_5_1.sql
supabase/patch_v1_6.sql
```

## วิธีติดตั้ง

1. Copy ไฟล์ทั้งหมดไปทับใน repo `fi-quotation-web`
2. ไปที่ Supabase → SQL Editor
3. รัน SQL ตามลำดับ:

```text
supabase/patch_v1_6.sql
```

> ถ้ายังไม่เคยรัน v1.5 / v1.5.1 มาก่อน ให้รัน `patch_v1_5.sql` และ `patch_v1_5_1.sql` ก่อน แล้วค่อยรัน `patch_v1_6.sql`

## หมายเหตุ SQL v1.6

`patch_v1_6.sql` จะลบ unique constraint/index ที่บังคับให้ `products.code` ห้ามซ้ำ และเพิ่ม unique index ใหม่ที่ `lower(trim(products.name))`

ถ้าในฐานข้อมูลมีชื่อสินค้า/บริการซ้ำอยู่แล้ว SQL จะหยุดพร้อม error ให้แก้ชื่อซ้ำก่อน แล้วค่อยรันใหม่

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Release v1.6 form UX product code and Excel report"
git push origin main
```

## จุดที่ควรทดสอบ

- Required `*` ในฟอร์มแสดงเป็นสีแดง
- เพิ่มสินค้าใหม่ด้วย Code ซ้ำได้ ถ้าชื่อสินค้าไม่ซ้ำ
- เพิ่มสินค้าใหม่ด้วยชื่อซ้ำไม่ได้
- Export Excel ต้องเป็น `.xlsx` และมี 5 sheets
- Excel Sheet `Quotations` ต้องมียอดรายเดือน/รายปี และยอดครั้งเดียว
- Excel Sheet `Items` ต้องมีรายการสินค้าแยกบรรทัด
- สลับไปเว็บอื่นแล้วกลับมา ถ้าโหลดค้างต้องแสดงปุ่มโหลดใหม่ ไม่ต้องรีเฟรช browser
