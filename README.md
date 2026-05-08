# FI Quotation Web App v1.9.4

## v1.9.4 Hotfix: Recurring Description Field + One-time Defaults

Release นี้ต่อยอดจาก v1.9.3 Hotfix: Quotation Form State Preservation โดยเพิ่ม field รายละเอียดเพิ่มเติมในส่วนค่าบริการชำระรายเดือน/รายปี และปรับค่าเริ่มต้นของค่าบริการชำระครั้งเดียวตาม requirement ล่าสุด

## สิ่งที่แก้ใน v1.9.4

- อัปเดต cache busting เป็น `style.css?v=1.9.4` และ `script.js?v=1.9.4`
- อัปเดต `window.FI_APP_VERSION = "1.9.4"`
- เพิ่ม field `รายละเอียดเพิ่มเติม` ในส่วนค่าบริการชำระรายเดือน/รายปี
- บันทึก field ใหม่นี้ลง `quotation_items.description` ของรายการ `section_type = recurring`
- รองรับการแก้ไข Draft โดยดึงรายละเอียดเดิมกลับมาแสดงใน field ใหม่
- ผูก field ใหม่เข้ากับ autosave จาก v1.9.3 เพื่อให้ข้อมูลไม่หายตอนสลับแท็บหรือ refresh
- เปลี่ยน default ช่อง `รายการ` ของค่าบริการชำระครั้งเดียวเป็น `ค่าบริการเซ็ตอัพข้อมูล`
- เปลี่ยน default ช่อง `รายละเอียดเพิ่มเติม` ของค่าบริการชำระครั้งเดียวเป็น 3 บรรทัด:

```text
ค่าบริการเซ็ตอัพข้อมูลทั่วไปของหน่วยงาน
ค่าบริการฝึกอบรมซอฟต์แวร์ระบบ
ค่าบริการเซ็ตอัพทะเบียนรถ
```

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
  patch_v1_9_4.sql
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
git commit -m "Hotfix v1.9.4 recurring description defaults"
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
1.9.4
```

## จุดที่ต้องทดสอบ

```text
1. เข้า #quotation-new
2. ส่วนค่าบริการชำระรายเดือน/รายปี ต้องมี field รายละเอียดเพิ่มเติม
3. กรอกรายละเอียดเพิ่มเติมของค่าบริการรายเดือน/รายปี แล้วบันทึกร่าง
4. เปิดรายละเอียดใบเสนอราคา ต้องเห็นรายละเอียดนี้ในตารางบน
5. Preview / Print ต้องเห็นรายละเอียดนี้ในตารางบน
6. แก้ไข Draft ต้องดึงรายละเอียดเดิมกลับมาใน field ใหม่
7. สลับแท็บหรือ refresh หน้า form แล้ว field ใหม่นี้ต้อง autosave/restore ได้
8. ช่องรายการของค่าบริการชำระครั้งเดียวต้อง default เป็น ค่าบริการเซ็ตอัพข้อมูล
9. ช่องรายละเอียดเพิ่มเติมของค่าบริการชำระครั้งเดียวต้อง default เป็น 3 บรรทัดตาม requirement
10. autosave จาก v1.9.3, ปุ่มดูรายละเอียด, sorting, checkbox และ Export Excel ยังทำงาน
```

## Debug helper

ใน Console สามารถรัน:

```js
await window.FI_DEBUG()
```

ข้อมูลที่แสดงจะมี version, route, auth state, role, session presence และ `formAutosave` โดยไม่แสดง access token หรือ anon key
