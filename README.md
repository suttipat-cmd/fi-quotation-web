# FI Quotation Web App v1.10.5

## v1.10.5 Sent Action UI Polish + View Sent Action

Release นี้ต่อยอดจาก v1.10.4 เพื่อปรับ UI และ wording ของ workflow การส่งใบเสนอราคาให้กระชับขึ้น โดยยังคงเงื่อนไขเดิมคือ ต้องบันทึก PDF ลง Google Drive ก่อนจึงจะเปลี่ยนสถานะเป็น “ส่งแล้ว” ได้

## สิ่งที่เปลี่ยนใน v1.10.5

- อัปเดต cache busting เป็น `style.css?v=1.10.5` และ `script.js?v=1.10.5`
- อัปเดต `window.FI_APP_VERSION = "1.10.5"`
- ปรับปุ่ม action บนหน้า Preview / Print ให้กระชับขึ้น ไม่กินพื้นที่มากเกินไป
- เปลี่ยน wording ปุ่มสถานะจากข้อความยาวให้เหลือเพียง `ส่งแล้ว`
- ปุ่ม `ส่งแล้ว` ยังถูก disable ถ้ายังไม่มี PDF ที่บันทึกลง Google Drive
- เมื่อมี PDF ใน Google Drive แล้ว ผู้ใช้สามารถกด `ส่งแล้ว` ได้จากหน้า `#quotation-view` ด้วย
- ปุ่ม `ส่งแล้ว` ในหน้า View และ Print ใช้ action เดียวกัน เปิด modal กรอกข้อมูลการส่งเหมือนกัน
- ปรับ UI “ข้อมูลการส่งใบเสนอราคา” ให้เป็น card ขนาดพอดี อ่านง่าย และไม่ทำให้ toolbar ดูแน่นเกินไป
- ไม่มี SQL patch ใหม่ใน release นี้

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

## ขั้นตอนติดตั้ง v1.10.5

### 1) ติดตั้งไฟล์เว็บ

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. เปิด Live Server หรือ GitHub Pages แล้วทำ hard refresh

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

### 2) SQL

ไม่ต้องรัน SQL ใหม่สำหรับ v1.10.5

ต้องเคยรัน SQL เหล่านี้สำเร็จแล้ว:

```text
supabase/patch_v1_10_2.sql
supabase/patch_v1_10_4.sql
```

เพราะ v1.10.5 ยังใช้ table `quotation_drive_files` และ RPC `mark_quotation_as_sent_v1104` จาก release ก่อนหน้า

### 3) Google Apps Script

ไม่จำเป็นต้องเปลี่ยน Apps Script ถ้าใช้อยู่บน v1.10.3 หรือ v1.10.4 แล้ว เพราะ v1.10.5 ไม่เปลี่ยน payload การบันทึก PDF ไป Drive

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
git commit -m "Release v1.10.5 sent action ui polish"
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
1.10.5
```

## Debug helper

```js
await window.FI_DEBUG()
```

ควรเห็นค่าประมาณนี้:

```text
version: 1.10.5
sentActionWording: "ส่งแล้ว"
sentViewActionEnabledAfterDrive: true
compactSentDeliveryUI: true
sqlChanged: false
```

## จุดที่ต้องทดสอบทันที

```text
1. เปิดหน้า Preview / Print แล้วปุ่ม action ต้องไม่ใหญ่ผิดปกติ
2. ปุ่มเปลี่ยนสถานะต้องแสดง wording เป็น “ส่งแล้ว” เท่านั้น
3. ถ้ายังไม่มี PDF ใน Google Drive ปุ่ม “ส่งแล้ว” ต้อง disabled
4. หลังบันทึก PDF ลง Google Drive แล้ว ปุ่ม “ส่งแล้ว” ต้องกดได้จากหน้า Preview / Print
5. หลังบันทึก PDF ลง Google Drive แล้ว ปุ่ม “ส่งแล้ว” ต้องกดได้จากหน้า View
6. ทั้งสองปุ่มต้องเปิด modal กรอกวันที่ส่ง, อีเมลผู้รับ, ผู้รับ, ตำแหน่ง เหมือนกัน
7. บันทึกสำเร็จแล้ว status ต้องเป็น sent
8. ข้อมูลการส่งใบเสนอราคาต้องแสดงเป็น card ที่อ่านง่ายและไม่กินพื้นที่ toolbar มากเกินไป
9. ปุ่มเปิดไฟล์ใน Google Drive ยังทำงาน
10. ปุ่มพิมพ์ / บันทึกเป็น PDF เดิมยังทำงาน
```
