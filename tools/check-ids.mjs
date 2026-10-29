import { ElementIds } from 'shared-element-ids';
const required = {
  main: ElementIds.mainApp?.main?.mainAppPageView,
  profile: ElementIds.mainApp?.main?.mainAppPageLoginButton,
  popup: ElementIds.authentication?.loginConfirm?.loginConfirmPopupView,
  confirm: ElementIds.authentication?.loginConfirm?.loginConfirmPopupConfirmButton,
  cancel: ElementIds.authentication?.loginConfirm?.loginConfirmPopupCancelButton,
};
for (const [name, id] of Object.entries(required)) {
  if (typeof id !== 'string' || !id.trim()) throw new Error(`Missing IDFile contract entry: ${name}`);
}
console.log('Required Login IDs imported. UI bindings still require an app test.');
