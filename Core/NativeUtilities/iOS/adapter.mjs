export const ios = {
  /** แปลง ID กลางเป็น accessibility id ของ iOS */
  locator: id => ({ using: 'accessibility id', value: id }),
  /** อ่าน attribute value ของ element; ไม่ใช่ข้อความ label เสมอไป */
  value: (driver, id) => driver.getElementAttribute(id, 'value'),
  /** เลื่อน container ตาม direction หนึ่งครั้งด้วย XCUITest; Core เป็นผู้จำกัดจำนวนครั้งและเวลารวม */
  scroll: (driver, id, direction) => driver.execute('mobile: scroll', { elementId: id, direction }),
};
