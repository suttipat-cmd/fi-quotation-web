# FI Quotation Web App v1.9.6

## v1.9.6 Quotation Section Summary + Price Lookup Pagination + Print A4 Fix

Release นี้ต่อยอดจาก v1.9.5 โดยปรับหน้า View ใบเสนอราคาให้แสดงสรุปยอดแยกตามตาราง, เพิ่ม pagination ให้ผลค้นหาราคาเดิม, และแก้ layout หน้า Preview / Print ให้คงสัดส่วน A4 จริงพร้อมตรึงส่วนลายเซ็นไว้ด้านล่างของหน้า

## สิ่งที่แก้ใน v1.9.6

- อัปเดต cache busting เป็น `style.css?v=1.9.6` และ `script.js?v=1.9.6`
- อัปเดต `window.FI_APP_VERSION = "1.9.6"`
- หน้า `#quotation-view`:
  - ตัด card / ตาราง `สรุปยอด` รวมทั้งฉบับออก
  - เพิ่มสรุปยอดท้ายตาราง `ค่าบริการชำระรายเดือน / รายปี`
  - เพิ่มสรุปยอดท้ายตาราง `ค่าบริการชำระครั้งเดียวจบ`
  - แต่ละส่วนแสดงมูลค่าก่อนภาษี, ส่วนลด, ฐานคำนวณภาษี, VAT, หัก ณ ที่จ่าย, ส่วนต่างปัดเศษถ้ามี และยอดรวมสุทธิ
- เพิ่ม pagination ให้ผลลัพธ์ `พบราคาเดิม ... รายการ`
  - default 5 รายการต่อหน้า
  - มีปุ่มก่อนหน้า / ถัดไป
  - ไม่กระทบ pagination ตารางหลักของ v1.9.5
- หน้า `Preview / Print`:
  - แก้สัดส่วน A4 ให้เป็น 210mm x 297mm จริงบนหน้าจอ preview
  - ยกเลิกการย่อ/ยืดที่ทำให้ A4 ratio เพี้ยน
  - ให้เลื่อนแนวนอนได้เมื่อหน้าจอแคบแทนการบีบกระดาษ
  - ตรึงส่วน `ยืนยันรับราคา / ลูกค้า` และ `ผู้เสนอราคา` ไว้เป็น footer ด้านล่างของหน้า A4
- ไม่เปลี่ยน SQL / RLS ในรอบนี้
- ไม่ต้องรัน SQL patch ใหม่เพื่อใช้ v1.9.6

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
git commit -m "Release v1.9.6 quotation section summary print a4 fix"
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
1.9.6
```

## จุดที่ต้องทดสอบ

```text
1. window.FI_APP_VERSION ต้องได้ 1.9.6
2. หน้า #quotation-view ต้องไม่มี card สรุปยอดรวมทั้งฉบับ
3. ตารางค่าบริการรายเดือน/รายปีต้องมีสรุปยอดของตัวเองท้ายตาราง
4. ตารางค่าบริการครั้งเดียวจบต้องมีสรุปยอดของตัวเองท้ายตาราง
5. สรุปแต่ละตารางต้องแสดง VAT / หัก ณ ที่จ่าย / ยอดรวมสุทธิ
6. ค้นหาราคาเดิมแล้วต้องแสดง default 5 รายการต่อหน้า
7. ผลค้นหาราคาเดิมต้องกดก่อนหน้า / ถัดไปได้เมื่อมีมากกว่า 5 รายการ
8. กดใช้ราคานี้จากหน้าใดก็ต้องเอาราคาไปใส่ในช่องราคาได้
9. หน้า Preview / Print ต้องแสดงกระดาษ A4 สัดส่วน 210:297 ไม่ถูกบีบผิดสัดส่วน
10. ส่วนยืนยันรับราคา / ลูกค้า และผู้เสนอราคาต้องอยู่ด้านล่าง A4 เมื่อเนื้อหาไม่ล้นหน้า
11. ปุ่มย้อนกลับ / duplicate icon จาก v1.9.5 ยังทำงาน
12. Pagination ตารางหลัก / snapshot / autosave จากเวอร์ชันก่อนยังทำงาน
```

## Debug helper

ใน Console สามารถรัน:

```js
await window.FI_DEBUG()
```

ข้อมูลที่แสดงจะมี version, route, auth state, role, session presence, formAutosave, pagination, snapshot cache และสถานะ patch v1.9.6 โดยไม่แสดง access token หรือ anon key
