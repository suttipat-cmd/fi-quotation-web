# FI Quotation Web App v1.10.2

## v1.10.2 Google Drive PDF Archive

Release นี้ต่อยอดจาก v1.10.1 โดยเพิ่มความสามารถบันทึก PDF ใบเสนอราคาไปยัง Google Drive ผ่าน Google Apps Script Web App พร้อมบันทึก log ลง Supabase และป้องกันการบันทึกซ้ำ 1 ใบเสนอราคา = 1 ไฟล์ PDF

## สิ่งที่เพิ่มใน v1.10.2

- อัปเดต cache busting เป็น `style.css?v=1.10.2` และ `script.js?v=1.10.2`
- อัปเดต `window.FI_APP_VERSION = "1.10.2"`
- เพิ่ม section `Google Drive Archive` ในเมนู `ตั้งค่า`
  - Google Apps Script Web App URL
  - Google Drive Parent Folder ID
  - Shared Secret / Upload Token
  - ปุ่มบันทึกการตั้งค่า
  - ปุ่มทดสอบการเชื่อมต่อ
- เพิ่มปุ่ม `บันทึกไป Google Drive` ในหน้า Preview / Print
- ถ้าใบเสนอราคาถูกบันทึก Drive แล้ว จะแสดงปุ่ม `เปิดไฟล์ใน Google Drive` แทน
- บังคับระดับ DB ด้วย `quotation_id UNIQUE` เพื่อให้ 1 ใบเสนอราคาบันทึก Drive ได้ 1 ครั้ง
- Apps Script จะสร้าง folder ย่อยของ Sales ภายใต้ Parent Folder:

```text
Parent Folder
└── ชื่อ Sales - email
    └── เลขที่ใบเสนอราคา (สินค้า/บริการ).pdf
```

- เพิ่มไฟล์ `google-apps-script/Code.gs`
- เพิ่ม SQL patch `supabase/patch_v1_10_2.sql`

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
  patch_v1_10_2.sql
  reset_usage_data_keep_master.sql
```

## ขั้นตอนติดตั้ง v1.10.2

### 1) รัน SQL ใน Supabase

เปิด Supabase SQL Editor แล้วรัน:

```text
supabase/patch_v1_10_2.sql
```

Patch นี้จะสร้าง/เตรียม:

```text
app_settings
quotation_drive_files
RLS policies
quotation_id UNIQUE
```

### 2) สร้าง Google Apps Script Web App

1. ไปที่ Google Apps Script
2. สร้าง Project ใหม่
3. สร้าง/เปิดไฟล์ `Code.gs`
4. Copy เนื้อหาจาก `google-apps-script/Code.gs` ไปวาง
5. ตั้งค่า Script Property:

```text
UPLOAD_SECRET = ค่าเดียวกับที่จะกรอกในหน้า Settings ของเว็บ
```

6. Deploy > New deployment > Web app
7. ตั้งค่า:

```text
Execute as: Me
Who has access: Anyone with the link
```

8. Copy Web App URL ที่ลงท้าย `/exec`

### 3) ตั้งค่าในเว็บ

Login ด้วย Admin แล้วเข้า:

```text
ตั้งค่า > Google Drive Archive
```

กรอก:

```text
Google Apps Script Web App URL
Google Drive Parent Folder ID
Shared Secret / Upload Token
```

จากนั้นกด:

```text
บันทึกการตั้งค่า Drive
ทดสอบการเชื่อมต่อ
```

### 4) ติดตั้งไฟล์เว็บ

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. เปิด Live Server หรือ GitHub Pages แล้วทำ hard refresh

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
git commit -m "Release v1.10.2 google drive pdf archive"
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
1.10.2
```

## Debug helper

```js
await window.FI_DEBUG()
```

ควรเห็นค่าประมาณนี้:

```text
version: 1.10.2
googleDriveArchive: true
googleDriveSettingsInSettingsPage: true
onePdfPerQuotation: true
appsScriptIframePost: true
sqlChanged: true
```

## ข้อควรทราบ

- การ upload ไป Apps Script ใช้ hidden iframe form post เพื่อหลีกเลี่ยงปัญหา CORS ของ Google Apps Script
- Shared Secret ใน GitHub Pages ไม่ใช่ secret ระดับ backend ใช้ป้องกัน request มั่วระดับพื้นฐาน
- หากบันทึก Drive สำเร็จแล้ว ระบบจะไม่ให้บันทึกซ้ำ แต่จะแสดงปุ่ม `เปิดไฟล์ใน Google Drive`
