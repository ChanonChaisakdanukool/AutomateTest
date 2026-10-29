/** แปลง protocol ID เป็น W3C element reference เพื่อส่งเข้า JavaScript บนหน้าเว็บ */
const reference = id => ({ 'element-6066-11e4-a52e-4f735466cecf': id });
export const web = {
  /** คืนกรอบ element ในพิกัด viewport เพื่อเทียบกับหน้าจอได้แม้หน้าเว็บเลื่อนแล้ว */
  rect: (driver, id) => driver.execute(function (element) {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  }, reference(id)),
  /** คืนขนาด viewport ของหน้าเว็บใน context ปัจจุบัน */
  viewport: driver => driver.execute(function () {
    return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  }),
  /** สร้าง CSS selector จาก DOM id โดย escape อักขระพิเศษ ไม่ใช้ XPath */
  locator: id => ({ using: 'css selector', value: `[id="${id.replace(/[^a-zA-Z0-9_-]/g, c => `\\${c.codePointAt(0).toString(16)} `)}"]` }),
  /** อ่าน DOM property value โดยไม่แปลงชนิด; element ที่ไม่มี property นี้อาจไม่มีค่า */
  value: (driver, id) => driver.getElementProperty(id, 'value'),
  /** เลื่อน container 80% ของขนาดที่มองเห็น; คืน false เมื่อ scrollLeft/scrollTop ไม่เปลี่ยน */
  scroll: (driver, id, direction) => driver.execute(function (element, dir) {
    const before = [element.scrollLeft, element.scrollTop];
    const sign = dir === 'up' || dir === 'left' ? -1 : 1;
    if (dir === 'up' || dir === 'down') element.scrollTop += sign * element.clientHeight * 0.8;
    else element.scrollLeft += sign * element.clientWidth * 0.8;
    return before[0] !== element.scrollLeft || before[1] !== element.scrollTop;
  }, reference(id), direction),
};
