# FI Quotation Web App v1.10.1

## v1.10.1 Mobile Menu Cleanup + Suggested PDF Filename

Release นี้ต่อยอดจาก v1.10.0 โดยโฟกัสเฉพาะการลดความแออัดของเมนูบนมือถือ และปรับชื่อไฟล์เริ่มต้นตอนบันทึกใบเสนอราคาเป็น PDF ไม่เปลี่ยน SQL/RLS และไม่เปลี่ยน business logic เดิม

## สิ่งที่แก้ใน v1.10.1

- อัปเดต cache busting เป็น `style.css?v=1.10.1` และ `script.js?v=1.10.1`
- อัปเดต `window.FI_APP_VERSION = "1.10.1"`
- บนมือถือซ่อนเมนูรองจากแถบเมนูหลัก:
  - `ข้อมูลบริษัท / Company Profile`
  - `ตั้งค่า / Settings`
- ยังสามารถเข้า `ข้อมูลบริษัท` และ `ตั้งค่า` ได้จากเมนู `บัญชี` เหมือนเดิม
- Desktop ยังแสดงเมนู `ข้อมูลบริษัท` และ `ตั้งค่า` ตามเดิม
- ปุ่ม `พิมพ์ / บันทึกเป็น PDF` จะตั้งชื่อเอกสารชั่วคราวก่อนเปิด print dialog เพื่อให้ Chrome/Edge ใช้เป็นชื่อไฟล์เริ่มต้นตอน Save as PDF
- รูปแบบชื่อไฟล์ที่แนะนำ:

```text
เลขที่ใบเสนอราคา (สินค้า/บริการ)
```

ตัวอย่าง:

```text
QT-2026-0001 (ค่าบริการระบบ GPS)
```

หมายเหตุ: ระบบใช้ browser print / Save as PDF ดังนั้นไม่สามารถบังคับชื่อไฟล์ได้ 100% ทุก browser แต่การตั้ง `document.title` ก่อน `window.print()` จะช่วยให้ browser หลักใช้ชื่อไฟล์ที่ต้องการเป็นค่าเริ่มต้น

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
  patch_v1_10_1.sql
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
git commit -m "Release v1.10.1 mobile menu pdf filename"
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
1.10.1
```

## Debug helper

```js
await window.FI_DEBUG()
```

ควรเห็นค่าประมาณนี้:

```text
version: 1.10.1
mobileSecondaryMenuHidden: true
suggestedPdfFilename: true
sqlChanged: false
```
