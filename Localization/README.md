# Localized สำหรับ Journey

ใช้ภาษาไทยอย่างเดียวในรุ่นนี้ ข้อความกลางอยู่ใน th.mjs และเรียกผ่าน localized.mjs ไม่ต้องต่อประโยคซ้ำใน Script

```javascript
import { localized } from '../Localization/localized.mjs';

localized.wait(pageId);                         // รอหน้า <pageId>
localized.tap(buttonId);                        // กด <buttonId>
localized.expectValue(fieldId);                 // ตรวจค่าของ <fieldId>
localized.findByScrolling(containerId, targetId);
localized.sequence(localized.tap(buttonId), localized.waitForHidden(popupId));
```

Page ประกาศ labels ของ action จาก IDFile เช่น labels.waitUntilReady แล้ว Script ใช้:

```javascript
{ id: 'main.wait', name: mainPage.labels.waitUntilReady, action: () => mainPage.waitUntilReady() }
```

Step ID คงเดิม ส่วนข้อความจะเก็บลง result.json/Journal ณ เวลารัน HTML และ Excel อ่านข้อความเดียวกัน รายงานเก่าไม่เปลี่ยนตามการแก้คำในอนาคต
เปลี่ยนคำส่วนกลางที่ th.mjs ได้ ไม่ได้เปลี่ยนการทำงานหรือบันทึก Step ของ Core ทุกคำสั่งอัตโนมัติ
ไม่ใส่ค่าที่กรอก ค่า expected/actual เบอร์โทร รหัสผ่าน หรือ OTP ใน label โดยอัตโนมัติ ใช้เฉพาะ ID หลีกเลี่ยงการส่งข้อมูลลับให้ formatter
หัวตารางรายงาน/วันที่/ข้อความ Error และ UI Dashboard ยังใช้รูปแบบเดิม แยกจาก localized ของ Script action ชุดนี้

## ข้อความหน้าเว็บ

web-th.mjs เป็น Localized สำหรับหัวข้อ ปุ่ม สถานะ และข้อความแจ้งผู้ใช้ของ Dashboard แยกจาก th.mjs/localized.mjs ที่ใช้ชื่อ action ของ Journey
แก้ถ้อยคำ UI ที่ web-th.mjs แล้วรีสตาร์ท Dashboard และรีเฟรชหน้าเว็บ Server จะใส่ข้อความใน HTML และส่ง dictionary ให้ JavaScript ใช้สถานะแบบ dynamic ข้อมูลจากแอป/Backend และ Error เชิงเทคนิคไม่ถูกแปลอัตโนมัติ
หัวตารางใน report.html/Excel ยังอยู่ใน reporter ไม่ได้ย้ายมารวมกับข้อความ Dashboard รอบนี้
