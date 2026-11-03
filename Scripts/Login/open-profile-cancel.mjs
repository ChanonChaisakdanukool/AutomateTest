import { createJourney } from '../../MainManager/journey.mjs';
import { createMainPage } from '../../Pages/MainApp/main-page.mjs';
import { createLoginConfirmPopup } from '../../Pages/Authentication/login-confirm-popup.mjs';

/** Main → Profile → Popup → Cancel → ตรวจว่ายังพบ Main */
export async function loginOpenProfileCancel({ core, journey = createJourney() }) {
  const mainPage = createMainPage(core);
  const popup = createLoginConfirmPopup(core);

  await journey.run([
    { id: 'main.wait', name: mainPage.labels.waitUntilReady, action: () => mainPage.waitUntilReady() },
    { id: 'main.profile', name: mainPage.labels.tapProfile, action: () => mainPage.tapProfile() },
    { id: 'popup.cancel', name: popup.labels.cancel, action: () => popup.cancel() },
    { id: 'main.verify', name: mainPage.labels.expectVisible, action: async () => {
      const mainView = await mainPage.waitUntilReady();
      await core.expectVisible(mainView);
    } },
  ]);
}
