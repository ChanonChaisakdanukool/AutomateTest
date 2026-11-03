import { loginAdditionalDataSchema } from '../Scripts/Login/additional-data-schema.mjs';
import { loginOpenProfile } from '../Scripts/Login/open-profile.mjs';
import { loginOpenProfileCancel } from '../Scripts/Login/open-profile-cancel.mjs';

export const caseRegistry = new Map([
  ['LOGIN_OPEN_PROFILE', loginOpenProfile],
  ['LOGIN_OPEN_PROFILE_CANCEL', loginOpenProfileCancel],
]);

// Registry เดียวเป็นเจ้าของ Script และ Schema; Dashboard ไม่รู้จักเงื่อนไขของ Login
export const caseSchemas = new Map([['LOGIN_OPEN_PROFILE', loginAdditionalDataSchema]]);
caseRegistry.schemas = caseSchemas;
