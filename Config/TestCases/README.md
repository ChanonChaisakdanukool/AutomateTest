# TestCase JSON

แต่ละไฟล์มี object หนึ่งรายการ เช่น LOGIN_OPEN_PROFILE.json:

```json
{ "case": { "id": "LOGIN_OPEN_PROFILE" } }
```

RunConfig อ้างไฟล์แทนการคัดลอกได้:

```json
"testCases": [
  { "file": "../TestCases/LOGIN_OPEN_PROFILE.json" },
  { "case": { "id": "LOGIN_OPEN_PROFILE" } }
]
```

path อ้างจากโฟลเดอร์ RunConfig ไม่ใช่ working directory รองรับทั้ง inline และไฟล์ใน array เดียวกัน รวมเคสซ้ำโดยรักษาลำดับ โหลด/validate ทุกเคสก่อนสร้าง session ไฟล์ไม่พบ JSON ผิด หรือ ID ไม่ลงทะเบียนจะหยุดก่อนรัน

file reference ต้องมี key file เพียงตัวเดียว ไฟล์ปลายทางต้องมี key case เพียงตัวเดียว ไม่รองรับ recursive includes, override หรือการอ้างไฟล์ที่มีหลายเคส shouldLogin อยู่ใน RunConfig ส่วน loginMethod/phoneNumber/email อยู่ใน additionalData ของ LOGIN_OPEN_PROFILE และข้อมูลอุปกรณ์อยู่ใน DeviceConfig แยกตามเดิม

additionalData เป็น optional ใส่เมื่อเคสต้องใช้ข้อมูลเฉพาะเท่านั้น สองเคส Login นี้ไม่ต้องใช้ แต่ละไฟล์เก็บ case เดียว ห้ามมี key case ซ้ำใน object เดียว

Schema ของแต่ละเคสลงทะเบียนที่ caseRegistry.schemas ดู Shared/README.md การเพิ่มฟิลด์ในฟอร์มให้แก้ Schema พร้อมไฟล์เคส ไม่ต้องแก้ Dashboard
