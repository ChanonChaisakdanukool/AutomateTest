# AutomateTest

Automation Repo แยกจาก IDFile ใช้ Appium + WebdriverIO ตามแผนเดิม Phase 1: Mac เครื่องเดียว รันทีละอุปกรณ์

## สถานะ

โครงเริ่มต้น: มี Config ตัวอย่าง, ตัวตรวจ Device Config / แปลง Appium Capabilities, Case Registry ว่าง และโฟลเดอร์ตามแบบ ยังไม่มี TestCase จริง, Session runner, Result Writer, Evidence หรือ Reset Lifecycle จึงยังไม่สามารถกดรันทดสอบแอปครบวงจรได้

## เตรียมเครื่อง

Node.js 22.12+ และ npm ต้องอยู่ใน PATH ติดตั้ง dependency จากโฟลเดอร์นี้:

```sh
npm install
npm run check:ids
npm test
```

IDFile ล็อก Git Commit 6f55f2c64310736cc03dda0028f3ff96a911a3e5 ไม่อ่านจาก path Local และไม่คัดลอก ID มาดูแลซ้ำ หาก Repo private ต้องตั้ง Git Credential ของเครื่องก่อน
ยังไม่มี package-lock.json เพราะเครื่องที่วางโครงไม่มี npm ให้รัน npm install แล้วเก็บ package-lock.json เข้า Git ก่อนใช้งานร่วมกัน

ติดตั้ง Driver เฉพาะแพลตฟอร์มที่จะใช้ หลังติดตั้ง dependencies:

```sh
npx appium driver install xcuitest
# Android เมื่อเริ่มใช้งาน:
# npx appium driver install uiautomator2
npm run appium
```

iOS ต้องมี Xcode และเตรียม Simulator/เครื่องจริงให้พร้อม Android ต้องมี SDK/JDK และ Emulator/เครื่องจริง การตั้ง signing/WDA เป็นงาน Dev ไม่ใส่ข้อมูลลับใน QA Config

## Config

คัดลอก Config/Examples/DeviceConfig.ios.json ไป Config/Local/DeviceConfig.json แล้วแทน device.id และ app.bundleId ด้วยค่าจริง ไม่มีข้อมูลแอป 7-11 ที่เดาไว้ในตัวอย่าง

```sh
npm run check:device -- Config/Local/DeviceConfig.json
```

คำสั่งนี้ตรวจข้อมูลและ path เท่านั้น ไม่เชื่อมอุปกรณ์และไม่สร้างผล PASS ของ TestCase ตัวอย่าง TestCaseConfig ยังไม่มี Case ที่ลงทะเบียน ห้ามใช้เป็นเคสจริง

## โครงสร้าง

- Config: Device/TestCase Config แยกกัน Local ไม่ Commit
- MainManager: Config, Registry และพื้นที่ Orchestration
- Core/MainUtilities: คำสั่งร่วม
- Core/NativeUtilities/iOS และ Android: ส่วนเฉพาะแพลตฟอร์ม
- Core/WebUtilities: WebView / Mini App
- Pages: Action ระดับหน้า
- Reuses: Flow ที่ใช้ร่วมกัน
- Scripts: TestCase ที่ประกอบ Pages/Reuses
- Results: ผลและหลักฐาน Runtime ไม่ Commit

ใช้ ESM JavaScript สำหรับ Bootstrap ซึ่ง Import แพ็กเกจ IDFile ได้โดยตรง ยังไม่กำหนด Interface ของ Script จริง

## งานถัดไป

เลือกหน้าจอและ Expected Result จริง พร้อม ID ที่ Dev ผูกแล้ว จากนั้นทำเคสแรกให้ครบ Config → Main Manager → Appium/WebdriverIO → UI → Result → Soft Reset ตามข้อกำหนด FAIL/ERROR ไม่มี Transaction Retry อัตโนมัติ

อ้างอิง: https://webdriver.io/docs/appium-service และ https://appium.io/docs/en/latest/reference/session/caps/
