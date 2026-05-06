# FI Quotation Web App v1.4

ระบบสร้างและจัดการใบเสนอราคา ด้วย GitHub Pages + Supabase

## สิ่งที่เพิ่มใน v1.4

- Dashboard เปลี่ยนกราฟจากย้อนหลัง 12 เดือนเป็น 6 เดือน
- นำ Summary Cards กลับมาให้ครบ ได้แก่ จำนวนเอกสารทั้งหมด, ร่าง, ยืนยัน, ส่งแล้ว, ชำระเงิน, ยกเลิก, หมดอายุ, ยอดส่งเดือนนี้ และยอดชำระเดือนนี้
- ปรับกราฟให้มีรายละเอียดมากขึ้น ทั้ง legend, label, ตัวเลข, ตารางสรุป และ empty state
- เปลี่ยนกราฟจำนวนใบเสนอราคาที่ส่งแล้วเป็น Heatmap: ฝ่ายขาย x เดือน
- แก้ reliability เพิ่มเติม: กลับจาก tab อื่นแล้วระบบจะ force re-fetch หน้าเดิม และกดเมนูหน้าเดิมซ้ำเพื่อโหลดใหม่ได้
- ปรับ popup เหตุผลการยกเลิกเป็น Modal เข้าธีมระบบ
- เพิ่มหน้า ตั้งค่า > โลโก้ระบบ สำหรับอัปโหลด logo หน้า Login และ icon เว็บไซต์แยกกัน
- ใช้ logo หน้า Login กับหน้าล็อกอิน และใช้ icon เว็บไซต์กับ browser tab / taskbar ที่ browser รองรับ
- ยังคงตัดสัญลักษณ์ `฿` ออกจากทุกจุดในระบบ

## วิธีติดตั้ง

1. Copy `index.html`, `style.css`, `script.js` ไปทับใน repo `fi-quotation-web`
2. Copy โฟลเดอร์ `supabase` ไปไว้ใน repo
3. ไปที่ Supabase SQL Editor แล้วรัน `supabase/patch_v1_4.sql`
4. เปิด Live Server ทดสอบก่อน push
5. Commit และ Push ขึ้น GitHub Pages

## Push ผ่าน VS Code Terminal

```bash
git status
git add .
git commit -m "Release v1.4 dashboard branding and reliability"
git push origin main
```

## ทดสอบหลักหลังติดตั้ง

- Dashboard แสดง summary cards ครบและกราฟย้อนหลัง 6 เดือน
- กราฟยอดส่งแล้ว/ชำระเงินมีตัวเลขและตารางรายละเอียด
- Heatmap ฝ่ายขาย x เดือนแสดงจำนวนใบเสนอราคาส่งแล้วถูกต้อง
- เปลี่ยนไป tab อื่นแล้วกลับมา ข้อมูลหน้าเดิมต้องโหลดขึ้นโดยไม่ต้อง refresh browser
- กดเมนูหน้าเดิมซ้ำแล้วข้อมูลต้อง fetch/render ใหม่ได้
- Modal ยกเลิกเอกสารแสดงสวยและกรอกเหตุผลได้
- หน้า Settings อัปโหลด logo หน้า Login ได้
- หน้า Settings อัปโหลด icon เว็บไซต์ได้ และ favicon ใน browser tab เปลี่ยนหลังบันทึก
- ระบบยัง Export Excel และเปลี่ยนสถานะตาม v1.3 ได้ตามปกติ

## Security Notes

- ใช้เฉพาะ Supabase anon public key ใน frontend
- ห้ามใส่ service_role key ใน `script.js`
- App logo/icon เก็บใน Supabase Storage bucket `app-assets`
- `app_settings` เปิดให้อ่านได้ เพื่อให้หน้า Login โหลด logo ได้ก่อนเข้าสู่ระบบ
- Upload/แก้ไข logo/icon จำกัดเฉพาะ Admin ด้วย RLS policy
