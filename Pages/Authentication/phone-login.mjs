import { ElementIds } from 'shared-element-ids';
import { TIMEOUTS } from '../../Config/timeouts.mjs';
import { localized } from '../../Localization/localized.mjs';

/** หน้ากรอกเบอร์/Latest Login/OTP; ไม่อ่านหรือบันทึก OTP ลงชื่อ Step */
export function createPhoneLogin(core) {
  const { login, latestLogin, phoneOtp } = ElementIds.authentication;
  const profileId = ElementIds.mainApp.profile.profilePageView;
  const normalizePhone = value => String(value).replace(/[\s-]/g, '');
  let phoneField;
  return {
    ids: { login, latestLogin, phoneOtp, profileId },
    labels: {
      entry: localized.wait(login.loginPageView),
      otherAccount: localized.tap(latestLogin.latestLoginPageLatestLoginNormalLoginButton),
      input: localized.inputText(login.loginPagePhoneTextField),
      verify: localized.expectValue(login.loginPagePhoneTextField),
      submit: localized.tap(login.loginPageLoginButton),
      otpReady: localized.wait(phoneOtp.loginPhoneOtpPageView),
      otp: localized.inputText(phoneOtp.loginPhoneOtpPageOtpTextField),
      success: localized.expectVisible(profileId),
    },
    async waitForEntry() {
      // iOS exposes the phone field ID only after latest-login lookup completes.
      return core.waitForAnyVisible([
        latestLogin.latestLoginPageView, login.loginPagePhoneTextField,
      ], { timeout: TIMEOUTS.loginEntry });
    },
    async useOtherAccount() {
      await core.tap(await core.waitForVisible(latestLogin.latestLoginPageLatestLoginNormalLoginButton));
      await core.waitForHidden(latestLogin.latestLoginPageView);
    },
    async inputPhone(phoneNumber) {
      phoneField = await core.waitForVisible(login.loginPagePhoneTextField);
      await core.tap(phoneField);
      await core.clearText(phoneField);
      await core.inputText(phoneField, phoneNumber);
    },
    async verifyPhone(phoneNumber) {
      await core.expectValue(phoneField, phoneNumber, { normalize: normalizePhone });
    },
    async submit() {
      await core.tap(await core.waitForEnabled(login.loginPageLoginButton));
    },
    async waitForOtp() {
      await core.waitForVisible(phoneOtp.loginPhoneOtpPageView, { timeout: TIMEOUTS.loginEntry });
      await core.waitForVisible(phoneOtp.loginPhoneOtpPageOtpTextField);
    },
    async inputOtp(otp) {
      const field = await core.waitForVisible(phoneOtp.loginPhoneOtpPageOtpTextField);
      await core.tap(field);
      await core.inputText(field, otp);
    },
    async verifySuccess() {
      const profile = await core.waitForVisible(profileId, { timeout: TIMEOUTS.loginResult });
      await core.expectVisible(profile);
    },
  };
}
