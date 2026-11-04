import { ElementIds } from 'shared-element-ids';
import { TIMEOUTS } from '../../Config/timeouts.mjs';
import { localized } from '../../Localization/localized.mjs';

export function createEmailLogin(core) {
  const { login, emailLogin, emailOtp } = ElementIds.authentication;
  const { loginEmailPageView, loginEmailPageEmailTextField, loginEmailPagePasswordTextField, loginEmailPageLoginButton } = emailLogin;
  const { loginEmailOtpPageView, loginEmailOtpPageOtpTextField } = emailOtp;

  async function fillField(id, value) {
    const field = await core.waitForVisible(id);
    await core.tap(field);
    await core.clearText(field);
    await core.inputText(field, value);
  }

  return {
    labels: {
      open: localized.tap(login.loginPageEmailButton),
      email: localized.inputText(loginEmailPageEmailTextField),
      password: localized.inputText(loginEmailPagePasswordTextField),
      submit: localized.tap(loginEmailPageLoginButton),
      otpReady: localized.wait(loginEmailOtpPageView),
      otp: localized.inputText(loginEmailOtpPageOtpTextField),
    },
    async open() {
      await core.tap(await core.waitForVisible(login.loginPageEmailButton));
      await core.waitForVisible(loginEmailPageView, { timeout: TIMEOUTS.loginEntry });
    },
    inputEmail: email => fillField(loginEmailPageEmailTextField, email),
    inputPassword: password => fillField(loginEmailPagePasswordTextField, password),
    async submit() {
      await core.tap(await core.waitForEnabled(loginEmailPageLoginButton));
    },
    async waitForOtp() {
      await core.waitForVisible(loginEmailOtpPageView, { timeout: TIMEOUTS.loginEntry });
      await core.waitForVisible(loginEmailOtpPageOtpTextField, { timeout: TIMEOUTS.loginEntry });
    },
    async inputOtp(otp) {
      const field = await core.waitForVisible(loginEmailOtpPageOtpTextField);
      await core.tap(field);
      await core.inputText(field, otp);
    },
  };
}
