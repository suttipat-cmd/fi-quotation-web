# FI Quotation Web App v1.12.0

## v1.12.0 Production Readiness Cleanup

Release นี้ต่อยอดจาก v1.11.5 เพื่อเตรียมให้ผู้ใช้งานจริงเริ่มใช้งาน โดยโฟกัสที่ความเสถียร ความถูกต้อง UX บนมือถือ และการลดความซับซ้อนของหน้าจอ

## สิ่งที่เปลี่ยนใน v1.12.0

- อัปเดต cache busting เป็น `style.css?v=1.12.0` และ `script.js?v=1.12.0`
- อัปเดต `window.FI_APP_VERSION = "1.12.0"`
- ตัดเมนู/หน้า `ลูกค้า` ออกจากระบบ
  - ยังเก็บ `customer_name` และ `customer_address` ในใบเสนอราคา เพราะเป็นข้อมูลจำเป็นของเอกสาร
  - เลิกใช้หน้า derived customer list จาก `v_customers_from_quotations`
- ปรับ Dashboard เป็น read-only
  - ไม่มีปุ่มที่เปลี่ยนข้อมูล เช่น ส่งแล้ว / ชำระเงินแล้ว / ยกเลิก / bulk action
  - อนุญาตให้กดดูรายละเอียดใบเสนอราคาได้
- ปรับ Dashboard เป็นข้อมูลเชิงวิเคราะห์มากขึ้น
  - Summary cards
  - สัดส่วนสถานะใบเสนอราคา
  - Funnel ร่าง → ยืนยันแล้ว → ส่งแล้ว → ชำระเงินแล้ว
  - ใบใกล้หมดอายุ
  - ส่งแล้วแต่ยังไม่ชำระเงิน
  - ชำระเงินล่าสุด
  - แนวโน้มยอดรับชำระ
  - สินค้า/บริการที่ถูกเสนอมากที่สุด
  - ยอดรวมตามฝ่ายขาย สำหรับ admin/manager
- ตัด/ย่อข้อความที่ไม่จำเป็นบนหน้าเว็บ
  - ข้อความเชิง technical เช่น Database, snapshot, MVP ถูกซ่อนจาก UI
  - ข้อความช่วยที่ยังมีประโยชน์ถูกย้ายเป็น tooltip/help
- ปรับ responsive/mobile layout
  - Header และ mobile menu กระชับขึ้น
  - Form, table, modal, action bar และ dashboard widgets รองรับจอมือถือดีขึ้น
  - ปุ่มใน modal/action area เป็น full-width บนจอเล็ก
- อัปเดต SQL reset usage data
  - เพิ่มการล้าง `quotation_drive_files`
  - ระบุลำดับการล้าง table เพื่อกันปัญหา foreign key
- เพิ่มเอกสาร audit สำหรับสิ่งที่ตรวจพบและข้อควรติดตามต่อ

## SQL

v1.12.0 **ไม่มี schema patch ใหม่**

ต้องเคยรัน SQL เหล่านี้จากเวอร์ชันก่อนหน้าแล้ว:

```text
supabase/patch_v1_10_2.sql
supabase/patch_v1_10_4.sql
supabase/patch_v1_11_3.sql
supabase/patch_v1_11_4.sql
```

เมื่อต้องการล้าง usage data โดยเก็บ master data ให้ใช้:

```text
supabase/reset_usage_data_keep_master.sql
```

ไฟล์ reset จะล้างตามลำดับ:

```text
1. quotation_status_logs / quotation_audit_logs / quotation_attachments / quotation_files ถ้ามี
2. quotation_drive_files
3. quotation_items
4. quotations
```

ข้อมูลที่ยังคงอยู่:

```text
products
profiles / auth.users
company_profile
app_settings
Supabase Storage buckets/files
```

## Google Apps Script

v1.12.0 **ไม่ต้องอัปเดต Apps Script ใหม่** หากใช้งาน v1.11.4/v1.11.5 อยู่แล้ว

ยังต้องเคยทำขั้นตอนนี้แล้ว:

```text
Run function authorizeEmailV1114 ใน Apps Script Editor
Deploy Web App version ใหม่
```

## ขั้นตอนติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. ไม่ต้องรัน SQL ใหม่ ยกเว้นต้องการล้างข้อมูลการใช้งาน
4. ไม่ต้องแก้ Google Apps Script ถ้าใช้งาน v1.11.4 ขึ้นไปอยู่แล้ว
5. Push ขึ้น GitHub Pages

```bash
git status
git add .
git commit -m "Release v1.12.0 production readiness cleanup"
git push origin main
```

หลัง deploy แล้วทำ hard refresh:

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

## ตรวจ release ก่อน push

ถ้าเครื่องมี Node.js ให้รัน:

```bash
node scripts/check-release.js
node --check script.js
```

## ตรวจเวอร์ชันใน Console

```js
window.FI_APP_VERSION
```

ต้องได้:

```text
1.12.0
```

## จุดที่ต้องทดสอบทันที

```text
1. เมนู “ลูกค้า” ต้องไม่แสดง
2. เข้า #customers แล้วต้องถูกพากลับแดชบอร์ด
3. Dashboard ต้องไม่มี action ที่เปลี่ยนข้อมูล
4. Dashboard ยังต้องกดดูรายละเอียดใบเสนอราคาได้
5. Dashboard widgets ต้องแสดงครบและไม่ทำให้หน้าจอยาวเกินไป
6. Mobile header/menu ต้องใช้งานได้และ logout ได้
7. หน้าใบเสนอราคา list/search/filter/sort/bulk ยังทำงานเหมือนเดิม
8. สร้าง/แก้ไข/ยืนยัน/สร้างสำเนาใบเสนอราคายังทำงาน
9. บันทึก PDF ไป Google Drive ยังทำงาน
10. ส่งอีเมลและข้อมูลการส่งยังทำงาน
11. ชำระเงินแล้วและยอดรับชำระเดือนนี้ยังถูกต้อง
12. ใบสถานะส่งแล้ว/ชำระเงินแล้วยังยกเลิกไม่ได้
13. reset_usage_data_keep_master.sql ล้าง usage data โดยไม่ลบ master data
```
