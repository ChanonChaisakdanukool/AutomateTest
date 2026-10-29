# Main Manager ขั้นพื้นฐาน

run.mjs อ่าน Device Config / TestCase Config → ตรวจ registry ทุกเคส → เปิด WebdriverIO/Appium session → สร้าง Core → รันเคสเรียงลำดับ → พยายามปิด session ใน finally

เปิด Appium ก่อนด้วย `npm run appium` แล้วใช้ RunAutomate.command หรือ:

```sh
node MainManager/run.mjs --device Config/Local/DeviceConfig.ios.json --testcase Config/Local/RunConfig.json
```

ใช้ server local http://127.0.0.1:4723/ โดยไม่เปิด/ปิด Appium server ให้อัตโนมัติ การปิด session ไม่ใช่ปิด server

## ลงทะเบียนเคส

เพิ่ม import ของ script ที่ implement จริงใน case-registry.mjs แล้วลงทะเบียน:

```javascript
caseRegistry.set('QA_CASE_ID', async ({ core, additionalData, executionIndex }) => {
  // เรียก page/reuse แล้วตรวจ expected result ผ่าน Core
  // ต้อง await ทุก operation และ throw เมื่อไม่ผ่าน
});
```

ตัวอย่างนี้เป็นสัญญาการเรียก ไม่ใช่เคสที่ตรวจแอปได้จริง Registry ปัจจุบันมี LOGIN_OPEN_PROFILE และ LOGIN_OPEN_PROFILE_CANCEL เคสที่ไม่ลงทะเบียนถูกปฏิเสธก่อนสร้าง session

- duplicate Case ID ได้ แต่แยก executionIndex และ clone additionalData ต่อ execution
- PASS เมื่อ script จบโดยไม่ throw; ผู้เขียนต้องใส่ assertion ให้ครบ
- ASSERTION_MISMATCH จาก Core เป็น FAIL; error อื่นเป็น ERROR โดยยังไม่ฟันธง root cause
- ERROR หยุดชุดทดสอบเสมอ; FAIL ไปต่อเฉพาะ shouldContinueNextCaseWhenFail=true
- หลัง PASS/FAIL ปิด–เปิดแอปโดยไม่ล้างข้อมูล และกลับ Native ก่อนใช้ Core ใหม่ ไม่มี reset ระหว่าง subcase
- ต้องมี bundleId/appPackage แม้ใช้ app.source=file เพื่อ soft reset
- ไม่มี retry ธุรกรรม ตั้ง connectionRetryCount=0; command timeout ไม่รับประกันว่าคำสั่งฝั่งอุปกรณ์หยุดแล้ว
- สรุป cases และ errors แยกกัน จึงไม่เขียนทับ case failure เมื่อ reset/cleanup ล้มเหลว
- exit code: 0 PASS, 1 FAIL, 2 ERROR

ขอบเขต: แสดง summary JSON ใน console เท่านั้น ยังไม่มี evidence, Result Document, journal/fallback, timeout ระดับ testcase หรือการกู้คืน session หากสร้าง session timeout ก่อนรับ session ID ไม่สามารถรับประกัน cleanup ฝั่ง server ได้

ทดสอบ lifecycle ด้วย session จำลอง ยังต้องตรวจบนแอปจริง

## ค่ากลาง Login

shouldLogin (ค่าเริ่มต้น true), loginMethod, phoneNumber และ email อยู่ระดับบนของ TestCase Config โดย Main Manager ส่งเป็น loginConfig ให้ทุกเคส แยกจาก additionalData และ clone ต่อ execution เพื่อไม่ให้เคสหนึ่งแก้ค่าของอีกเคส ไม่มีการ override ค่ากลางผ่าน additionalData

Case รับ `{ core, loginConfig, additionalData, executionIndex }` แล้วส่ง `loginConfig` ต่อให้ Reuse ที่ต้องการใช้ ข้อมูลนี้ไม่ถูกใส่ใน summary


## Config สำหรับรันปัจจุบัน

RunAutomate.command อ่านสองไฟล์ที่กำหนดไว้โดยไม่เปิดตัวเลือก:
- Config/Local/DeviceConfig.ios.json: อุปกรณ์และแอป
- Config/Local/RunConfig.json: ค่ากลาง Login, runName, continuation flag และ testCases

Config/TestCases/LOGIN_OPEN_PROFILE.json เป็น JSON ของเคสหนึ่งรายการ ใช้ `{ "file": "../TestCases/LOGIN_OPEN_PROFILE.json" }` ใน testCases เพื่อโหลดอัตโนมัติได้ Path อ้างจาก RunConfig และยังรองรับ inline `{ "case": {...} }` ทุกไฟล์ถูกโหลดและตรวจสอบก่อนเปิด session

CLI: `node MainManager/run.mjs` ใช้สองไฟล์ข้างต้น หรือ `node MainManager/run.mjs --device DeviceConfig.json --testcase RunConfig.json` เพื่อระบุไฟล์เอง `--config RunConfig.json` เปลี่ยนเฉพาะ RunConfig โดยยังใช้อุปกรณ์จาก DeviceConfig.ios.json เดิม

app.path อ้างอิงโฟลเดอร์ของ DeviceConfig ตามเดิม ตัวอย่างรวมทั้งสองฝั่งแยกกันอยู่ใน Config/Examples

## เลือก Platform จาก RunConfig

กำหนด `"platform": "iOS"` หรือ `"platform": "Android"` ใน RunConfig แล้ว Main Manager เลือก Config/Local/DeviceConfig.ios.json หรือ Config/Local/DeviceConfig.android.json ของโปรเจกต์โดยอัตโนมัติ ไม่ขึ้นกับ working directory ค่าของ platform ต้องตรงกับ DeviceConfig ไฟล์ไม่มีหรือค่าผิดจะหยุดก่อนเปิด session

`RunAutomate.command` และ `node MainManager/run.mjs --config path/to/RunConfig.json` ใช้การเลือกนี้ CLI แบบ --device/--testcase ยังรองรับ แต่ตรวจ platform ตรงกันหาก RunConfig ระบุไว้ ตัวอย่าง Android profile อยู่ใน Config/Examples ให้คัดลอกลง Local และกรอกข้อมูลจริงก่อนรัน Android

Login เป็น Script สองเคส: LOGIN_OPEN_PROFILE กด Confirm และ LOGIN_OPEN_PROFILE_CANCEL กด Cancel แล้วตรวจ Main ไม่ใช้ popupSelection/popupAction จาก Config และไม่ข้ามเคสจาก shouldLogin ค่ากลาง Login ยังส่งให้เคสอื่นเพื่อใช้ภายหลัง
