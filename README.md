# FI Quotation Web App v1.9.1

## v1.9.1 Foundation Stabilization

Release นี้ต่อยอดจาก v1.9.0 โดยแก้จุดติดตั้งและเสถียรภาพที่ยังเสี่ยง โดยเฉพาะ SQL patch dependency, error guard, debug helper และ release quality gate

ไฟล์ฐานที่ใช้คือ v1.9.0 ที่ `index.html` เดิมโหลด `style.css?v=1.9.0` และ `script.js?v=1.9.0` และ README ระบุว่า v1.9.0 เป็น Clean Codebase Stabilization

## สิ่งที่ปรับใน v1.9.1

- อัปเดต cache busting เป็น `style.css?v=1.9.1` และ `script.js?v=1.9.1`
- อัปเดต `window.FI_APP_VERSION = "1.9.1"`
- เพิ่ม `supabase/patch_v1_9_1.sql` ที่แก้ลำดับ dependency ของ policy/function ให้ถูกต้อง
- แก้ error message สำหรับ RLS / permission / missing DB function ให้บอกชัดว่าต้องรัน patch ใด
- เพิ่ม `window.FI_DEBUG()` สำหรับตรวจสถานะระบบโดยไม่แสดง secret
- เพิ่ม `RELEASE_CHECKLIST.md`
- เพิ่ม `supabase/README_SQL.md`
- เพิ่ม `scripts/check-release.js` สำหรับตรวจ release ก่อน push

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
```

## วิธีติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. ไปที่ Supabase → SQL Editor
4. รันไฟล์ `supabase/patch_v1_9_1.sql`
5. เปิด Live Server ทดสอบก่อน push

## ตรวจ release ก่อน push

เปิด VS Code Terminal แล้วรัน:

```bash
node scripts/check-release.js
```

จากนั้นเช็ก syntax:

```bash
node --check script.js
```

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Hotfix v1.9.1 foundation stabilization"
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
1.9.1
```

## Debug helper

ใน Console สามารถรัน:

```js
await window.FI_DEBUG()
```

ข้อมูลที่แสดงจะมี version, route, auth state, role และ session presence โดยไม่แสดง access token หรือ anon key
