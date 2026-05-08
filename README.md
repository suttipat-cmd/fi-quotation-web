# FI Quotation Web App v1.9.9

## v1.9.9 Owner Assignment + Sales Name Normalization

Release นี้ต่อยอดจาก v1.9.8 โดยเพิ่มให้ Admin สามารถสร้างหรือแก้ไข Draft ใบเสนอราคาแทน Sales ได้ และยังสามารถสร้างใบเสนอราคาเป็นของ Admin เองได้ด้วย ระบบจะยึด `owner_id` เป็นตัวตนจริงของผู้เสนอราคา และใช้ชื่อปัจจุบันจาก `profiles` เพื่อแสดงผลแทนการยึดชื่อ snapshot

## สิ่งที่แก้ใน v1.9.9

- อัปเดต cache busting เป็น `style.css?v=1.9.9` และ `script.js?v=1.9.9`
- อัปเดต `window.FI_APP_VERSION = "1.9.9"`
- เพิ่ม field `เจ้าของใบเสนอราคา / Sales` ในฟอร์มสร้าง/แก้ไข Draft สำหรับ Admin
  - Admin เลือกได้ทั้งตัวเองและ Sales ที่ active
  - Sales ยังสร้าง/แก้ไขใบของตัวเองตามเดิม
  - Manager ยังสร้าง/แก้ไขไม่ได้ตามเดิม
- ตอนบันทึก Draft จะใช้ `owner_id` จาก dropdown ที่ Admin เลือก
- ปรับ Dashboard / Heatmap / Excel Report ให้ group ตาม `owner_id` และแสดงชื่อปัจจุบันจาก `profiles`
- หน้า View / Preview / Print ใช้ชื่อผู้เสนอราคาปัจจุบันจาก `profiles` ตาม `owner_id`
- เพิ่ม auto-grow textarea ให้ field รายละเอียดเพิ่มเติมขยายสูงตามจำนวนบรรทัดอัตโนมัติ
- เพิ่ม `supabase/patch_v1_9_9.sql` เป็น release marker
- ไม่ต้องรัน SQL ใหม่ถ้าเคยรัน `supabase/patch_v1_9_1.sql` สำเร็จแล้ว

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
  patch_v1_9_9.sql
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
git commit -m "Release v1.9.9 owner assignment sales normalization"
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
1.9.9
```

## Debug helper

```js
await window.FI_DEBUG()
```

ควรเห็นค่าประมาณนี้:

```text
version: 1.9.9
ownerAssignment: true
adminCanCreateOwnQuotation: true
ownerIdSourceOfTruth: true
autoGrowTextarea: true
```
