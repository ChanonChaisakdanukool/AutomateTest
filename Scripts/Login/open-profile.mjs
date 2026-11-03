import { createJourney } from '../../MainManager/journey.mjs';
import { createMainPage } from '../../Pages/MainApp/main-page.mjs';
import { createLoginConfirmPopup } from '../../Pages/Authentication/login-confirm-popup.mjs';

/** Main → Profile → Popup → Confirm; จะต่อ flow Login ภายหลัง */
export async function loginOpenProfile({ core, journey = createJourney() }) {
  const mainPage = createMainPage(core);
  const popup = createLoginConfirmPopup(core);

  await journey.run([
    { id: 'main.wait', name: mainPage.labels.waitUntilReady, action: () => mainPage.waitUntilReady() },
    { id: 'main.profile', name: mainPage.labels.tapProfile, action: () => mainPage.tapProfile() },
    { id: 'popup.confirm', name: popup.labels.confirm, action: () => popup.confirm() },
  ]);
}
