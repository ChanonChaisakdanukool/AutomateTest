import { createMainPage } from '../../Pages/MainApp/main-page.mjs';
import { createLoginConfirmPopup } from '../../Pages/Authentication/login-confirm-popup.mjs';

/** Main → Profile → Popup → Cancel → ตรวจว่ายังพบ Main */
export async function loginOpenProfileCancel({ core }) {
  const mainPage = createMainPage(core);
  const popup = createLoginConfirmPopup(core);

  await mainPage.waitUntilReady();
  await mainPage.tapProfile();
  await popup.cancel();
  const mainView = await mainPage.waitUntilReady();
  await core.expectVisible(mainView);
}
