import { createPhoneLogin } from '../../Pages/Authentication/phone-login.mjs';
import { normalizeAdditionalData } from '../../Shared/additional-data.mjs';
import { loginAdditionalDataSchema } from './additional-data-schema.mjs';
import { createJourney } from '../../MainManager/journey.mjs';
import { createMainPage } from '../../Pages/MainApp/main-page.mjs';
import { createLoginConfirmPopup } from '../../Pages/Authentication/login-confirm-popup.mjs';

/** Main → Confirm → Phone/Latest Login → OTP → Profile; ไม่ระบุวิธีจะหยุดหลัง Confirm */
export async function loginOpenProfile({ core, journey = createJourney(), additionalData = {} }) {
  const data = normalizeAdditionalData(loginAdditionalDataSchema, additionalData);
  if (data.loginMethod === 'email') throw new Error('Email login script is not implemented yet.');
  const mainPage = createMainPage(core);
  const popup = createLoginConfirmPopup(core);

  await journey.run([
    { id: 'main.wait', name: mainPage.labels.waitUntilReady, action: () => mainPage.waitUntilReady() },
    { id: 'main.profile', name: mainPage.labels.tapProfile, action: () => mainPage.tapProfile() },
    { id: 'popup.confirm', name: popup.labels.confirm, action: () => popup.confirm() },
  ]);
  if (data.loginMethod !== 'phone') return;
  const phone = createPhoneLogin(core);
  let entry;
  await journey.run([
    { id: 'login.entry', name: phone.labels.entry, action: async () => { entry = await phone.waitForEntry(); } },
  ]);
  if (entry.targetId === phone.ids.latestLogin.latestLoginPageView) {
    await journey.run([{ id: 'login.otherAccount', name: phone.labels.otherAccount, action: () => phone.useOtherAccount() }]);
  }
  await journey.run([
    { id: 'login.phone.input', name: phone.labels.input, action: () => phone.inputPhone(data.phoneNumber) },
    { id: 'login.phone.verify', name: phone.labels.verify, action: () => phone.verifyPhone(data.phoneNumber) },
    { id: 'login.submit', name: phone.labels.submit, action: () => phone.submit() },
    { id: 'otp.wait', name: phone.labels.otpReady, action: () => phone.waitForOtp() },
    { id: 'otp.input', name: phone.labels.otp, action: () => phone.inputOtp(data.otp) },
    { id: 'profile.verify', name: phone.labels.success, action: () => phone.verifySuccess() },
  ]);
}
