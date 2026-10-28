# Main Manager

ศูนย์กลางอ่าน Config → Preflight → Session → Case Registry → Execution → Evidence/Result → Soft Reset → Next Case

ตอนนี้มีเฉพาะ device-config.mjs สำหรับตรวจข้อมูลอุปกรณ์และแปลง Capabilities ยังไม่มีวงจรรัน TestCase

ข้อกำหนดที่จะพัฒนาต่อ:
- หนึ่งอุปกรณ์และเคสเรียงลำดับ Duplicate Case ID แยก Execution
- PASS/FAIL ทุกเคสต้องปิดแล้วเปิดแอปใหม่ ไม่ Reset ระหว่าง Subcase
- FAIL เป็นพฤติกรรมผิดคาด; ERROR เป็นระบบผิดพลาด ห้ามจัดประเภทจาก Exception อย่างเดียว
- ERROR หยุด Batch; FAIL ไปต่อเฉพาะเมื่อ Config อนุญาตและ Reset สำเร็จ
- เก็บผล/หลักฐานก่อน Reset และเก็บ Error เดิมกับ Error ที่ตามมาแยกกัน
- Journal และ Result fallback ต้องพัฒนาก่อนประกาศว่ารันครบตามเอกสาร
- ไม่มี automatic rerun หรือ replay ธุรกรรม
