import test from 'node:test';
import assert from 'node:assert/strict';
import { caseRegistry } from '../MainManager/case-registry.mjs';

function mockCore(calls) {
  return {
    waitForVisible: async id => { calls.push(['visible', id]); return { elementId: id }; },
    tap: async element => calls.push(['tap', element.elementId]),
    waitForHidden: async id => calls.push(['hidden', id]),
    expectVisible: async element => calls.push(['expectVisible', element.elementId]),
  };
}
test('confirm script selects confirm regardless of obsolete additionalData', async () => {
  const calls = [];
  await caseRegistry.get('LOGIN_OPEN_PROFILE')({ core: mockCore(calls), loginConfig: { shouldLogin: false }, additionalData: { popupAction: 'cancel' } });
  assert.deepEqual(calls.filter(([action]) => action === 'tap'), [['tap', 'mainAppPageLoginButton'], ['tap', 'loginConfirmPopupConfirmButton']]);
  assert.deepEqual(calls.at(-1), ['hidden', 'loginConfirmPopupView']);
});
test('cancel script selects cancel then verifies main', async () => {
  const calls = [];
  await caseRegistry.get('LOGIN_OPEN_PROFILE_CANCEL')({ core: mockCore(calls) });
  assert.deepEqual(calls.filter(([action]) => action === 'tap'), [['tap', 'mainAppPageLoginButton'], ['tap', 'loginConfirmPopupCancelButton']]);
  assert.deepEqual(calls.at(-1), ['expectVisible', 'mainAppPageView']);
});
test('script stops before tap when main is missing', async () => {
  const error = new Error('main absent');
  await assert.rejects(caseRegistry.get('LOGIN_OPEN_PROFILE')({ core: { waitForVisible: async () => { throw error; } } }), actual => actual === error);
});
