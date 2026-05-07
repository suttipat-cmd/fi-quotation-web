# FI Quotation Web App v1.6.2

## v1.6.2 Auth Boot Fix

Release นี้แก้ปัญหาเฉพาะจุดที่พบในหน้า Login หลัง v1.6.1: เมื่อ browser มี Supabase session/token เก่าที่เสียหรือหมดอายุ ระบบจะแสดง error แดงว่า `ไม่สามารถตรวจสอบ session ได้` ทั้งที่ผู้ใช้ควรเห็นหน้า Login ปกติและเข้าสู่ระบบใหม่ได้ทันที

## สิ่งที่แก้ใน v1.6.2

- ถ้า `supabase.auth.getSession()` error ตอนเปิดระบบ จะถือว่าเป็น session เก่าที่ใช้ไม่ได้
- ล้าง local/session storage เฉพาะ key ของ Supabase project นี้
- แสดงหน้า Login แบบ clean โดยไม่โชว์ error แดงจาก session เก่า
- แสดง error บนหน้า Login เฉพาะกรณี:
  - อีเมล/รหัสผ่านผิด
  - Login สำเร็จแล้วแต่โหลด profile ไม่ได้
- ปรับ `renderCurrentPage()` ให้ session error ตอนยังไม่ authenticated กลับไปหน้า Login แบบ clean
- ปรับ `recoverAppAfterResume()` ให้ session error หลังกลับจากแท็บอื่นไม่ทำให้หน้า Login ค้าง error ผิดบริบท
- เพิ่ม cache busting เป็น `script.js?v=1.6.2` และ `style.css?v=1.6.2`
- คง feature จาก v1.6/v1.6.1 เดิม เช่น Required `*` สีแดง, Product Code ซ้ำได้แต่ Product Name ห้ามซ้ำ, Excel Export 5 sheets, และ loading retry state

## ไฟล์ใน package

```text
index.html
style.css
script.js
README.md
TEST_CHECKLIST.md
supabase/patch_v1_5.sql
supabase/patch_v1_5_1.sql
supabase/patch_v1_6.sql
supabase/patch_v1_6_1.sql
supabase/patch_v1_6_2.sql
```

## วิธีติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดไปทับใน repo `fi-quotation-web`
3. ถ้าเคยรัน SQL ถึง v1.6 แล้ว ไม่จำเป็นต้องรัน SQL เพิ่ม
4. ถ้าต้องการบันทึก version ใน Supabase สามารถรัน `supabase/patch_v1_6_2.sql` ได้ ไฟล์นี้เป็น no schema change
5. เปิด Live Server ทดสอบก่อน push

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Hotfix v1.6.2 auth boot session handling"
git push origin main
```

## หลัง Push ขึ้น GitHub Pages

ให้ทำ hard refresh 1 ครั้งเพื่อให้ browser โหลดไฟล์ใหม่:

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

## จุดที่ควรทดสอบ

- เปิดหน้า Login หลังเคย login ค้างไว้ ต้องไม่ขึ้น error `ไม่สามารถตรวจสอบ session ได้`
- กรอก email/password ถูกต้องแล้วต้องเข้า Dashboard ได้
- กรอก email/password ผิด ต้องขึ้น error login ผิดตามปกติ
- เปิดเว็บทิ้งไว้แล้วกลับจาก tab อื่น ต้องไม่ค้าง loading
- ถ้า session หมดอายุจริง ต้องกลับมาหน้า Login แบบ clean
