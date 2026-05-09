# FI Quotation Web App v1.10.3

## v1.10.3 Drive PDF Rendering Fix

Release นี้ต่อยอดจาก v1.10.2 เพื่อแก้ปัญหา PDF ที่บันทึกลง Google Drive แล้วหน้าตาไม่เหมือน PDF ที่ผู้ใช้กดพิมพ์/บันทึกจากหน้าเว็บเอง

## สาเหตุที่แก้ใน v1.10.3

ใน v1.10.2 ระบบส่ง HTML ไปให้ Google Apps Script แปลงเป็น PDF ทำให้ผลลัพธ์ต่างจาก Chrome Save as PDF เช่น ฟอนต์ไทย, โลโก้, spacing, line-height และ page layout

v1.10.3 เปลี่ยน flow เป็น:

```text
Browser สร้าง PDF จากหน้าเอกสารจริง
↓
ส่ง PDF base64 ไป Google Apps Script
↓
Apps Script บันทึก PDF blob ลง Google Drive
```

ดังนั้น Apps Script จะไม่แปลง HTML เป็น PDF สำหรับ upload ใหม่แล้ว

## สิ่งที่เปลี่ยนใน v1.10.3

- อัปเดต cache busting เป็น `style.css?v=1.10.3` และ `script.js?v=1.10.3`
- อัปเดต `window.FI_APP_VERSION = "1.10.3"`
- เพิ่ม CDN library สำหรับสร้าง PDF ฝั่ง Browser:
  - `html2canvas@1.4.1`
  - `jsPDF@2.5.1`
- ปรับปุ่ม `บันทึกไป Google Drive` ให้สร้าง PDF จากหน้าเอกสารจริงใน Browser ก่อน upload
- ปรับ `google-apps-script/Code.gs` ให้รับ `pdfBase64` แล้วบันทึกเป็น PDF blob ลง Google Drive โดยตรง
- คงหลักการเดิม: 1 ใบเสนอราคา = 1 ไฟล์ PDF ใน Google Drive
- คงชื่อไฟล์เดิม: `เลขที่ใบเสนอราคา (สินค้า/บริการ).pdf`
- ไม่มี SQL ใหม่ใน v1.10.3

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
  patch_v1_10_2.sql
  reset_usage_data_keep_master.sql
  ...patch เก่าที่ใช้ตั้งค่าระบบ
```

## ขั้นตอนติดตั้ง v1.10.3

### 1) ติดตั้งไฟล์เว็บ

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. เปิด Live Server หรือ GitHub Pages แล้วทำ hard refresh

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

### 2) ไม่ต้องรัน SQL ใหม่

ถ้าเคยรัน `supabase/patch_v1_10_2.sql` สำเร็จแล้ว รอบนี้ไม่ต้องรัน SQL เพิ่ม

### 3) อัปเดต Google Apps Script

ต้องอัปเดต Apps Script เป็น v1.10.3 เพราะ payload เปลี่ยนจาก HTML เป็น PDF base64

1. เปิด Google Apps Script Project เดิมที่ใช้กับระบบนี้
2. เปิดไฟล์ `Code.gs`
3. Copy เนื้อหาจากไฟล์นี้ไปวางทับ:

```text
google-apps-script/Code.gs
```

4. ตรวจ Script Property ว่ายังมีค่า:

```text
UPLOAD_SECRET = ค่าเดียวกับในหน้า Settings ของเว็บ
```

5. Deploy > Manage deployments > Edit deployment
6. เลือก version ใหม่ แล้วกด Deploy
7. ใช้ Web App URL เดิมได้ ถ้า deploy เป็น deployment เดิม

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
git commit -m "Release v1.10.3 drive pdf rendering fix"
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
1.10.3
```

## Debug helper

```js
await window.FI_DEBUG()
```

ควรเห็นค่าประมาณนี้:

```text
version: 1.10.3
drivePdfRenderMode: browser-pdf-base64
appsScriptSavesPdfBlobOnly: true
sqlChanged: false
```

## จุดที่ต้องทดสอบทันที

```text
1. เปิดหน้า Preview / Print ของใบเสนอราคาที่ยืนยันแล้ว
2. กด พิมพ์ / บันทึกเป็น PDF แล้วบันทึกไฟล์เองไว้ 1 ไฟล์
3. กด บันทึกไป Google Drive
4. เปิดไฟล์จากปุ่ม เปิดไฟล์ใน Google Drive
5. เทียบไฟล์จากข้อ 2 กับข้อ 4 ว่า layout ใกล้เคียงกันมากขึ้น
6. ตรวจว่าโลโก้แสดงถูกต้อง
7. ตรวจว่าฟอนต์ไทย/ระยะบรรทัด/ตารางไม่เพี้ยนแบบ v1.10.2
8. ตรวจว่าใบเดิมบันทึกซ้ำไม่ได้เหมือนเดิม
```

## ข้อควรทราบ

- PDF ที่ upload ไป Drive ใน v1.10.3 เป็น PDF ที่สร้างจากการ capture หน้าเอกสารใน Browser เป็นภาพลง PDF จึงเน้นความเหมือนด้านหน้าตาเป็นหลัก
- Text ใน PDF ที่บันทึกเข้า Drive อาจไม่ selectable 100% เหมือน PDF ที่ Chrome Save as PDF สร้างเอง
- หากต้องการให้เหมือน Chrome Save as PDF แบบเกือบ 100% และ text selectable ควรใช้ backend ที่รัน Headless Chrome เช่น Puppeteer/Playwright ในอนาคต
- ไม่มี `supabase/patch_v1_10_3.sql`
