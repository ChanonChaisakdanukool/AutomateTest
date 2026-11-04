# Test Scripts

- Login/open-profile.mjs: LOGIN_OPEN_PROFILE รอ Main กด Profile และยืนยัน Popup จากนั้นทำ Phone หรือ Email Login ตาม Config และตรวจหน้า Profile
- Login/open-profile-cancel.mjs: LOGIN_OPEN_PROFILE_CANCEL กด Cancel รอ Popup หาย และตรวจ Main visible

เลือกพฤติกรรมด้วย case.id แต่ละ Script ประกอบจาก Page Actions ใช้ IDFile ผ่าน Pages ไม่รับ popupSelection หรือ popupAction และไม่ข้ามการทดสอบตาม shouldLogin
