# FI Quotation Web App v1.2

ระบบสร้างและจัดการใบเสนอราคา ด้วย GitHub Pages + Supabase

## สิ่งที่เพิ่มใน v1.2

- แก้ปัญหากลับมาจาก tab อื่นแล้วกดเมนูหรือ action ไม่ติด โดยเพิ่ม session recovery ตอนกลับมาที่หน้าเว็บ
- ลดอาการหน้าเว็บ flash ไปหน้า Login ตอน refresh ด้วย boot screen ก่อนตรวจ session
- ย้ายชื่อผู้ใช้มาแสดงแทน `บริษัท A` ใน Topbar โดยใช้รูปแบบ `full_name · role`
- กดออกจากระบบแล้วมี popup ให้ยืนยันก่อน
- หน้า List ใบเสนอราคาเพิ่ม filter:
  - ช่วงวันที่เสนอราคา
  - ช่วงวันหมดอายุ
- จำกัดช่วงวันที่แต่ละช่วงไม่เกิน 3 เดือน
- เปลี่ยน Export เป็นไฟล์ `.xlsx` จริงเท่านั้น
- ปุ่ม Export Excel จะ disabled จนกว่าจะเลือกช่วงวันที่เสนอราคาหรือช่วงวันหมดอายุอย่างน้อย 1 ช่วง

## วิธีติดตั้ง

1. Copy `index.html`, `style.css`, `script.js` ไปทับใน repo `fi-quotation-web`
2. Copy โฟลเดอร์ `supabase` ไปไว้ใน repo
3. v1.2 ไม่มี database schema change แต่มีไฟล์ `supabase/patch_v1_2.sql` สำหรับบันทึก release note
4. เปิด Live Server ทดสอบก่อน push
5. Commit และ Push ขึ้น GitHub Pages

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Release v1.2 reliability and Excel export"
git push origin main
```

## ทดสอบหลักหลังติดตั้ง

- Refresh หน้าเว็บแล้วไม่เห็นหน้า Login แวบขึ้นมาถ้ามี session อยู่
- เปลี่ยนไป tab อื่นแล้วกลับมา เมนูและปุ่มยังใช้งานได้
- กดออกจากระบบแล้วมี popup ยืนยัน
- หน้าใบเสนอราคาเลือกช่วงวันที่เสนอราคาไม่เกิน 3 เดือน แล้ว Export Excel ได้
- หน้าใบเสนอราคาเลือกช่วงวันหมดอายุไม่เกิน 3 เดือน แล้ว Export Excel ได้
- เลือกช่วงวันที่เกิน 3 เดือน แล้วปุ่ม Export ถูก disabled
- ไม่เลือกช่วงวันที่เลย แล้วปุ่ม Export ถูก disabled
