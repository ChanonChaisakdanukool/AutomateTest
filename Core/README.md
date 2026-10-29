# Core interface

สร้างด้วย `createCore({ driver, platform })` จาก `Core/index.mjs` หลัง Main Manager เปิด session แล้ว ใช้หนึ่ง Core ต่อหนึ่ง session ห้ามรันคำสั่งขนานใน session เดียวกัน เริ่ม iOS/Android ใน NATIVE_APP; Web ใช้ browser session

```javascript
import { createCore } from './Core/index.mjs';
import { TIMEOUTS } from './Config/timeouts.mjs';
const core = createCore({ driver, platform: 'iOS' });
const element = await core.findByScrolling({
  containerId: 'cartList', targetId: 'price', withinId: 'product123',
  direction: 'down', maxScrolls: 5, timeout: TIMEOUTS.findByScrolling,
});
await core.expectText(element, '50.00');
```

ตัวอย่าง ID สมมุติ ต้องแทนด้วย ID จาก contract จริง

| API | Input / ผลลัพธ์ |
|---|---|
| findElement | ID, { withinId?, timeout? } → Element; ไม่เลื่อน |
| findByScrolling | { containerId, targetId, withinId?, direction?, maxScrolls?, timeout? } → Element |
| waitForVisible / waitForHidden | ID, { withinId?, timeout? }; hidden สำเร็จเมื่อไม่มีหรืออยู่นอก viewport |
| tap / clearText | Element, { timeout? } |
| inputText | Element, string, { timeout? }; ส่งข้อความ ไม่ล้างเดิมอัตโนมัติ |
| getText / getValue | Element, { timeout? } → ค่าที่ driver ส่งกลับ |
| isVisible / isEnabled | Element, { timeout? } → boolean; system error ส่งต่อ |
| expectVisible | Element, { timeout? } |
| expectText / expectValue | Element, expected, { timeout? }; เทียบแบบ exact ไม่แปลงชนิด |
| switchToNative | { timeout? } |
| switchToWebView | ชื่อ context ตรงตัว, { timeout? } |

Element เป็น reference ของ Core ไม่ใช่ WebdriverIO `$` element; หลังเปลี่ยน context ต้องค้นหาใหม่ หาก stale ให้ error ต่อ ไม่เลือก element ใหม่เงียบ ๆ

## Platform adapters
- iOS: accessibility id, getValue อ่าน value, mobile: scroll
- Android: resource-id, getValue อ่าน text, mobile: scrollGesture
- Web: DOM id, getValue อ่าน property value, เลื่อน container ผ่าน scrollTop/scrollLeft

ปรับ locator ให้ตรงกับการผูก ID ของแอปได้ผ่าน `locators: { Android: id => ({ using: 'accessibility id', value: id }) }` ไม่เดา resource-id/content-desc/testTag สลับไปมา สำหรับ control ชนิดพิเศษ เช่น switch หรือ picker ต้องเพิ่ม value mapping ตามแอปจริงก่อนใช้

Scroll ค้นหาใหม่ทุกครั้ง รวม container และ row; target ต้องแสดงและอยู่เต็มในขอบเขต container และ viewport ตรวจครั้งสุดท้ายหลังเลื่อนครบกำหนดด้วย ไม่รับประกันว่า element ไม่มี overlay บัง ภาพ animation, nested clipping และ gesture ต้องทดสอบบนแอปจริง

## Deadline และ Error
ทุกเวลามาจาก Config/timeouts.mjs; timeout override ใช้ต่อ operation ทั้งหมด รวมทุก scroll/poll ไม่มี reset budget ระหว่างทาง คำสั่งมี timeout ไม่ได้หมายถึงยกเลิกคำสั่งบน device ได้

COMMAND_TIMEOUT จะทำให้ Core ปฏิเสธคำสั่งถัดไป (SESSION_UNCERTAIN) ให้ Main Manager จัดการหยุด session ไม่ retry ธุรกรรม Core ไม่ reset แอปและไม่เลือก testcase

ELEMENT_NOT_FOUND, SCROLL_TARGET_NOT_VISIBLE, CONTAINER_NOT_FOUND, AMBIGUOUS_ELEMENT แยกจาก ASSERTION_MISMATCH; session/driver errors ส่งต่อเดิม ไม่กลบเป็น false การแปลงเป็น FAIL/ERROR เป็นหน้าที่ Main Manager: mismatch คือหลักฐานพฤติกรรมไม่ตรง ส่วน timeout/หาไม่พบต้องดูบริบท ไม่สรุปสาเหตุอัตโนมัติ

Unit tests ใช้ driver จำลอง ยังไม่ยืนยันการทำงานบน simulator/emulator/เครื่องจริงหรือ WebView จริง
