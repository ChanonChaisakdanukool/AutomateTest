# Configuration-driven Test Automation

Appium + WebdriverIO สำหรับทดสอบแอปจาก Config ปัจจุบันมี Core, Main Manager และ Login scripts สองเคส ใช้ IDFile แบบ nested constants

## เริ่มใช้งาน

1. ติดตั้ง dependencies ด้วย npm ci (Node.js 22.12+)
2. เตรียม Config/Local/DeviceConfig.ios.json หรือ DeviceConfig.android.json จาก Config/Examples
3. เตรียม Config/Local/RunConfig.json จากตัวอย่าง ใส่ platform และค่ากลางให้ตรงสภาพแวดล้อม
4. เปิด Simulator/อุปกรณ์และติดตั้ง build ที่ผูก IDs ล่าสุด
5. ดับเบิลคลิก StartAppium.command แล้วเปิด RunAutomate.command

Launcher อ่าน RunConfig โดยไม่ถามเลือกไฟล์ platform=iOS เลือก Config/Local/DeviceConfig.ios.json และ platform=Android เลือก DeviceConfig.android.json ตรวจ platform ให้ตรงกันก่อนสร้าง session

## Config และเคส

RunConfig เก็บ runName, shouldContinueNextCaseWhenFail, platform, ค่ากลาง Login และ testCases โดยอ้าง { "file": "../TestCases/LOGIN_OPEN_PROFILE.json" } หรือใช้ inline { "case": { "id": "LOGIN_OPEN_PROFILE" } }

เส้นทางไฟล์เคสอ้างจากโฟลเดอร์ RunConfig โหลดทุกไฟล์และตรวจ Registry ก่อนเปิด session แต่ละไฟล์มี case เดียว additionalData เป็น optional สำหรับข้อมูลเฉพาะเคส ไม่ต้องใส่เมื่อไม่มีข้อมูล

- LOGIN_OPEN_PROFILE: รอ Main → กด Profile → รอ Popup → Confirm → รอ Popup หาย ยังไม่ยืนยันหน้าปลายทางหรือ Login สำเร็จ
- LOGIN_OPEN_PROFILE_CANCEL: รอ Main → กด Profile → Cancel → รอ Popup หาย → ตรวจ Main visible

ทั้งสองเป็น Script ใน Scripts/Login ใช้ Pages ร่วมกัน ไม่มี Reuse Login และไม่รับ popupSelection/popupAction จาก Config shouldLogin ไม่ใช้ข้ามสองเคสนี้ ค่ากลาง loginConfig ยังคงส่งให้ Script เพื่อใช้ต่อในอนาคต

## โครงสร้าง

- Core: ค้นหา รอ Action อ่านค่า Assertion และ Context แยก iOS/Android/Web
- Config/timeouts.mjs: เวลาทั้งหมดหน่วย ms รวม session และ app lifecycle
- Config/element-locators.mjs: locator เฉพาะแอป; iOS Alert buttons ซ้อนกันจึงเลือก Button ชั้นในสุดตาม ID
- MainManager: อ่าน Config เปิด session รันเคสเรียงลำดับ และปิด session ใน finally
- Pages: Action ของหน้า ใช้ IDFile constants
- Scripts: ขั้นตอนและ expected behavior ของแต่ละเคส
- Reuses: พื้นที่สำหรับ flow ร่วมในอนาคต
- Results: บันทึก result.json, report.html และ journal.jsonl แยกต่อรอบ พร้อมผลใน Terminal และไฟล์สำรองเมื่อเขียนผลหลักไม่ได้

## ผลการรัน

ASSERTION_MISMATCH จาก Core เป็น FAIL; error อื่นเป็น ERROR ใน runner ขั้นพื้นฐาน ERROR หยุดชุดทดสอบ FAIL ไปต่อเฉพาะ flag อนุญาต หลัง PASS/FAIL ปิด–เปิดแอปโดยไม่ล้างข้อมูล ไม่มี reset ระหว่าง subcase และไม่ retry ธุรกรรม

exit code: 0 PASS, 1 FAIL, 2 ERROR เก็บ case error แยกจาก reset/session cleanup errors ยังไม่มี screenshot/video, step history, system permission handler, timeout ทั้ง testcase หรือ session recovery

## คำสั่ง

```sh
npm test
npm run check:ids
npm run check:device -- Config/Local/DeviceConfig.ios.json
node MainManager/run.mjs
node MainManager/run.mjs --config Config/Local/RunConfig.json
node MainManager/run.mjs --device Config/Local/DeviceConfig.android.json --testcase Config/Local/RunConfig.json
```

Appium ต้องเปิดอยู่ที่ http://127.0.0.1:4723/ ก่อนเริ่ม CLI เช่นเดียวกับ launcher การตรวจ config/ID import ไม่ยืนยัน UI binding บนแอป

## การตรวจจริงและข้อจำกัด

เคยเปิด iOS Simulator session และทดสอบ Confirm Popup หายได้ ปัจจุบัน Cancel flow และการรันสองเคสต่อกันยังต้องตรวจด้วย build ล่าสุด Android/Web ยังไม่มีผลทดสอบแอปจริง Unit tests ใช้ driver จำลอง ไม่แทนการตรวจอุปกรณ์จริง

Android environment โหลดผ่าน tools/android-env.sh; ใช้ Appium driver doctor xcuitest/uiautomator2 ตรวจเครื่องเป้าหมาย ข้อมูลติดตั้งบนเครื่องและเวอร์ชันอาจต่างกัน ต้องตรวจจริงก่อนใช้งาน

StartAppium.command จะหยุด Appium ของผู้ใช้ปัจจุบันที่ฟังพอร์ต 4723 ก่อนเปิดใหม่เสมอ ส่ง TERM รอสูงสุด 10 วินาทีแล้วใช้ KILL หากจำเป็น session ที่กำลังรันจะสิ้นสุด หากพอร์ตเป็นโปรแกรมอื่นจะหยุด launcher พร้อมข้อความแทนการ kill โปรแกรมนั้น


## Dashboard สำหรับ QA

ดับเบิลคลิก `StartDashboard.command` เปิด http://127.0.0.1:4730 และคงหน้าต่าง Terminal ไว้
แก้ Run Name / Platform / ข้อมูล Login / ลำดับเคส จากนั้นกดเปิด Appium รอพร้อม และกดบันทึกและ Start
Config บันทึกลง `Config/Local/RunConfig.json` ส่วน Device Config ยังแยกเหมือนเดิม
หน้าเว็บอ่านไฟล์จาก Config/TestCases มาเพิ่มเป็นสำเนาใน RunConfig และ resolve file references เดิมเมื่อโหลด แสดงเฉพาะชื่อ เคสซ้ำมี additionalData อิสระ; string/number เป็นช่องกรอก boolean เป็นตัวเลือก true/false และ object/array แสดงช่องตามโครงสร้าง null แสดงอ่านอย่างเดียวเพราะยังไม่มีชนิดข้อมูล
ลากที่ handle เพื่อจัดลำดับ หรือใช้ปุ่มขึ้นลงได้ หน้าเว็บไม่มี JSON editor หากต้องการกำหนดฟิลด์ใหม่ให้แก้ไฟล์เคสในโปรเจกต์แล้วโหลดหน้าใหม่ การบันทึกหน้าเว็บเก็บเคสแบบ inline ไม่แก้ไฟล์ต้นฉบับ
แสดง Test Log และ Appium Log (เฉพาะ Appium ที่เปิดจาก Dashboard) อัปเดตทุก 2 วินาที เก็บข้อความล่าสุดไม่เกิน 200,000 ตัวอักษรต่อช่อง
ระหว่างรันล็อก Config และปุ่ม Start; เมื่อ Appium เปิดอยู่แล้วใช้ตัวเดิม ไม่ restart
สถานะอิง /status จริง ไม่ถือว่ากดเปิดแล้วพร้อมทันที
ผลยังอยู่ใน Results ตามเดิม; รายละเอียดการกดแต่ละปุ่มต้องเพิ่ม Step ภายหลัง
Control+C ปิด Dashboard และส่ง SIGTERM ให้ process ที่ Dashboard เปิดไว้ จึงควรรอเคสจบก่อนปิด

เลือก Platform แบบ radio แล้วแก้ Device Config ได้ในหน้าเดียวกัน ปุ่มบันทึก Device Config เขียนไฟล์ตาม platform; บันทึกและ Start บันทึก Device Config และ RunConfig ก่อนรัน ขณะสลับแพลตฟอร์มเก็บร่างแต่ละฝั่งไว้จนรีโหลดหน้า
ใต้ Log มีรายงาน HTML จาก Results เลือกรอบย้อนหลังและดาวน์โหลด Excel/JSON ได้โดยไม่แก้ไฟล์ต้นฉบับ รอบที่ไม่มี result.json ยังไม่แสดงในรายการ

ปุ่ม Appium สลับเป็นปิด Appium เมื่อ Server เปิดอยู่ กดระหว่างเทสได้เพื่อหยุด runner และ process ลูกแล้วปิด Server (รวม Appium ของผู้ใช้เดียวกันบนพอร์ต 4723 ที่เปิดจาก Terminal) Dashboard ยังคงเปิดอยู่ สถานะแสดงหยุดโดยผู้ใช้ การหยุดกลางรอบอาจไม่มีผลสุดท้าย ให้ใช้ Journal ที่บันทึกไว้ ไม่สรุปเป็น PASS และไม่ล้างข้อมูลแอป
