# FI Quotation Web App v1.7.3

## v1.7.3 Boot Watchdog + Auth Boot Final Guard

Release นี้แก้ปัญหาหลัง Refresh Browser แล้วหน้าเว็บค้างอยู่ที่ `กำลังเปิดระบบ` ตลอด

## สิ่งที่แก้

- เพิ่ม Boot Watchdog: ถ้าเปิดระบบนานเกิน 9 วินาที จะกลับหน้า Login แบบ clean แทนการหมุนค้าง
- เพิ่ม timeout เฉพาะจุดที่เสี่ยงค้าง เช่น `getSession()` และการโหลด branding
- ถ้า Supabase SDK/CDN โหลดไม่สำเร็จ จะแสดง error ที่หน้า Login แทนค้างที่ Boot
- Auth boot ไม่ block ด้วย branding อีกต่อไป
- ถ้าไม่มี session หลัง refresh จะกลับหน้า Login แบบ clean และจำ hash เดิมไว้
- หลัง login สำเร็จจะกลับไปหน้าเดิมที่เคยเปิดไว้
- คง fix ของ v1.7.2: Product Form recursion และ Product Code ซ้ำได้
- Cache busting เป็น `script.js?v=1.7.3` และ `style.css?v=1.7.3`

## วิธีติดตั้ง

1. แตก ZIP
2. Copy ไฟล์ทั้งหมดในโฟลเดอร์ `fi-quotation-web-v1.7.3-package` ไปทับ repo เดิม
3. ถ้าเคยรัน `patch_v1_7_2.sql` แล้ว รอบนี้ไม่จำเป็นต้องรัน SQL เพิ่ม
4. เปิด Live Server ทดสอบก่อน push

## Push

```bash
git status
git add .
git commit -m "Hotfix v1.7.3 boot watchdog and auth guard"
git push origin main
```

## หลัง Push

ทำ hard refresh:

- Mac: Command + Shift + R
- Windows: Ctrl + Shift + R

## ตรวจเวอร์ชัน

```js
window.FI_APP_VERSION
```

ต้องได้:

```text
1.7.3
```
