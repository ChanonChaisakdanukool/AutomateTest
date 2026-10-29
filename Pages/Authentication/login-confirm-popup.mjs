import { ElementIds } from 'shared-element-ids';

/** Popup ยืนยันก่อนเปิดหน้า Login */
export function createLoginConfirmPopup(core) {
  const ids = ElementIds.authentication.loginConfirm;

  async function select(action = 'confirm') {
    const buttonIds = {
      confirm: ids.loginConfirmPopupConfirmButton,
      cancel: ids.loginConfirmPopupCancelButton,
    };
    if (!Object.hasOwn(buttonIds, action)) {
      throw new TypeError('Popup action must be confirm or cancel.');
    }
    const targetId = buttonIds[action];
    if (typeof targetId !== 'string') {
      throw new Error('Installed IDFile is missing the popup button ID. Update SharedElementIds dependency.');
    }
    await core.waitForVisible(ids.loginConfirmPopupView);
    const button = await core.waitForVisible(targetId);
    await core.tap(button);
    await core.waitForHidden(ids.loginConfirmPopupView);
  }

  async function confirm() {
    await select('confirm');
  }

  async function cancel() {
    await select('cancel');
  }

  return { select, confirm, cancel };
}
