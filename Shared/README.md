# AdditionalData Schema

caseRegistry.schemas ลงทะเบียน Schema คู่กับ Case ID ตัวอย่างจริง Scripts/Login/additional-data-schema.mjs
JSON ของเคสเก็บค่า ส่วน Schema เก็บ type/label/options/required/visibleWhen/requiredWhen
label และชื่อ option มาจาก Localization/web-th.mjs ไม่ใส่ข้อความเฉพาะ Login ใน Dashboard

ชนิดที่รองรับ: string, number, boolean, enum, object (fields แบบ recursive)
visibleWhen/requiredWhen ใช้ {field: "login.mode", equals: "keyboard"} หรือ {all:[...]} / {any:[...]} โดย path อ้างจากรากของ additionalData
object ที่ต้องมีให้ตั้ง required หรือ requiredWhen ที่ object ด้วย ไม่ได้บังคับสร้าง optional object อัตโนมัติ

normalizeAdditionalData ใช้ร่วม Browser/Node คืนสำเนา ลบฟิลด์ซ่อนก่อนตรวจ enum/ชนิด/required และปฏิเสธ key ที่ไม่อยู่ใน Schema
Browser เรียก validate:false ตอนสลับ enum แล้วสร้าง form ใหม่; Node เรียก validate:true ก่อน session แม้แก้ JSON ตรง
เมื่อผู้ใช้กรอกเบอร์โทรให้ใช้ string เพื่อเก็บเลข 0 นำหน้า ไม่ใส่ข้อมูล Login ลงผลทดสอบอัตโนมัติ

เพิ่มเคสใหม่: สร้าง Script และ Schema แล้วลงทะเบียนทั้งสองใน MainManager/case-registry.mjs; ไม่มีการแก้หน้าเว็บตาม Case ID
เคสเก่าที่ยังไม่ลงทะเบียน Schema ยังใช้ object additionalData เดิมได้เพื่อความเข้ากันได้

LOGIN_OPEN_PROFILE: loginMethod มี phone/email เท่านั้น ไม่บังคับระบุ ไม่มีค่า none ถ้าไม่เลือกจะไม่บันทึก key และ Script ปัจจุบันยังหยุดหลังยืนยัน Popup
phone ต้องมี phoneNumber, email ต้องมี email ส่วน shouldLogin เป็นข้อมูลกลางเดิม

เมื่อเลือก phone จะแสดง otp คู่กับ phoneNumber เป็นข้อมูลรายเคส ค่าเริ่มต้นสำหรับ Stage คือ string "111111" ต้องเป็นตัวเลข 6 หลัก เก็บ 0 นำหน้าได้ เมื่อเลือก email หรือไม่เลือกจะล้าง otp เช่นเดียวกับ phoneNumber
Schema รองรับ default เฉพาะฟิลด์ที่แสดง และ minLength/maxLength/pattern โดยใช้กติกาเดียวใน Browser/Node ยังไม่ได้เรียกกรอก OTP ใน Script
