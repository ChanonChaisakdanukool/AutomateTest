# ตัวอย่าง Config

- DeviceConfig.ios.json: ตั้งค่า iOS คัดลอกไป ../Local/DeviceConfig.ios.json
- DeviceConfig.android.json: ตั้งค่า Android หากใช้ Android ให้ใส่ข้อมูลอุปกรณ์นี้ในไฟล์ Device Config ที่ runner อ่าน หรือระบุผ่าน CLI --device
- RunConfig.json: ค่ากลางและลำดับเคส คัดลอกไป ../Local/RunConfig.json
- ../TestCases/LOGIN_OPEN_PROFILE.json: definition ของเคสที่ RunConfig อ้างถึง

แทน REPLACE_WITH_ ด้วยข้อมูลจริงก่อนรัน ไม่ต้องใช้ TestCaseConfig.json หรือ TestCaseConfig.login.json แบบเดิมแล้ว ค่าเฉพาะเคสใส่ additionalData ในไฟล์เคส ไม่ใส่ข้อมูล Login กลางซ้ำ

testCases ใน RunConfig ใช้ { "file": "../TestCases/LOGIN_OPEN_PROFILE.json" } ได้ path ยังถูกต้องเมื่อคัดลอก RunConfig จาก Examples ไป Local เพราะทั้งสองโฟลเดอร์อยู่ระดับเดียวกัน

RunAutomate.command อ่าน DeviceConfig.ios.json และ RunConfig.json จาก Local อัตโนมัติ ไม่มี file picker

## เลือก Platform จาก RunConfig

กำหนด `"platform": "iOS"` หรือ `"platform": "Android"` ใน RunConfig แล้ว Main Manager เลือก Config/Local/DeviceConfig.ios.json หรือ Config/Local/DeviceConfig.android.json ของโปรเจกต์โดยอัตโนมัติ ไม่ขึ้นกับ working directory ค่าของ platform ต้องตรงกับ DeviceConfig ไฟล์ไม่มีหรือค่าผิดจะหยุดก่อนเปิด session

`RunAutomate.command` และ `node MainManager/run.mjs --config path/to/RunConfig.json` ใช้การเลือกนี้ CLI แบบ --device/--testcase ยังรองรับ แต่ตรวจ platform ตรงกันหาก RunConfig ระบุไว้ ตัวอย่าง Android profile อยู่ใน Config/Examples ให้คัดลอกลง Local และกรอกข้อมูลจริงก่อนรัน Android
