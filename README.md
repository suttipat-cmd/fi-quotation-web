# FI Quotation Web App v1.6.1

## v1.6.1 Corrected Build

Release นี้เป็นชุดแก้ไขต่อจาก v1.6 โดยเน้นแก้ปัญหา **กลับจากเว็บ/แท็บอื่นแล้วระบบโหลดค้างหรือขึ้น error session** พร้อมคง requirement ของ v1.6 ให้ครบ

## สิ่งที่แก้ใน v1.6.1

- แก้ `recoverAppAfterResume()` ไม่ให้ block การ render ด้วย `getSession()` ถ้าในระบบยังมี `user/profile` อยู่แล้ว
- กลับจากเว็บอื่นแล้วให้ render หน้าเดิมก่อน แล้วค่อยตรวจ session แบบ background
- เพิ่ม guard หลัง resume ถ้าหน้ายังค้าง loading หรือว่าง จะสั่ง render หน้าเดิมใหม่อัตโนมัติ
- เพิ่ม retry state พร้อมปุ่ม “โหลดข้อมูลใหม่” โดยไม่ต้อง refresh browser
- เพิ่ม cache busting ใน `index.html` เป็น `script.js?v=1.6.1` และ `style.css?v=1.6.1`
- เพิ่ม favicon fallback เพื่อลด error `favicon.ico 404`
- คงการปรับ `*` ของ required fields ให้เป็นสีแดงทั่วระบบ
- คงกติกา Product Master:
  - รหัสสินค้า / Code สามารถซ้ำกันได้
  - ชื่อสินค้า/บริการต้องไม่ซ้ำกัน
- คง Excel Export แบบหลายชีต:
  - `Summary`
  - `Quotations`
  - `Items`
  - `By Sales`
  - `By Status`

## ไฟล์ใน package

```text
index.html
style.css
script.js
README.md
TEST_CHECKLIST.md
supabase/patch_v1_5.sql
supabase/patch_v1_5_1.sql
supabase/patch_v1_6.sql
supabase/patch_v1_6_1.sql
```

## วิธีติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดไปทับใน repo `fi-quotation-web`
3. ถ้ายังไม่เคยรัน SQL ของ v1.6 ให้ไปที่ Supabase → SQL Editor แล้วรัน:

```text
supabase/patch_v1_6.sql
```

4. ถ้าเคยรัน `patch_v1_6.sql` แล้ว ให้รัน `patch_v1_6_1.sql` ได้ แต่ไฟล์นี้เป็น no-op สำหรับบันทึกเวอร์ชันเท่านั้น
5. เปิด Live Server ทดสอบก่อน push
6. Push ขึ้น GitHub Pages

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Hotfix v1.6.1 resume loading reliability"
git push origin main
```

## จุดที่ควรทดสอบ

- เปิดหน้า `#customers` แล้วเปลี่ยนไปเว็บอื่น 1-3 นาที กลับมาต้องไม่ค้าง loading
- ถ้า network ช้า ต้องขึ้นปุ่ม “โหลดข้อมูลใหม่” แทนการค้างถาวร
- กดปุ่ม “โหลดข้อมูลใหม่” แล้วต้องโหลดหน้าเดิมได้โดยไม่ refresh browser
- Required `*` ในฟอร์มต้องเป็นสีแดง
- Product Code ซ้ำกันได้ แต่ Product Name ซ้ำไม่ได้
- Export Excel ต้องมี 5 sheets
- GitHub Pages ต้องโหลดไฟล์ใหม่ ไม่ติด cache จาก v1.6 เดิม
