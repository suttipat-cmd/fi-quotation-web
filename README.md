# FI Quotation Web App v1.11.2

## v1.11.2 Dashboard Pagination + Journey Duplicate Guard

Release นี้ต่อยอดจาก v1.11.1 โดยแก้ปัญหา “เส้นทางใบเสนอราคา” แสดงซ้ำในหน้า `#quotation-view` และเพิ่ม pagination ให้ทุกส่วนรายการ/ตารางใน Dashboard โดยกำหนดค่าเริ่มต้นหน้าละ 5 รายการเหมือนกันทั้งหมด

## สิ่งที่เปลี่ยนใน v1.11.2

- อัปเดต cache busting เป็น `style.css?v=1.11.2` และ `script.js?v=1.11.2`
- อัปเดต `window.FI_APP_VERSION = "1.11.2"`
- แก้ bug Quotation Journey แสดงซ้ำ/เบิ้ลในหน้า `#quotation-view`
  - เพิ่ม duplicate guard หลัง render
  - เพิ่ม observer ป้องกัน async render หรือ stale render ทำให้ card ถูก inject ซ้ำ
  - ตรวจ hash ปัจจุบันก่อน inject Journey card
- เพิ่ม pagination ให้ทุกส่วนรายการ/ตารางบน Dashboard
  - งานที่ต้องทำต่อยังแสดงสถานะละ 5 รายการเหมือนเดิม
  - เอกสารใกล้หมดอายุแสดงหน้าละ 5 รายการ
  - อัปเดตล่าสุดแสดงหน้าละ 5 รายการ
  - ยอดรวมตามฝ่ายขายแสดงหน้าละ 5 รายการ
- เพิ่ม component pagination กลางสำหรับ Dashboard
  - ปุ่ม “ก่อนหน้า / ถัดไป”
  - แสดงจำนวนรายการและเลขหน้า เช่น `หน้า 1 / 3`
- ไม่เปลี่ยน SQL, RLS, Apps Script payload หรือ business logic เดิม

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
  patch_v1_10_2.sql
  patch_v1_10_4.sql
  reset_usage_data_keep_master.sql
  README_SQL.md
  ...patch เก่าที่ใช้ตั้งค่าระบบ
```

## ขั้นตอนติดตั้ง v1.11.2

### 1) ติดตั้งไฟล์เว็บ

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. เปิด Live Server หรือ GitHub Pages แล้วทำ hard refresh

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

### 2) SQL

ไม่ต้องรัน SQL ใหม่สำหรับ v1.11.2

ต้องเคยรัน SQL เหล่านี้สำเร็จแล้ว:

```text
supabase/patch_v1_10_2.sql
supabase/patch_v1_10_4.sql
```

เพราะ v1.11.2 ยังใช้ table `quotation_drive_files` และ RPC `mark_quotation_as_sent_v1104` จาก release ก่อนหน้า

### 3) Google Apps Script

ไม่จำเป็นต้องเปลี่ยน Apps Script ถ้าใช้อยู่บน v1.10.3 หรือใหม่กว่าแล้ว เพราะ v1.11.2 ไม่เปลี่ยน payload การบันทึก PDF ไป Drive

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
git commit -m "Release v1.11.2 dashboard pagination journey duplicate guard"
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
1.11.2
```

## Debug helper

```js
await window.FI_DEBUG()
```

ควรเห็นค่าประมาณนี้:

```text
version: 1.11.2
quotationJourneyDuplicateGuard: true
dashboardAllSectionsPagination: true
dashboardTablePageSize: 5
sqlChanged: false
appsScriptChanged: false
```

## จุดที่ต้องทดสอบทันที

```text
1. หน้า #quotation-view ต้องมี “เส้นทางใบเสนอราคา” เพียงชุดเดียวเสมอ
2. เข้าออกหน้า View หลายครั้ง / กด refresh / กลับจาก Print แล้วต้องไม่เกิด Journey ซ้ำ
3. Dashboard > งานที่ต้องทำต่อ ต้องยังแสดงสถานะละ 5 รายการและ pagination ต้องทำงาน
4. Dashboard > เอกสารใกล้หมดอายุ ต้องแสดงหน้าละ 5 รายการและ pagination ต้องทำงาน
5. Dashboard > อัปเดตล่าสุด ต้องแสดงหน้าละ 5 รายการและ pagination ต้องทำงาน
6. Dashboard > ยอดรวมตามฝ่ายขาย ต้องแสดงหน้าละ 5 รายการและ pagination ต้องทำงาน
7. ปุ่มในรายการ Dashboard ต้องยังเปิดหน้าใบเสนอราคาได้ตามเดิม
8. หน้า #quotation-print และ flow Google Drive / ส่งแล้ว ต้องยังทำงานเหมือน v1.11.1
```
