import { webLocalized } from '../../Localization/web-th.mjs';

export const LoginMethod = Object.freeze({ PHONE: 'phone', EMAIL: 'email' });
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
    visibleWhen: { field: 'loginMethod', equals: LoginMethod.PHONE },
    requiredWhen: { field: 'loginMethod', equals: LoginMethod.PHONE },
  },
  otp: {
    type: 'string', label: webLocalized.otp,
    default: '111111', // Stage whitelist ที่ตกลงใช้สำหรับชุดทดสอบนี้
    pattern: '^[0-9]{6}$', minLength: 6, maxLength: 6,
    visibleWhen: { field: 'loginMethod', equals: LoginMethod.PHONE },
    requiredWhen: { field: 'loginMethod', equals: LoginMethod.PHONE },
  },
  email: {
    type: 'string', label: webLocalized.email,
    visibleWhen: { field: 'loginMethod', equals: LoginMethod.EMAIL },
    requiredWhen: { field: 'loginMethod', equals: LoginMethod.EMAIL },
  },
};
