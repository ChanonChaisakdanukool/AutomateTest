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

  return { waitUntilReady, tapProfile };
}
