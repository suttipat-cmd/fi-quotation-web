# FI Quotation Web App v1.9.8

## v1.9.8 Dashboard Sent/Paid Business Logic Hotfix

Release นี้ต่อยอดจาก v1.9.7 โดยแก้ logic Dashboard และ Excel Report ให้ความหมายของ `ยอดส่งแล้ว` ตรงตามธุรกิจจริง: ยอดส่งแล้วคือมูลค่าใบเสนอราคาที่เคยส่งให้ลูกค้าแล้วทั้งหมด ดังนั้นใบเสนอราคาที่เปลี่ยนเป็นสถานะ `paid` แล้วยังต้องถูกนับรวมในยอดส่งแล้วด้วย ส่วน `ยอดชำระเงิน` จะนับแยกจากใบที่ชำระเงินแล้ว

## สิ่งที่แก้ใน v1.9.8

- อัปเดต cache busting เป็น `style.css?v=1.9.8` และ `script.js?v=1.9.8`
- อัปเดต `window.FI_APP_VERSION = "1.9.8"`
- แก้ Dashboard:
  - `ยอดส่งแล้ว` รวมใบที่สถานะ `sent` และ `paid`
  - ใช้ `sent_at` เป็นวันที่หลักสำหรับ bucket ยอดส่งแล้ว
  - ถ้าไม่มี `sent_at` แต่เป็น paid ให้ fallback เป็น `paid_at`, `quote_date`, `created_at`
  - `ยอดชำระเงิน` ใช้ `paid_at` เป็นวันที่หลัก
  - จำนวนใบเสนอราคาส่งแล้วแยกตาม Sales/เดือนรวมใบที่ชำระเงินแล้วด้วย
- แก้ Excel Report:
  - Summary ใช้ logic ยอดส่งแล้วแบบเดียวกับ Dashboard
  - By Sales ใช้ logic ยอดส่งแล้วแบบเดียวกับ Dashboard
  - เพิ่มส่วนต่างยอดส่งกับชำระและ Conversion โดยยอด
- ไม่เปลี่ยน filter สถานะในหน้า List View
  - Filter `ส่งแล้ว` ยังหมายถึงสถานะปัจจุบันเป็น sent เท่านั้น
  - ไม่เอา paid มาปนใน filter เพื่อไม่ให้ผู้ใช้สับสน
- ไม่เปลี่ยน SQL / RLS ในรอบนี้
- ไม่ต้องรัน SQL patch ใหม่เพื่อใช้ v1.9.8

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
  patch_v1_9_8.sql
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
git commit -m "Hotfix v1.9.8 dashboard sent paid logic"
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
1.9.8
```

## จุดที่ต้องทดสอบ

```text
1. window.FI_APP_VERSION ต้องได้ 1.9.8
2. ใบเสนอราคาสถานะ sent ต้องถูกนับในยอดส่งแล้ว
3. ใบเสนอราคาสถานะ paid ต้องถูกนับทั้งยอดส่งแล้วและยอดชำระเงิน
4. กราฟ 6 เดือนต้องแสดงยอดส่งแล้วรวม paid rows ด้วย
5. กราฟจำนวนใบเสนอราคาส่งแล้วแยกตาม Sales/เดือนต้องรวม paid rows ด้วย
6. Filter สถานะใน List View ยังต้องแยก sent และ paid ตามสถานะปัจจุบัน
7. Export Excel Summary ต้องแสดงยอดส่งแล้วรวมใบ paid
8. Export Excel By Sales ต้องแสดงยอดส่งแล้วรวมใบ paid
9. Mobile UX จาก v1.9.7 ยังทำงานเหมือนเดิม
10. ไม่ต้องรัน SQL ใหม่
```

## Debug helper

ใน Console สามารถรัน:

```js
await window.FI_DEBUG()
```

ควรเห็นค่าประมาณนี้:

```text
version: 1.9.8
dashboardBusinessSentLogic: true
sentIncludesPaidRows: true
excelBusinessSentLogic: true
```
