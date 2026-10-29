import { loginOpenProfile } from '../Scripts/Login/open-profile.mjs';
import { loginOpenProfileCancel } from '../Scripts/Login/open-profile-cancel.mjs';

export const caseRegistry = new Map([
  ['LOGIN_OPEN_PROFILE', loginOpenProfile],
  ['LOGIN_OPEN_PROFILE_CANCEL', loginOpenProfileCancel],
]);
