import { createMainPage } from '../../Pages/MainApp/main-page.mjs';
import { createLoginConfirmPopup } from '../../Pages/Authentication/login-confirm-popup.mjs';

/** Main → Profile → Popup → Confirm; จะต่อ flow Login ภายหลัง */
export async function loginOpenProfile({ core }) {
  const mainPage = createMainPage(core);
  const popup = createLoginConfirmPopup(core);

  await mainPage.waitUntilReady();
  await mainPage.tapProfile();
  await popup.confirm();
}
