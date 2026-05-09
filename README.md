# FI Quotation Web App v1.11.4

## v1.11.4 Payment Gate + Sent Cancellation Guard

Release นี้ต่อยอดจาก v1.11.3 โดยเพิ่มการป้องกันไม่ให้ใบเสนอราคาที่อยู่สถานะ `ส่งแล้ว` หรือ `ชำระเงินแล้ว` ถูกยกเลิก, เพิ่มการเลือกส่วนของยอดที่ได้รับชำระจริงตอนเปลี่ยนเป็นสถานะ `ชำระเงินแล้ว`, ปรับ Dashboard ให้ `ยอดรับชำระเดือนนี้` คิดจากใบที่ชำระเงินแล้วเท่านั้น และเปลี่ยน Apps Script ส่งอีเมลจาก `GmailApp` เป็น `MailApp` พร้อมขั้นตอน authorize ที่ชัดเจนขึ้น

## สิ่งที่เปลี่ยนใน v1.11.4

- อัปเดต cache busting เป็น `style.css?v=1.11.4` และ `script.js?v=1.11.4`
- อัปเดต `window.FI_APP_VERSION = "1.11.4"`
- ป้องกันสถานะ `ส่งแล้ว` / `ชำระเงินแล้ว` ไม่ให้เปลี่ยนเป็น `ยกเลิก`
  - ปุ่มยกเลิกไม่แสดงบนใบสถานะส่งแล้ว
  - checkbox ของใบสถานะส่งแล้ว/ชำระเงินแล้วถูก disable
  - Select All จะไม่เลือกใบสถานะส่งแล้ว/ชำระเงินแล้ว
  - SQL RPC ป้องกันการ bypass ฝั่ง frontend
- เพิ่มการเลือกยอดที่ได้รับชำระตอนเปลี่ยนสถานะเป็น `ชำระเงินแล้ว`
  - ค่าบริการชำระรายเดือน / รายปี
  - ค่าบริการชำระครั้งเดียวจบ
  - หรือทั้งคู่
- Dashboard เปลี่ยน `ยอดเดือนนี้` เป็น `ยอดรับชำระเดือนนี้`
  - คำนวณจากใบสถานะ `ชำระเงินแล้ว` เท่านั้น
  - ใช้ยอดเงินจากส่วนที่ user เลือกตอนกดชำระเงิน
- ปรับ layout modal `ข้อมูลการส่งใบเสนอราคา`
  - แยกข้อมูลผู้รับ / ไฟล์แนบ / อีเมล ให้ดูเป็นระเบียบขึ้น
- อัปเดต Google Apps Script
  - เปลี่ยนจาก `GmailApp.sendEmail` เป็น `MailApp.sendEmail`
  - เพิ่ม `authorizeEmailV1114()` สำหรับ run เพื่อขอสิทธิ์ส่งอีเมลก่อนใช้งานจริง
- เพิ่ม SQL patch `supabase/patch_v1_11_4.sql`

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

## ขั้นตอนติดตั้ง v1.11.4

### 1) ติดตั้งไฟล์เว็บ

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. เปิด Live Server หรือ GitHub Pages แล้วทำ hard refresh

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

### 2) SQL

ต้องรัน SQL ใหม่สำหรับ v1.11.4:

```text
supabase/patch_v1_11_4.sql
```

ต้องเคยรัน SQL เหล่านี้สำเร็จแล้ว:

```text
supabase/patch_v1_10_2.sql
supabase/patch_v1_10_4.sql
supabase/patch_v1_11_3.sql
```

### 3) Google Apps Script

ต้องอัปเดต Apps Script เพราะ v1.11.4 เปลี่ยนการส่งอีเมลเป็น `MailApp`

1. เปิด Google Apps Script Project เดิม
2. เปิด `Code.gs`
3. Copy โค้ดจาก `google-apps-script/Code.gs` ไปวางทับ
4. ตรวจว่า Script Property ยังมี `UPLOAD_SECRET` ตรงกับค่าในหน้า Settings ของเว็บ
5. กด Save
6. ใน Apps Script Editor ให้เลือก function `authorizeEmailV1114`
7. กด Run 1 ครั้ง
8. ทำตามขั้นตอน Allow/Authorize ของ Google
9. Deploy > Manage deployments > Edit deployment
10. เลือก New version แล้วกด Deploy
11. ใช้ Web App URL เดิมได้ถ้า deploy ทับ deployment เดิม

หมายเหตุ: `authorizeEmailV1114()` จะส่งอีเมลทดสอบ 1 ฉบับไปยังบัญชี Google ที่รัน script เพื่อให้ Google ขอสิทธิ์ `MailApp` ก่อนใช้งานจริง

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
git commit -m "Release v1.11.4 payment gate sent cancellation guard"
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
1.11.4
```

## จุดที่ต้องทดสอบทันที

```text
1. รัน patch_v1_11_4.sql สำเร็จ
2. อัปเดตและ deploy Google Apps Script v1.11.4 สำเร็จ
3. Run authorizeEmailV1114 ใน Apps Script Editor สำเร็จ
4. ใบสถานะส่งแล้วต้องไม่มีปุ่มยกเลิก
5. checkbox ของใบสถานะส่งแล้ว/ชำระเงินแล้วต้อง disabled
6. Select All ต้องไม่เลือกใบสถานะส่งแล้ว/ชำระเงินแล้ว
7. Bulk cancel ต้องไม่ยกเลิกใบสถานะส่งแล้ว/ชำระเงินแล้ว
8. กดชำระเงินแล้วต้องมีตัวเลือกส่วนยอดที่รับชำระ
9. Dashboard ยอดรับชำระเดือนนี้ต้องคิดจากสถานะชำระเงินแล้วเท่านั้น
10. Modal ข้อมูลการส่งใบเสนอราคาต้อง layout อ่านง่ายขึ้น
11. กดบันทึกและส่งอีเมลต้องใช้ MailApp และแนบ PDF จาก Google Drive ได้
```
