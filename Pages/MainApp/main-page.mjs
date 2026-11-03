import { localized } from '../../Localization/localized.mjs';
import { ElementIds } from 'shared-element-ids';

/** Action ของหน้า Main App ใช้ ID จาก contract กลาง */
export function createMainPage(core) {
  const ids = ElementIds.mainApp.main;

  /** รอหน้า Main โดยใช้เวลาจาก Core */
  async function waitUntilReady() {
    return core.waitForVisible(ids.mainAppPageView);
  }

  /** รอปุ่ม Profile ให้มองเห็น แล้วกดครั้งเดียว */
  async function tapProfile() {
    const profileButton = await core.waitForVisible(ids.mainAppPageLoginButton);
    await core.tap(profileButton);
  }

  const labels = Object.freeze({
    waitUntilReady: localized.wait(ids.mainAppPageView),
    tapProfile: localized.tap(ids.mainAppPageLoginButton),
    expectVisible: localized.expectVisible(ids.mainAppPageView),
  });

  return { waitUntilReady, tapProfile, labels };
}
