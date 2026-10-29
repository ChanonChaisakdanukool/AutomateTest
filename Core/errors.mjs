/**
 * Error ของ Core พร้อม code และ details ให้ Main Manager ใช้จำแนกผล โดยไม่ตัดสิน FAIL/ERROR ที่นี่
 */
export class CoreError extends Error {
  /**
   * สร้าง Error จากรหัส ข้อความ และข้อมูลประกอบ เช่น expected/actual
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CoreError';
    this.code = code;
    this.details = details;
  }
}
/**
 * สร้าง CoreError โดยยังไม่ throw เพื่อให้ผู้เรียกเลือกจุดส่งต่อ error
 */
export function createCoreError(code, message, details) {
  return new CoreError(code, message, details);
}
