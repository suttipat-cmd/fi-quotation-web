# FI Quotation Web App v1.10.4

## v1.10.4 Drive PDF Single Page Fix + Sent Workflow Gate

Release นี้ต่อยอดจาก v1.10.3 เพื่อแก้ปัญหา PDF ที่บันทึกลง Google Drive แล้วเกิดหน้าว่างเพิ่ม และปรับ workflow การเปลี่ยนสถานะเป็น “ส่งแล้ว” ให้รัดกุมขึ้น

## สิ่งที่เปลี่ยนใน v1.10.4

- อัปเดต cache busting เป็น `style.css?v=1.10.4` และ `script.js?v=1.10.4`
- อัปเดต `window.FI_APP_VERSION = "1.10.4"`
- แก้การสร้าง PDF สำหรับ Google Drive เพื่อลดโอกาสเกิดหน้าว่างท้ายไฟล์
  - lock capture กรณีเอกสารพอดี 1 หน้า A4
  - trim white space ด้านล่างของ canvas
  - skip trailing page ที่เกิดจาก rounding / blank area
- ตัดข้อความ technical ออกจาก UI ตอนบันทึก Drive
- เปลี่ยน workflow ส่งใบเสนอราคา
  - ต้องบันทึก PDF ลง Google Drive ก่อน
  - จากนั้นจึงกด “บันทึกข้อมูลการส่ง / ส่งแล้ว” ได้ในหน้า Preview / Print
- เพิ่มข้อมูลผู้รับปลายทางตอนเปลี่ยนสถานะเป็นส่งแล้ว
  - วันที่ส่งใบเสนอราคา
  - อีเมลผู้รับ (required)
  - ผู้รับ (required)
  - ตำแหน่งผู้รับ
- เพิ่ม SQL patch `supabase/patch_v1_10_4.sql`

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
  patch_v1_10_2.sql
  patch_v1_10_4.sql
  reset_usage_data_keep_master.sql
  README_SQL.md
  ...patch เก่าที่ใช้ตั้งค่าระบบ
```

## ขั้นตอนติดตั้ง v1.10.4

### 1) ติดตั้งไฟล์เว็บ

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. เปิด Live Server หรือ GitHub Pages แล้วทำ hard refresh

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

### 2) รัน SQL ใหม่

ต้องรัน SQL นี้ใน Supabase SQL Editor:

```text
supabase/patch_v1_10_4.sql
```

Patch นี้จะเพิ่ม field ข้อมูลผู้รับปลายทางและ RPC:

```text
mark_quotation_as_sent_v1104
```

> ต้องเคยรัน `supabase/patch_v1_10_2.sql` มาก่อน เพราะ v1.10.4 ใช้ table `quotation_drive_files` เป็นเงื่อนไขว่าต้องมี PDF ใน Drive ก่อน

### 3) Google Apps Script

ไม่จำเป็นต้องเปลี่ยน Apps Script ถ้าใช้อยู่บน v1.10.3 แล้ว เพราะ v1.10.4 ยังส่ง `pdfBase64` ให้ Apps Script บันทึกเป็น PDF blob เหมือนเดิม

ถ้าต้องการให้ version ใน Apps Script ตรงกัน สามารถเปลี่ยน `FI_ARCHIVE_VERSION` ใน `google-apps-script/Code.gs` เป็น `1.10.4` แล้ว Deploy ใหม่ได้

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
git commit -m "Release v1.10.4 drive pdf single page sent workflow"
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
1.10.4
```

## Debug helper

```js
await window.FI_DEBUG()
```

ควรเห็นค่าประมาณนี้:

```text
version: 1.10.4
drivePdfBlankPageFix: true
sentRequiresDrivePdf: true
sentRecipientFields: true
sqlChanged: true
```

## จุดที่ต้องทดสอบทันที

```text
1. รัน patch_v1_10_4.sql สำเร็จ
2. เปิดหน้า Preview / Print ของใบเสนอราคาสถานะยืนยันแล้ว
3. กด บันทึกไป Google Drive
4. เปิดไฟล์ใน Google Drive แล้วตรวจว่าไม่มีหน้าว่างท้ายไฟล์
5. หลังบันทึก Drive แล้วต้องเห็นปุ่ม บันทึกข้อมูลการส่ง / ส่งแล้ว
6. กดปุ่มแล้วต้องมี modal ให้กรอก วันที่ส่ง, อีเมลผู้รับ, ผู้รับ, ตำแหน่ง
7. อีเมลผู้รับและผู้รับต้อง required
8. บันทึกสำเร็จแล้ว status ต้องเป็น ส่งแล้ว
9. หน้า View ต้องแสดงข้อมูลการส่งใบเสนอราคา
10. ถ้ายังไม่ได้บันทึก Drive ต้องยังเปลี่ยนสถานะเป็นส่งแล้วไม่ได้
```
