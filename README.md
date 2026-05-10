# FI Quotation Web App v1.11.5

## v1.11.5 Payment Modal UX + Paid Delivery Status Fix

Release นี้ต่อยอดจาก v1.11.4 โดยปรับหน้าตา modal กรอกข้อมูลชำระเงินให้เป็นรูปแบบเดียวกับ modal ข้อมูลการส่งใบเสนอราคา และแก้ข้อความสถานะในหน้า `#quotation-print` เมื่อใบเสนอราคาอยู่สถานะ `ชำระเงินแล้ว` ให้ไม่แสดงข้อความว่า “บันทึกข้อมูลผู้รับแล้ว แต่ยังไม่ได้ส่งอีเมล”

## สิ่งที่เปลี่ยนใน v1.11.5

- อัปเดต cache busting เป็น `style.css?v=1.11.5` และ `script.js?v=1.11.5`
- อัปเดต `window.FI_APP_VERSION = "1.11.5"`
- ปรับ modal เปลี่ยนสถานะเป็น `ชำระเงินแล้ว`
  - ใช้ layout แบบเดียวกับ modal ข้อมูลการส่งใบเสนอราคา
  - แยก section เป็น `วันที่ชำระเงิน`, `ยอดที่ได้รับชำระ`, และ `หมายเหตุ`
  - ตัวเลือกยอดรับชำระแสดงเป็น card อ่านง่ายขึ้น
  - ยังคงบังคับให้เลือกอย่างน้อย 1 ส่วนก่อนบันทึก
- แก้ logic แสดงข้อมูลการส่งในหน้า `#quotation-print`
  - ถ้าสถานะเป็น `ชำระเงินแล้ว` ให้ถือว่า workflow การส่งอีเมลเสร็จแล้ว
  - แสดงข้อความ `ส่งอีเมลแล้ว และบันทึกสถานะชำระเงินแล้ว`
  - ไม่แสดงข้อความ `บันทึกข้อมูลผู้รับแล้ว แต่ยังไม่ได้ส่งอีเมล` สำหรับใบที่ชำระเงินแล้ว
- ไม่เปลี่ยน Database และไม่เปลี่ยน Google Apps Script จาก v1.11.4

## ไฟล์ใน package

```text
index.html
style.css
script.js
README.md
TEST_CHECKLIST.md
RELEASE_CHECKLIST.md
scripts/
  check-release.js
google-apps-script/
  Code.gs
supabase/
  patch_v1_11_4.sql
  patch_v1_11_3.sql
  patch_v1_10_2.sql
  patch_v1_10_4.sql
  reset_usage_data_keep_master.sql
  README_SQL.md
  ...patch เก่าที่ใช้ตั้งค่าระบบ
```

## ขั้นตอนติดตั้ง v1.11.5

### 1) ติดตั้งไฟล์เว็บ

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. เปิด Live Server หรือ GitHub Pages แล้วทำ hard refresh

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

### 2) SQL

รอบนี้ **ไม่ต้องรัน SQL ใหม่**

ต้องเคยรัน SQL เหล่านี้สำเร็จแล้วจากเวอร์ชันก่อนหน้า:

```text
supabase/patch_v1_10_2.sql
supabase/patch_v1_10_4.sql
supabase/patch_v1_11_3.sql
supabase/patch_v1_11_4.sql
```

### 3) Google Apps Script

รอบนี้ **ไม่ต้องอัปเดต Google Apps Script ใหม่** หากใช้งาน v1.11.4 อยู่แล้ว

ยังต้องเคยทำขั้นตอนนี้จาก v1.11.4 แล้ว:

```text
Run function authorizeEmailV1114 ใน Apps Script Editor
Deploy Web App version ใหม่
```

## ตรวจ release ก่อน push

ถ้าเครื่องมี Node.js ให้รัน:

```bash
node scripts/check-release.js
node --check script.js
```

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Release v1.11.5 payment modal ux"
git push origin main
```

## หลัง Push ขึ้น GitHub Pages

ทำ hard refresh:

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

## ตรวจเวอร์ชันใน Console

```js
window.FI_APP_VERSION
```

ต้องได้:

```text
1.11.5
```

## จุดที่ต้องทดสอบทันที

```text
1. เปิดใบเสนอราคาสถานะส่งแล้ว
2. กดปุ่มชำระเงินแล้ว
3. Modal ชำระเงินต้องมี layout ใหม่ อ่านง่าย และคล้าย modal ข้อมูลการส่งใบเสนอราคา
4. เลือกยอดรับชำระเฉพาะรายเดือน/รายปีได้
5. เลือกยอดรับชำระเฉพาะครั้งเดียวจบได้
6. เลือกทั้งคู่ได้
7. ไม่เลือกอะไรเลยต้องบันทึกไม่ได้
8. บันทึกแล้วสถานะต้องเป็นชำระเงินแล้ว
9. หน้า #quotation-print ของใบสถานะชำระเงินแล้ว ต้องไม่แสดงว่า “บันทึกข้อมูลผู้รับแล้ว แต่ยังไม่ได้ส่งอีเมล”
10. หน้า #quotation-print ต้องแสดงว่าส่งอีเมลแล้วและชำระเงินแล้ว
11. Flow ส่งอีเมล / บันทึก PDF / Dashboard ยอดรับชำระเดือนนี้ ยังทำงานเหมือน v1.11.4
```
