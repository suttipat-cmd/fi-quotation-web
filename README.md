# FI Quotation Web App v1.11.3

## v1.11.3 Email Sending Workflow

Release นี้ต่อยอดจาก v1.11.2 โดยเพิ่ม workflow ส่งอีเมลใบเสนอราคาผ่าน Google Apps Script หลังจากบันทึก PDF ลง Google Drive แล้ว พร้อมแยกปุ่มในหน้าข้อมูลการส่งเป็น “บันทึก” และ “บันทึกและส่งอีเมล”

## สิ่งที่เปลี่ยนใน v1.11.3

- อัปเดต cache busting เป็น `style.css?v=1.11.3` และ `script.js?v=1.11.3`
- อัปเดต `window.FI_APP_VERSION = "1.11.3"`
- ปรับ Modal “ข้อมูลการส่งใบเสนอราคา”
  - ปุ่ม `บันทึก` = บันทึกข้อมูลผู้รับ แต่ยังไม่ส่งอีเมล และยังไม่เปลี่ยนสถานะเป็นส่งแล้ว
  - ปุ่ม `บันทึกและส่งอีเมล` = บันทึกข้อมูลผู้รับ ส่งอีเมลแนบ PDF และเปลี่ยนสถานะเป็นส่งแล้วเมื่อส่งสำเร็จ
- รองรับการกรอกอีเมลผู้รับหลายรายการ
  - คั่นด้วย comma, semicolon หรือขึ้นบรรทัดใหม่
- เพิ่มการตั้งค่า Email ในเมนู `ตั้งค่า`
  - Fixed CC Email
  - เบอร์โทรศัพท์ผู้ใช้งานปัจจุบัน
- ตอนส่งอีเมล ระบบจะใช้ CC = Fixed CC + อีเมลฝ่ายขายเจ้าของใบเสนอราคา
- เพิ่ม Google Apps Script action `sendEmail`
  - ใช้ PDF ที่บันทึกใน Google Drive เป็น attachment
  - ส่งอีเมลด้วย GmailApp
- เพิ่ม SQL patch `supabase/patch_v1_11_3.sql`
  - เพิ่ม `profiles.phone`
  - เพิ่ม email audit fields ใน `quotations`
  - เพิ่ม RPC สำหรับบันทึกข้อมูลการส่งโดยไม่เปลี่ยนสถานะ
  - เพิ่ม RPC สำหรับบันทึกหลังส่งอีเมลสำเร็จและเปลี่ยนสถานะเป็น `sent`

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
  patch_v1_11_3.sql
  patch_v1_10_2.sql
  patch_v1_10_4.sql
  reset_usage_data_keep_master.sql
  README_SQL.md
  ...patch เก่าที่ใช้ตั้งค่าระบบ
```

## ขั้นตอนติดตั้ง v1.11.3

### 1) ติดตั้งไฟล์เว็บ

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. เปิด Live Server หรือ GitHub Pages แล้วทำ hard refresh

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

### 2) SQL

ต้องรัน SQL ใหม่สำหรับ v1.11.3:

```text
supabase/patch_v1_11_3.sql
```

ต้องเคยรัน SQL เหล่านี้สำเร็จแล้ว:

```text
supabase/patch_v1_10_2.sql
supabase/patch_v1_10_4.sql
```

### 3) Google Apps Script

ต้องอัปเดต Apps Script เพราะ v1.11.3 เพิ่ม action สำหรับส่งอีเมล

1. เปิด Google Apps Script Project เดิม
2. เปิด `Code.gs`
3. Copy โค้ดจาก `google-apps-script/Code.gs` ไปวางทับ
4. ตรวจว่า Script Property ยังมี `UPLOAD_SECRET` ตรงกับค่าในหน้า Settings ของเว็บ
5. Deploy > Manage deployments > Edit deployment
6. เลือก New version แล้วกด Deploy
7. ใช้ Web App URL เดิมได้ถ้า deploy ทับ deployment เดิม

### 4) ตั้งค่าอีเมลในระบบ

Login ด้วย Admin แล้วเข้า:

```text
ตั้งค่า > การส่งอีเมลใบเสนอราคา
```

กรอก:

```text
Fixed CC Email
เบอร์โทรศัพท์ผู้ใช้งานปัจจุบัน
```

หมายเหตุ: ถ้าใบเสนอราคาเป็นของฝ่ายขายคนอื่น ระบบจะใช้เบอร์จาก `profiles.phone` ของเจ้าของใบเสนอราคา กรุณาตรวจสอบให้มีข้อมูลก่อนส่งอีเมล

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
git commit -m "Release v1.11.3 email sending workflow"
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
1.11.3
```

## จุดที่ต้องทดสอบทันที

```text
1. รัน patch_v1_11_3.sql สำเร็จ
2. อัปเดตและ deploy Google Apps Script สำเร็จ
3. Settings ต้องมี section การส่งอีเมลใบเสนอราคา
4. Fixed CC รองรับหลายอีเมล
5. ข้อมูลการส่งใบเสนอราคาต้องรองรับอีเมลผู้รับหลายรายการ
6. กด “บันทึก” แล้วต้องบันทึกข้อมูลผู้รับแต่ยังไม่เปลี่ยนสถานะเป็นส่งแล้ว
7. กด “บันทึกและส่งอีเมล” แล้วต้องส่งอีเมลพร้อมแนบ PDF จาก Google Drive
8. Email To ต้องมาจาก field อีเมลผู้รับ
9. Email CC ต้องเป็น Fixed CC + email ฝ่ายขายเจ้าของใบเสนอราคา
10. ส่งอีเมลสำเร็จแล้วสถานะต้องเป็น “ส่งแล้ว”
11. PDF ที่แนบต้องเป็นไฟล์เดียวกับที่บันทึกไว้ใน Google Drive
12. ถ้าไม่มี profiles.phone ของฝ่ายขาย ต้องแจ้งเตือนก่อนส่งอีเมล
```
