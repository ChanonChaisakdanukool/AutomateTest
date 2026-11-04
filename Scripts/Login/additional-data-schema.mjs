import { webLocalized } from '../../Localization/web-th.mjs';

export const LoginMethod = Object.freeze({ PHONE: 'phone', EMAIL: 'email' });
const phoneLogin = { field: 'loginMethod', equals: LoginMethod.PHONE };
const emailLogin = { field: 'loginMethod', equals: LoginMethod.EMAIL };
const usesOtp = { any: [phoneLogin, emailLogin] };

export const loginAdditionalDataSchema = {
  loginMethod: {
    type: 'enum', label: webLocalized.loginMethod,
    options: [
      { value: LoginMethod.PHONE, label: webLocalized.phone },
      { value: LoginMethod.EMAIL, label: webLocalized.email },
    ],
  },
  phoneNumber: {
    type: 'string', label: webLocalized.phone,
    visibleWhen: phoneLogin,
    requiredWhen: phoneLogin,
  },
  email: {
    type: 'string', label: webLocalized.email,
    visibleWhen: emailLogin,
    requiredWhen: emailLogin,
  },
  password: {
    type: 'string', label: webLocalized.password, masked: true, minLength: 6,
    visibleWhen: emailLogin,
    requiredWhen: emailLogin,
  },
  otp: {
    type: 'string', label: webLocalized.otp,
    resetOnChange: 'loginMethod',
    default: '111111', defaultWhen: phoneLogin, // Stage phone whitelist
    pattern: '^[0-9]{6}$', minLength: 6, maxLength: 6,
    visibleWhen: usesOtp,
    requiredWhen: usesOtp,
  },
};
