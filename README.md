# FI Quotation Web App v1.12.1

## v1.12.1 Quotation Workflow + Dashboard Chart Refinement

Release นี้ต่อยอดจาก v1.12.0 เพื่อปรับ UX ของ flow ใบเสนอราคาและ Dashboard ให้ตรงกับการใช้งานจริงมากขึ้น โดยยังคง schema และ Google Apps Script เดิมจาก v1.11.4/v1.11.5

## สิ่งที่เปลี่ยนใน v1.12.1

- อัปเดต cache busting เป็น `style.css?v=1.12.1` และ `script.js?v=1.12.1`
- อัปเดต `window.FI_APP_VERSION = "1.12.1"`
- ย้าย action หลักของใบเสนอราคามาไว้หน้า `#quotation-view`
  - `บันทึกไป Google Drive`
  - `เปิดไฟล์ใน Google Drive`
  - `ส่งแล้ว`
  - `ชำระเงินแล้ว`
- หน้า `#quotation-print` เหลือไว้สำหรับตรวจเอกสารและ `พิมพ์ / บันทึกเป็น PDF` เท่านั้น
- ปรับ Funnel บน Dashboard ให้คำนวณความยาวหลอดจากจำนวนใบเสนอราคาทั้งหมด ไม่ใช่จากสถานะที่มีจำนวนมากที่สุด
- เปลี่ยนกราฟ `แนวโน้มยอดรับชำระ` เป็นแผนภูมิแท่ง เพื่อให้อ่านและเปรียบเทียบยอดได้ง่ายขึ้น
- ปรับสี Pie Chart สัดส่วนสถานะให้แยกสถานะชัดเจนขึ้น
- เปลี่ยนการแสดงชื่อสินค้า/บริการในใบเสนอราคาให้ดึงชื่อปัจจุบันจาก Product Master ผ่าน `product_id`
  - หน้า View
  - หน้า Print / PDF
  - Dashboard Top Products
  - Email template
  - หากเป็นรายการ one-time ที่ไม่มี `product_id` จะใช้ชื่อรายการที่กรอกไว้เป็น fallback
- ปรับตารางหน้า `#quotations`
  - เพิ่มคอลัมน์ `สินค้า/บริการ` ต่อจาก `ประเภท`
  - ตัดคอลัมน์ `วันที่สร้าง` ออก
- เพิ่ม Filter `สินค้า/บริการ` แบบ Dropdown โดยดึงข้อมูลจาก Product Master

## SQL

v1.12.1 **ไม่มี schema patch ใหม่**

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

## Google Apps Script

v1.12.1 **ไม่ต้องอัปเดต Apps Script ใหม่** หากใช้งาน v1.11.4/v1.11.5 อยู่แล้ว

ยังต้องเคยทำขั้นตอนนี้แล้ว:

```text
Run function authorizeEmailV1114 ใน Apps Script Editor
Deploy Web App version ใหม่
```

## ขั้นตอนติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. ไม่ต้องรัน SQL ใหม่
4. ไม่ต้องแก้ Google Apps Script ถ้าใช้งาน v1.11.4 ขึ้นไปอยู่แล้ว
5. Push ขึ้น GitHub Pages

```bash
git status
git add .
git commit -m "Release v1.12.1 quotation workflow dashboard refinement"
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
1.12.1
```

## จุดที่ต้องทดสอบทันที

```text
1. หน้า View ต้องมีปุ่ม/แผงสำหรับบันทึก PDF ไป Google Drive
2. หลังบันทึก Drive แล้ว หน้า View ต้องกดส่งแล้วได้
3. หน้า Print ต้องไม่มีปุ่ม Drive / ส่งแล้ว เหลือเฉพาะกลับและพิมพ์/PDF
4. PDF ต้องแสดงชื่อสินค้า/บริการล่าสุดจาก Product Master หากรายการมี product_id
5. Email template ต้องใช้ชื่อสินค้า/บริการล่าสุดจาก Product Master
6. Funnel ต้องคิดความยาวหลอดจากจำนวนใบเสนอราคาทั้งหมด
7. แนวโน้มยอดรับชำระต้องแสดงเป็น Bar Chart
8. Pie Chart ต้องแยกสีแต่ละสถานะชัดเจน
9. หน้าใบเสนอราคาต้องมีคอลัมน์สินค้า/บริการ
10. หน้าใบเสนอราคาต้องไม่มีคอลัมน์วันที่สร้าง
11. Filter สินค้า/บริการต้องดึงจาก Product Master และกรองรายการได้
12. Flow เดิม: สร้าง/แก้ไข/ยืนยัน/สำเนา/ส่งอีเมล/ชำระเงิน ต้องยังทำงาน
```
