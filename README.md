# FI Quotation Web App v1.11.0

## v1.11.0 Quotation Journey UX

Release นี้ต่อยอดจาก v1.10.5 เพื่อปรับ UX ของ flow การสร้างและส่งใบเสนอราคาให้เป็นเส้นทางงานที่ชัดเจนขึ้น ตั้งแต่ผู้ใช้ login เข้าระบบ เห็นงานที่ต้องทำต่อ สร้าง Draft ยืนยันเอกสาร บันทึก PDF ลง Google Drive และกรอกข้อมูลการส่งใบเสนอราคา

## สิ่งที่เปลี่ยนใน v1.11.0

- อัปเดต cache busting เป็น `style.css?v=1.11.0` และ `script.js?v=1.11.0`
- อัปเดต `window.FI_APP_VERSION = "1.11.0"`
- เพิ่ม Quotation Workspace บน Dashboard เพื่อแยกงานที่ต้องทำต่อเป็น 4 กลุ่ม
  - Draft ที่ยังไม่เสร็จ
  - ใบที่ยืนยันแล้วแต่ยังไม่ได้บันทึก PDF ลง Google Drive
  - ใบที่มี PDF แล้วและพร้อมกรอกข้อมูลการส่ง
  - ใบที่ส่งแล้วล่าสุด
- เพิ่ม Quotation Journey card บนหน้า `#quotation-view`
- เพิ่ม Journey card แบบ compact บนหน้า `#quotation-print`
- เพิ่ม stepper: ร่าง → ยืนยัน → บันทึก PDF → ส่งแล้ว
- ทำ primary action ตามสถานะของใบเสนอราคา
  - Draft: ตรวจสอบ / ยืนยัน, แก้ไข Draft
  - Confirmed ยังไม่มี Drive PDF: บันทึก PDF ลง Google Drive
  - Confirmed มี Drive PDF แล้ว: ส่งแล้ว
  - Sent: เปิดไฟล์ใน Google Drive
- เพิ่ม guidance บนหน้า Create/Edit Draft เพื่อให้ผู้ใช้เข้าใจว่าต้องบันทึก Draft และตรวจสอบก่อน Confirm
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

## ขั้นตอนติดตั้ง v1.11.0

### 1) ติดตั้งไฟล์เว็บ

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. เปิด Live Server หรือ GitHub Pages แล้วทำ hard refresh

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

### 2) SQL

ไม่ต้องรัน SQL ใหม่สำหรับ v1.11.0

ต้องเคยรัน SQL เหล่านี้สำเร็จแล้ว:

```text
supabase/patch_v1_10_2.sql
supabase/patch_v1_10_4.sql
```

เพราะ v1.11.0 ยังใช้ table `quotation_drive_files` และ RPC `mark_quotation_as_sent_v1104` จาก release ก่อนหน้า

### 3) Google Apps Script

ไม่จำเป็นต้องเปลี่ยน Apps Script ถ้าใช้อยู่บน v1.10.3 หรือใหม่กว่าแล้ว เพราะ v1.11.0 ไม่เปลี่ยน payload การบันทึก PDF ไป Drive

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
git commit -m "Release v1.11.0 quotation journey ux"
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
1.11.0
```

## Debug helper

```js
await window.FI_DEBUG()
```

ควรเห็นค่าประมาณนี้:

```text
version: 1.11.0
quotationJourneyUX: true
dashboardWorkspace: true
stateMachine: draft -> confirmed_needs_drive -> ready_to_send -> sent
sqlChanged: false
```

## จุดที่ต้องทดสอบทันที

```text
1. Dashboard ต้องมี Quotation Workspace และแยกงานที่ต้องทำต่อได้
2. กดงาน Draft จาก Dashboard แล้วไปหน้า View/Edit ได้ถูกต้อง
3. กดงานที่รอบันทึก PDF แล้วไปหน้า Preview / Print ได้ถูกต้อง
4. หน้า View ต้องมี Quotation Journey card และ stepper
5. หน้า Print ต้องมี Journey card แบบ compact
6. Draft ต้องแสดง step ร่าง และ action ตรวจสอบ / ยืนยัน
7. Confirmed ที่ยังไม่มี Drive PDF ต้องแสดง action บันทึก PDF ลง Google Drive
8. Confirmed ที่มี Drive PDF แล้วต้องแสดง action ส่งแล้ว
9. Sent ต้องแสดง action เปิดไฟล์ใน Google Drive และไม่ชวนส่งซ้ำ
10. Flow เดิมของบันทึก PDF ลง Drive และ modal กรอกข้อมูลผู้รับยังทำงานเหมือน v1.10.5
```
