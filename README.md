# FI Quotation Web App v1.11.1

## v1.11.1 Dashboard + Print Action UX Refinement

Release นี้ต่อยอดจาก v1.11.0 โดยปรับ UX ของ Dashboard และหน้า `#quotation-print` ให้กระชับขึ้น ลดปุ่มซ้ำใน Quotation Journey เพิ่ม pagination ให้บอร์ดงานที่ต้องทำต่อ และปรับ wording หลักให้ใช้ภาษาไทยสอดคล้องกันมากขึ้น

## สิ่งที่เปลี่ยนใน v1.11.1

- อัปเดต cache busting เป็น `style.css?v=1.11.1` และ `script.js?v=1.11.1`
- อัปเดต `window.FI_APP_VERSION = "1.11.1"`
- ปรับ Quotation Journey ให้เป็นส่วนแสดงสถานะเท่านั้น ไม่แสดงปุ่ม action ซ้ำ
- เพิ่ม pagination ในบอร์ด “งานที่ต้องทำต่อ” บน Dashboard
  - แสดงค่าเริ่มต้นสถานะละ 5 รายการ
  - มีปุ่ม “ก่อนหน้า / ถัดไป” แยกในแต่ละสถานะ
- ปรับ Dashboard ให้มีข้อมูลเชิงวิเคราะห์มากขึ้น
  - มูลค่ารอบันทึก PDF
  - มูลค่าพร้อมส่งแล้ว
  - มูลค่าส่งแล้ว
  - ใบใกล้หมดอายุภายใน 7 วัน
- ปรับลำดับ Dashboard ให้เริ่มจากตัวเลขสำคัญ → ข้อมูลเชิงวิเคราะห์ → งานที่ต้องทำต่อ → รายการใกล้หมดอายุ/อัปเดตล่าสุด → ยอดรวมตามฝ่ายขาย
- ปรับคำภาษาไทยให้สอดคล้องขึ้น เช่น แดชบอร์ด, ข้อมูลบริษัท, ตั้งค่า, ฝ่ายขาย, ร่าง, ยืนยันแล้ว, ส่งแล้ว, การดำเนินการ
- ปรับ layout หน้า `#quotation-print`
  - แยกส่วน “ไฟล์ในเครื่อง”, “Google Drive”, “การส่งใบเสนอราคา” ให้ชัดเจน
  - ลดกรอบซ้อนหลายชั้น
  - ปุ่ม “พิมพ์ / บันทึกเป็น PDF” และ “เปิดไฟล์ใน Google Drive” กระชับขึ้น
  - รองรับทั้งกรณียังไม่บันทึก Drive, บันทึก Drive แล้ว, ยังไม่กรอกข้อมูลส่ง, และส่งแล้ว
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

## ขั้นตอนติดตั้ง v1.11.1

### 1) ติดตั้งไฟล์เว็บ

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ package ไปทับ repo `fi-quotation-web`
3. เปิด Live Server หรือ GitHub Pages แล้วทำ hard refresh

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

### 2) SQL

ไม่ต้องรัน SQL ใหม่สำหรับ v1.11.1

ต้องเคยรัน SQL เหล่านี้สำเร็จแล้ว:

```text
supabase/patch_v1_10_2.sql
supabase/patch_v1_10_4.sql
```

เพราะ v1.11.1 ยังใช้ table `quotation_drive_files` และ RPC `mark_quotation_as_sent_v1104` จาก release ก่อนหน้า

### 3) Google Apps Script

ไม่จำเป็นต้องเปลี่ยน Apps Script ถ้าใช้อยู่บน v1.10.3 หรือใหม่กว่าแล้ว เพราะ v1.11.1 ไม่เปลี่ยน payload การบันทึก PDF ไป Drive

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
git commit -m "Release v1.11.1 dashboard print ux refinement"
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
1.11.1
```

## Debug helper

```js
await window.FI_DEBUG()
```

ควรเห็นค่าประมาณนี้:

```text
version: 1.11.1
quotationJourneyActionsRemoved: true
dashboardWorkspacePagination: true
dashboardWorkspacePageSize: 5
thaiWordingPolish: true
printActionPanelRefined: true
sqlChanged: false
```

## จุดที่ต้องทดสอบทันที

```text
1. Dashboard ต้องแสดงภาษาไทยครบถ้วนขึ้น เช่น แดชบอร์ด / ฝ่ายขาย / ร่าง / ยืนยันแล้ว / ส่งแล้ว
2. Quotation Journey ในหน้า View และ Print ต้องไม่มีปุ่ม action ซ้ำ
3. บอร์ด “งานที่ต้องทำต่อ” ต้องแสดงสถานะละ 5 รายการ
4. ปุ่มก่อนหน้า / ถัดไป ในแต่ละสถานะต้องทำงาน
5. Dashboard ต้องแสดงข้อมูลเชิงวิเคราะห์ เช่น รอบันทึก PDF / พร้อมส่งแล้ว / ส่งแล้ว / ใกล้หมดอายุ
6. หน้า #quotation-print ต้องมี panel จัดการเอกสารแบบกระชับ
7. ปุ่มพิมพ์ / บันทึกเป็น PDF ต้องอยู่ในส่วนไฟล์ในเครื่อง
8. สถานะ Google Drive ต้องแยกชัดว่า ยังไม่บันทึก / บันทึกแล้ว / เปิดไฟล์ได้
9. ถ้ายังไม่มี Drive PDF ปุ่มส่งแล้วต้องยัง disabled
10. ถ้ามี Drive PDF แล้ว ปุ่มส่งแล้วต้องใช้งานได้และเปิด modal ข้อมูลผู้รับเหมือนเดิม
11. ถ้าส่งแล้ว ต้องแสดงข้อมูลการส่งแบบ compact และอ่านง่าย
12. Flow บันทึก PDF ลง Google Drive เดิมต้องยังทำงาน
```
