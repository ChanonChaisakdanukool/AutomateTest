import { createEmailLogin } from '../../Pages/Authentication/email-login.mjs';
import { createPhoneLogin } from '../../Pages/Authentication/phone-login.mjs';
import { normalizeAdditionalData } from '../../Shared/additional-data.mjs';
import { loginAdditionalDataSchema } from './additional-data-schema.mjs';
import { createJourney } from '../../MainManager/journey.mjs';
import { createMainPage } from '../../Pages/MainApp/main-page.mjs';
import { createLoginConfirmPopup } from '../../Pages/Authentication/login-confirm-popup.mjs';

/** Main → Confirm → Phone or Email Login → OTP → Profile; ไม่ระบุวิธีจะหยุดหลัง Confirm */
export async function loginOpenProfile({ core, journey = createJourney(), additionalData = {} }) {
  const data = normalizeAdditionalData(loginAdditionalDataSchema, additionalData);
  const mainPage = createMainPage(core);
  const popup = createLoginConfirmPopup(core);

  await journey.run([
    { id: 'main.wait', name: mainPage.labels.waitUntilReady, action: () => mainPage.waitUntilReady() },
    { id: 'main.profile', name: mainPage.labels.tapProfile, action: () => mainPage.tapProfile() },
    { id: 'popup.confirm', name: popup.labels.confirm, action: () => popup.confirm() },
  ]);
  if (!data.loginMethod) return;
  const phone = createPhoneLogin(core);
  let entry;
  await journey.run([
    { id: 'login.entry', name: phone.labels.entry, action: async () => { entry = await phone.waitForEntry(); } },
  ]);
  if (entry.targetId === phone.ids.latestLogin.latestLoginPageView) {
    await journey.run([{ id: 'login.otherAccount', name: phone.labels.otherAccount, action: () => phone.useOtherAccount() }]);
  }
  if (data.loginMethod === 'email') {
    const email = createEmailLogin(core);
    await journey.run([
      { id: 'login.email.open', name: email.labels.open, action: () => email.open() },
      { id: 'login.email.input', name: email.labels.email, action: () => email.inputEmail(data.email) },
      { id: 'login.password.input', name: email.labels.password, action: () => email.inputPassword(data.password) },
      { id: 'login.submit', name: email.labels.submit, action: () => email.submit() },
      { id: 'otp.wait', name: email.labels.otpReady, action: () => email.waitForOtp() },
      { id: 'otp.input', name: email.labels.otp, action: () => email.inputOtp(data.otp) },
      { id: 'profile.verify', name: phone.labels.success, action: () => phone.verifySuccess() },
    ]);
    return;
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
