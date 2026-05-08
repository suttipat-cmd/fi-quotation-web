# FI Quotation Web App v1.9.5

## v1.9.5 Data Snapshot + Pagination + UI Polish

Release นี้ต่อยอดจาก v1.9.4 โดยเพิ่มการคุม snapshot ของสินค้า/บริการในใบเสนอราคา, เพิ่ม pagination ให้ตารางข้อมูลหน้าจอใช้งาน, ปรับสีสถานะใบเสนอราคา, เปลี่ยนปุ่มย้อนกลับ/สร้างสำเนาเป็น icon และเพิ่ม SQL สำหรับล้างข้อมูลการใช้งานโดยไม่ล้าง master data

## สิ่งที่แก้ใน v1.9.5

- อัปเดต cache busting เป็น `style.css?v=1.9.5` และ `script.js?v=1.9.5`
- อัปเดต `window.FI_APP_VERSION = "1.9.5"`
- เพิ่ม pagination default 10 รายการในตารางข้อมูลหน้าจอใช้งาน:
  - ตารางใบเสนอราคา
  - ตารางลูกค้า
  - ตารางสินค้า/บริการ
  - ตารางยอดรวมตาม Sales บน Dashboard
- ไม่ใส่ pagination ในตาราง Preview / Print PDF
- เพิ่ม logic คุม snapshot ของสินค้า/บริการในใบเสนอราคา:
  - หน้า View / Print ใช้ข้อมูล snapshot ของ quotation item
  - หน้า Edit Draft จะแสดงชื่อสินค้า snapshot เดิมเมื่อแก้ master data ภายหลัง
  - ถ้าไม่ได้เปลี่ยนสินค้าในฟอร์ม ระบบจะไม่ overwrite snapshot ด้วย master data ใหม่ตอนบันทึก Draft
  - ถ้าเลือกสินค้าใหม่จริง ระบบจะ snapshot จาก master data ตัวใหม่ตามปกติ
- ปรับสี badge สถานะใบเสนอราคาใหม่ให้แยกชัดขึ้น:
  - ร่าง = เทา
  - ยืนยันแล้ว = น้ำเงิน
  - ส่งแล้ว = Indigo
  - ชำระเงิน = เขียว
  - หมดอายุ = ส้ม
  - ยกเลิก = แดง
- ยืนยันให้สถานะ `paid` / `ชำระเงิน` อยู่ครบใน frontend
- เปลี่ยนปุ่มย้อนกลับ เช่น `กลับไปหน้ารายการ`, `กลับไปหน้ารายละเอียด` เป็น icon `←`
- เปลี่ยนปุ่ม `สร้างสำเนา` เป็น icon `⧉`
- เพิ่มไฟล์ SQL สำหรับล้างข้อมูลการใช้งาน แต่เก็บ master data ไว้:
  - `supabase/reset_usage_data_keep_master.sql`
- เพิ่ม patch note SQL:
  - `supabase/patch_v1_9_5.sql`
- ไม่จำเป็นต้องรัน SQL patch ใหม่เพื่อใช้ feature frontend ของ v1.9.5

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
  reset_usage_data_keep_master.sql
```

## วิธีติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. รอบนี้ไม่ต้องรัน SQL ใหม่ ถ้าเคยรัน `supabase/patch_v1_9_1.sql` สำเร็จแล้ว
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
git commit -m "Release v1.9.5 data snapshot pagination polish"
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
1.9.5
```

## SQL สำหรับล้างข้อมูลการใช้งาน

ต้องการล้างข้อมูลใบเสนอราคา/รายการใช้งานทั้งหมด แต่ไม่ล้าง master data ให้รันไฟล์นี้ใน Supabase SQL Editor:

```text
supabase/reset_usage_data_keep_master.sql
```

ไฟล์นี้จะไม่ล้าง:

```text
products
profiles / users
company_profile
app_settings
```

## จุดที่ต้องทดสอบ

```text
1. window.FI_APP_VERSION ต้องได้ 1.9.5
2. ตารางใบเสนอราคาแสดง pagination default 10 รายการ
3. Search / Filter / Sorting หน้าใบเสนอราคายังทำงานร่วมกับ pagination
4. Checkbox / Select all เลือกเฉพาะรายการที่แสดงในหน้าปัจจุบัน
5. ตารางลูกค้ามี pagination default 10 รายการ
6. ตารางสินค้า/บริการมี pagination default 10 รายการ
7. ตารางยอดรวมตาม Sales บน Dashboard มี pagination default 10 รายการ
8. ตาราง Preview / Print ไม่มี pagination
9. แก้ชื่อสินค้าใน Master Data แล้วใบเสนอราคาเดิมใน View / Print ไม่เปลี่ยนตาม
10. แก้ Draft ที่เคยเลือกสินค้าก่อน master ถูกแก้ แล้วกดบันทึกโดยไม่เปลี่ยนสินค้า ข้อมูล snapshot ต้องไม่ถูก overwrite
11. ถ้าเลือกสินค้าใหม่จริงใน Draft ระบบต้องใช้ข้อมูลสินค้าใหม่เป็น snapshot
12. ปุ่มย้อนกลับแสดงเป็น ←
13. ปุ่มสร้างสำเนาแสดงเป็น ⧉
14. สีสถานะ Draft / Confirmed / Sent / Paid / Expired / Cancelled แยกชัดเจน
15. autosave, ปุ่มดูรายละเอียด, Export Excel จากเวอร์ชันก่อนยังทำงาน
```

## Debug helper

ใน Console สามารถรัน:

```js
await window.FI_DEBUG()
```

ข้อมูลที่แสดงจะมี version, route, auth state, role, session presence, formAutosave, pagination และ snapshot cache โดยไม่แสดง access token หรือ anon key
