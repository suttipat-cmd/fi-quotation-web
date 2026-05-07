# FI Quotation Web App v1.9.2

## v1.9.2 Hotfix: Delegated Events Restore

Release นี้ต่อยอดจาก v1.9.1 Foundation Stabilization โดยแก้ regression ในหน้าใบเสนอราคา ที่เกิดจาก delegated event listener ไม่ถูกผูกกลับเข้า runtime สุดท้าย

## สิ่งที่แก้ใน v1.9.2

- อัปเดต cache busting เป็น `style.css?v=1.9.2` และ `script.js?v=1.9.2`
- อัปเดต `window.FI_APP_VERSION = "1.9.2"`
- Restore delegated `click` event สำหรับ:
  - ปุ่ม `ดูรายละเอียด` ในรายการใบเสนอราคา
  - compact quotation links บน Dashboard
  - sorting ที่หัวคอลัมน์
  - menu delegated actions ที่ยังพึ่ง handler กลาง
- Restore delegated `change` event สำหรับ:
  - checkbox รายแถว
  - select all
  - bulk selection state
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
git commit -m "Hotfix v1.9.2 restore delegated events"
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
1.9.2
```

## จุดที่ต้องทดสอบ

```text
1. หน้าใบเสนอราคา กดปุ่ม ดูรายละเอียด แล้วต้องเข้า quotation-view ได้
2. จากหน้ารายละเอียด กด Preview / Print ได้
3. กดหัวคอลัมน์แล้ว sorting ได้
4. checkbox รายแถวเลือกได้
5. select all เลือกได้
6. bulk action enable/disable ตามจำนวนที่เลือก
7. filter แล้ว checkbox state ไม่เพี้ยน
8. Export Excel ยังทำงาน
9. + เพิ่มสินค้า ยังเปิดฟอร์มได้
```

## Debug helper

ใน Console สามารถรัน:

```js
await window.FI_DEBUG()
```

ข้อมูลที่แสดงจะมี version, route, auth state, role และ session presence โดยไม่แสดง access token หรือ anon key
