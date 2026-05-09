# FI Quotation Web App v1.10.0

## v1.10.0 Mobile UX Audit + Clean Quotation Print Layout

Release นี้ต่อยอดจาก v1.9.9 โดยโฟกัสเฉพาะ Mobile UX และรูปแบบใบเสนอราคา ไม่เปลี่ยน SQL/RLS และไม่เปลี่ยน business logic เดิม

## สิ่งที่แก้ใน v1.10.0

- อัปเดต cache busting เป็น `style.css?v=1.10.0` และ `script.js?v=1.10.0`
- อัปเดต `window.FI_APP_VERSION = "1.10.0"`
- ตรวจและปรับ Mobile UX เพิ่มเติม โดยเฉพาะหน้า `สินค้า/บริการ`
- หน้า `สินค้า/บริการ` บนมือถือแสดงเป็น Product Card View ที่อ่านง่ายขึ้น
  - แสดงรหัสสินค้า/บริการ
  - ชื่อสินค้า/บริการ
  - รายละเอียด
  - หน่วย
  - สถานะ
  - ปุ่มแก้ไขสำหรับ Admin
- เพิ่มช่องค้นหาและกรองสถานะในหน้า `สินค้า/บริการ`
- เพิ่มปุ่ม `บัญชี` บนมือถือ ทั้งที่ header และ bottom navigation
- เพิ่ม Mobile Account Sheet สำหรับมือถือ
  - แสดงชื่อผู้ใช้
  - แสดง role
  - ไปหน้า Settings
  - ไปหน้า Company Profile
  - ออกจากระบบ
- ปรับ pagination/filter/action บนมือถือให้อ่านและกดง่ายขึ้น
- ปรับรูปแบบใบเสนอราคาเป็น Clean Corporate Layout
  - ลดกรอบที่ไม่จำเป็น
  - คงเส้นตารางหลักไว้เพื่ออ่านรายการสินค้า/บริการ
  - เปลี่ยนหมายเหตุ/เงื่อนไข/บัญชีธนาคารเป็น block พื้นหลังอ่อนพร้อมเส้นซ้าย
  - ลายเซ็นใช้เส้นเซ็น ไม่เน้นกรอบกล่อง
- ไม่ต้องรัน SQL ใหม่

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
supabase/
  README_SQL.md
  patch_v1_7_2.sql
  patch_v1_8_0.sql
  patch_v1_9_0.sql
  patch_v1_9_1.sql
  patch_v1_9_2.sql
  patch_v1_9_3.sql
  patch_v1_9_4.sql
  patch_v1_9_5.sql
  patch_v1_9_7.sql
  patch_v1_9_8.sql
  patch_v1_9_9.sql
  patch_v1_10_0.sql
  reset_usage_data_keep_master.sql
```

## วิธีติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. รอบนี้ไม่ต้องรัน SQL ใหม่
4. เปิด Live Server หรือ GitHub Pages แล้วทำ hard refresh

## ตรวจ release ก่อน push

ถ้าเครื่องมี Node.js ให้รัน:

```bash
node scripts/check-release.js
node --check script.js
```

ถ้ายังไม่ได้ติดตั้ง Node.js สามารถข้าม local check แล้วตรวจบน GitHub Pages ด้วย Console แทนได้

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Release v1.10.0 mobile ux clean print layout"
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
1.10.0
```

## Debug helper

```js
await window.FI_DEBUG()
```

ควรเห็นค่าประมาณนี้:

```text
version: 1.10.0
mobileUxAudit: true
mobileAccountMenu: true
mobileProductsCardView: true
cleanCorporatePrintLayout: true
sqlChanged: false
```
