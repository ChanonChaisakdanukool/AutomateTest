export const android = {
  // Default contract: Android resource-id. Override locator for Compose/testTag or content-desc.
  /** ใช้ Android resource-id; ผู้เรียกต้อง override ถ้าแอปผูก ID แบบ content-desc หรือ testTag */
  locator: id => ({ using: 'id', value: id }),
  /** อ่าน attribute text; control เช่น switch ต้องกำหนด mapping เพิ่มตามแอป */
  value: (driver, id) => driver.getElementAttribute(id, 'text'),
  /** เลื่อน container 80% ตาม direction; คืนสถานะเลื่อนต่อได้จาก driver ให้ Core ใช้หยุดค้นหา */
  scroll: (driver, id, direction) => driver.execute('mobile: scrollGesture', {
    elementId: id, direction, percent: 0.8,
  }),
};
