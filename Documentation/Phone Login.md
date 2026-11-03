# LOGIN_OPEN_PROFILE — Phone Login

เลือกวิธี Login เป็น phone ใน additionalData ของเคส เบอร์และ OTP เป็น string

```json
{"case":{"id":"LOGIN_OPEN_PROFILE","additionalData":{"loginMethod":"phone","phoneNumber":"0805524025","otp":"111111"}}}
```

Main → Profile → Confirm → รอค้นประวัติ Login เสร็จ → ถ้า Latest Login ให้เลือกบัญชีอื่น → ล้างและกรอกเบอร์ → ตรวจค่าหลังตัดช่องว่าง/ขีด → รอปุ่มพร้อมแล้วกด → รอหน้า OTP → กรอก OTP → ตรวจหน้า Profile

ไม่ตรวจเบอร์บนหน้า OTP ตามข้อตกลง ไม่ถือว่าการปิดหน้า OTP คือ Login สำเร็จ ไม่ส่ง OTP ซ้ำหรือ retry ธุรกรรมอัตโนมัติ

กรณี Latest Login ยังเลือกบัญชีอื่นเสมอ เพราะข้อความเบอร์อาจปิดบังบางหลัก จึงยืนยันว่าเป็นบัญชีเดียวกันไม่ได้จากข้อความนั้นเพียงอย่างเดียว

ไม่ระบุ loginMethod จะหยุดหลัง Confirm ตามพฤติกรรมเดิม Email ยังไม่รองรับใน Script นี้และจะ ERROR ก่อนกด UI

ต้อง Build iOS ใหม่เพื่อให้มี ID และสัญญาณพร้อมของหน้า Login รองรับ IDFile commit 32918c1bf3058613d6ab1dabc819ef58fca52f7e
