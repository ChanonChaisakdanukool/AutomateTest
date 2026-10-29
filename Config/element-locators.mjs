import { ElementIds } from 'shared-element-ids';
import { ios } from '../Core/NativeUtilities/iOS/adapter.mjs';

// UIAlertAction บน iOS รุ่นที่ทดสอบมี Button ซ้อนกันและรับ identifier เดียวกัน
// เลือก Button ที่ไม่มี Button ลูก ID เดียวกัน ไม่เลือกด้วย index
export const elementLocators = {
  iOS(id) {
    const confirmId = ElementIds.authentication.loginConfirm.loginConfirmPopupConfirmButton;
    const cancelId = ElementIds.authentication.loginConfirm.loginConfirmPopupCancelButton;
    if (id === confirmId || (cancelId && id === cancelId)) {
      const buttonName = id;
      return {
        using: 'xpath',
        value: `//XCUIElementTypeButton[@name="${buttonName}" and not(.//XCUIElementTypeButton[@name="${buttonName}"])]`,
      };
    }
    return ios.locator(id);
  },
};
