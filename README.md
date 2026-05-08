# FI Quotation Web App v1.9.7

## v1.9.7 Mobile UX Layer

Release นี้ต่อยอดจาก v1.9.6 โดยเพิ่ม UX เฉพาะ Mobile Browser เพื่อให้ใช้งานบนโทรศัพท์ได้สะดวกขึ้น โดยไม่เปลี่ยน SQL / RLS และไม่รื้อ Desktop layout เดิม

## สิ่งที่แก้ใน v1.9.7

- อัปเดต cache busting เป็น `style.css?v=1.9.7` และ `script.js?v=1.9.7`
- อัปเดต `window.FI_APP_VERSION = "1.9.7"`
- เพิ่ม Mobile bottom navigation ที่ด้านล่างหน้าจอ
- ปรับ header บนมือถือให้กระชับขึ้น
- เปลี่ยนตารางหลักบนมือถือให้แสดงเป็น card list:
  - ตารางใบเสนอราคา
  - ตารางลูกค้า
  - ตารางสินค้า/บริการ
  - ตารางยอดรวมตาม Sales บน Dashboard
  - ตารางรายการสินค้าในหน้า View ใบเสนอราคา
- Desktop ยังใช้ตารางแบบเดิม
- ปรับฟอร์มสร้าง/แก้ไขใบเสนอราคาให้เหมาะกับมือถือ:
  - single column layout
  - input/select/textarea สูงขึ้นและแตะง่ายขึ้น
  - ปุ่มบันทึก/ยกเลิกเป็น sticky action เหนือ bottom nav
  - เพิ่มแถบสรุปยอดบนมือถือเพื่อเห็นยอดรวมได้ง่ายขึ้น
- ปรับ filter/action/pagination ให้เรียงเต็มบรรทัดบนมือถือ
- หน้า Preview / Print บนมือถือยังคงสัดส่วน A4 จริง และให้ scroll แทนการบีบกระดาษ
- ไม่เปลี่ยน SQL / RLS ในรอบนี้
- ไม่ต้องรัน SQL patch ใหม่เพื่อใช้ v1.9.7

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
  patch_v1_9_7.sql
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
git commit -m "Release v1.9.7 mobile ux layer"
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
1.9.7
```

## จุดที่ต้องทดสอบ

```text
1. window.FI_APP_VERSION ต้องได้ 1.9.7
2. เปิดบนมือถือแล้วเมนูหลักต้องอยู่ด้านล่างหน้าจอ
3. หน้าใบเสนอราคาบนมือถือแสดงเป็น card list ไม่ต้องเลื่อนตารางแนวนอน
4. กดดูใบเสนอราคาจาก card ได้
5. checkbox ใน card ใบเสนอราคายังใช้งานได้
6. pagination หน้าใบเสนอราคายังทำงานบนมือถือ
7. หน้า Customers / Products / Sales Summary แสดงเป็น card list บนมือถือ
8. ฟอร์มสร้างใบเสนอราคาเป็น single column
9. ปุ่มบันทึก/ยกเลิกอยู่ใกล้นิ้วและไม่โดน bottom nav บัง
10. แถบสรุปยอดบนมือถือแสดงยอดรวมและกดพาไปดู summary ได้
11. หน้า Preview / Print บนมือถือไม่บีบ A4 ผิดสัดส่วน และสามารถ scroll ดูได้
12. Desktop layout เดิมยังทำงานเหมือน v1.9.6
```

## Debug helper

ใน Console สามารถรัน:

```js
await window.FI_DEBUG()
```

ข้อมูลที่แสดงจะมี version, route, auth state, role, session presence, formAutosave, pagination, snapshot cache และสถานะ mobile UX layer โดยไม่แสดง access token หรือ anon key
