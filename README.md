# FI Quotation Web App v1.9.3

## v1.9.3 Hotfix: Quotation Form State Preservation

Release นี้ต่อยอดจาก v1.9.2 Hotfix: Delegated Events Restore โดยแก้ปัญหาที่ข้อมูลในหน้าสร้าง/แก้ไขใบเสนอราคาถูกรีเซ็ตเมื่อผู้ใช้สลับไปแท็บอื่นแล้วกลับมาใช้งานเว็บเดิม

## สิ่งที่แก้ใน v1.9.3

- อัปเดต cache busting เป็น `style.css?v=1.9.3` และ `script.js?v=1.9.3`
- อัปเดต `window.FI_APP_VERSION = "1.9.3"`
- เพิ่ม autosave ชั่วคราวสำหรับฟอร์มใบเสนอราคาใน `sessionStorage`
- รองรับหน้า:
  - `#quotation-new`
  - `#quotation-edit/{id}`
- เก็บค่าฟอร์มระหว่างสลับแท็บ / กลับจากแท็บอื่น / browser resume
- ป้องกัน resume recovery re-render หน้า quotation form ทับข้อมูลที่กำลังกรอก
- Restore ค่าในฟอร์มและคำนวณยอดใหม่อัตโนมัติเมื่อหน้า form ถูก render ใหม่
- ล้าง autosave เมื่อบันทึกร่าง/บันทึกแก้ไขสำเร็จ หรือกดยกเลิก
- เพิ่มข้อมูล `formAutosave` ใน `window.FI_DEBUG()`
- ไม่เปลี่ยน SQL / RLS ในรอบนี้
- คง patch SQL ล่าสุดที่ต้องใช้คือ `supabase/patch_v1_9_1.sql`

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
git commit -m "Hotfix v1.9.3 preserve quotation form state"
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
1.9.3
```

## จุดที่ต้องทดสอบ

```text
1. เข้า #quotation-new แล้วกรอกข้อมูลลูกค้า / ราคา / หมายเหตุ
2. สลับไปแท็บเว็บอื่น แล้วกลับมาที่เว็บเดิม ข้อมูลต้องไม่หาย
3. เปลี่ยนประเภท รายเดือน/รายปี แล้วสลับแท็บกลับมา ค่าต้องยังอยู่
4. Refresh หน้า #quotation-new แล้วระบบควรกู้ข้อมูลล่าสุดใน tab เดิมได้
5. กดบันทึกร่างสำเร็จแล้ว autosave ต้องถูกล้าง
6. เปิดสร้างใบเสนอราคาใหม่หลังบันทึกสำเร็จ ต้องไม่ดึงข้อมูลเก่าที่บันทึกไปแล้วกลับมา
7. หน้า #quotation-edit/{id} ต้อง preserve ข้อมูลระหว่างสลับแท็บเช่นกัน
8. หน้าใบเสนอราคา กดดูรายละเอียด / sorting / checkbox จาก v1.9.2 ยังทำงาน
9. Export Excel ยังทำงาน
10. + เพิ่มสินค้า ยังเปิดฟอร์มได้
```

## Debug helper

ใน Console สามารถรัน:

```js
await window.FI_DEBUG()
```

ข้อมูลที่แสดงจะมี version, route, auth state, role, session presence และ `formAutosave` โดยไม่แสดง access token หรือ anon key
