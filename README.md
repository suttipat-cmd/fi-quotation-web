# FI Quotation Web App v1.4.1

ระบบสร้างและจัดการใบเสนอราคา ด้วย GitHub Pages + Supabase

## สิ่งที่แก้ใน v1.4.1

- แก้ปัญหากดเลือกไฟล์โลโก้/ไอคอนในเมนูตั้งค่าแล้วหน้าจอเหมือน refresh
- สาเหตุเกิดจาก browser ส่ง event `focus` / `visibilitychange` หลังปิด file picker แล้วระบบ resume recovery ของ v1.4 ไป re-render หน้า Settings ทันที ทำให้ไฟล์ที่เลือกหาย
- เพิ่ม guard สำหรับ `input[type=file]` เพื่อไม่ให้ resume recovery re-render ระหว่างเลือกไฟล์
- เพิ่ม toast error ที่ชัดขึ้นเมื่อเลือกไฟล์ผิดประเภทหรือขนาดเกิน 5 MB
- ไม่มี database schema change เพิ่มจาก v1.4

## วิธีติดตั้ง

1. Copy `index.html`, `style.css`, `script.js` ไปทับใน repo `fi-quotation-web`
2. ถ้ายังไม่ได้รัน v1.4 SQL ให้รัน `supabase/patch_v1_4.sql`
3. เปิด Live Server ทดสอบก่อน push
4. Commit และ Push ขึ้น GitHub Pages

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Hotfix v1.4.1 app branding file upload"
git push origin main
```

## ทดสอบหลักหลังติดตั้ง

- ไปที่เมนู ตั้งค่า
- กดเลือกไฟล์โลโก้หน้า Login แล้วหน้าเว็บต้องไม่ re-render เอง
- กดบันทึกโลโก้ Login แล้วต้อง upload สำเร็จ
- กดเลือกไฟล์ Icon เว็บไซต์ แล้วหน้าเว็บต้องไม่ re-render เอง
- กดบันทึก Icon เว็บไซต์ แล้ว favicon ต้องเปลี่ยน
- เปลี่ยน tab อื่นแล้วกลับมา เมนูและเนื้อหายังโหลดได้ตามปกติ
