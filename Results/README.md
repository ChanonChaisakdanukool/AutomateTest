# Results

เมื่อรัน `RunAutomate.command` ระบบสร้างโฟลเดอร์ `yyyy-MM-dd_HH-mm-ss_count_runName` เวลาไทย Asia/Bangkok เช่น `2026-10-29_17-30-15_0001_LoginOpenProfile` หากไม่มี runName หรืออ่าน Config ไม่ได้ จะไม่มีส่วนชื่อท้าย; timestamp ในผลดิบยังเป็น UTC

count เริ่ม 0001 และเพิ่มเมื่อชื่อโฟลเดอร์เวลา/ชื่อชุดเดียวกันซ้ำ โดยใช้ exclusive mkdir ป้องกันชนกัน ไม่ใช่จำนวนการรันทั้งหมด (ขอบเขต count ยังไม่ได้กำหนดในข้อตกลงเดิม) อักขระต้องห้ามในชื่อไฟล์จะถูกแทนด้วยขีดและจำกัดชื่อไว้ 60 ตัวอักษร โดยเก็บ runName ต้นฉบับในรายงาน รองรับการตรวจรอบค้างทั้งชื่อเก่าและใหม่ ไม่เปลี่ยนชื่อผลย้อนหลัง

- `result.json`: ผลดิบ schemaVersion 1 พร้อมเวลา Platform ผลแต่ละ execution และ errors ระดับ run
- `report.html`: เปิดด้วย browser ได้ แยก PASS / FAIL / ERROR / SKIPPED พร้อมตารางลำดับการทำงานภาษาไทย เวลา Asia/Bangkok (UTC+7) และเลขลำดับเคส
- `timeline` ใน result.json เก็บเหตุการณ์สำหรับสร้างรายงานใหม่ โดยเก็บ timestamp ดิบเป็น UTC; เคสที่ไม่ได้รันไม่สร้างเวลา execution สมมุติ
- `journal.jsonl`: runStarted, caseStarted, caseFinished, runFinished เขียนระหว่างรัน

ผลทดสอบเดิมของเคสคงอยู่หาก softReset หรือ sessionClose ผิดพลาด; ผลรวมเป็น ERROR ไม่ทับ error แรก
ตรวจรอบเก่าที่ไม่มี result.json แล้วแสดง incompleteRuns (อาจยังรันอยู่หรือถูกหยุดกลางทาง) ไม่รันซ้ำเอง

เขียนผลหลักผ่านไฟล์ชั่วคราวแล้ว rename; หาก Journal เขียนไม่ได้ให้หยุดและปิด session หากมี จากนั้นลองเขียนผลสำรองใน temporary directory ของระบบ (`automate-result-*`) และพิมพ์ตำแหน่งจริงใน Terminal หากสำรองไม่ได้จะแสดง resultSaveFailed และผลใน Terminal
ผลสำรองอาจถูกระบบล้าง และไม่ได้ป้องกันดิสก์เดียวกันเต็ม

ยังไม่เก็บภาพ วิดีโอ Step History, Build/Contract metadata และยังไม่มีนโยบายล้างผล/ตรวจพื้นที่ว่างล่วงหน้า รุ่นนี้ตรวจความสามารถเขียนจริงก่อนเปิด session ไม่คัดลอก Config หรือ additionalData แต่ข้อความ Error อาจมีข้อมูลจากแอป ควรตรวจเนื้อหาก่อนแชร์
ผลจาก unit tests ใช้ mock และเขียนใน temporary directory ไม่ใช่หลักฐานจากแอปจริง
