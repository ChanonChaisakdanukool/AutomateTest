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
test('confirm-only script stops after popup when login method is absent', async () => {
  const calls = [];
  await caseRegistry.get('LOGIN_OPEN_PROFILE')({ core: mockCore(calls), loginConfig: { shouldLogin: false }, additionalData: {} });
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

for (const latest of [false, true]) {
  test(`phone login reaches Profile; latest=${latest}`, async () => {
    const calls = []; const core = mockCore(calls);
    core.waitForAnyVisible = async () => ({ targetId: latest ? 'latestLoginPageView' : 'loginPagePhoneTextField' });
    core.waitForEnabled = core.waitForVisible;
    core.clearText = async e => calls.push(['clear', e.elementId]);
    core.inputText = async (e, value) => calls.push(['input', e.elementId, value]);
    core.expectValue = async (e, expected, { normalize }) => {
      assert.equal(normalize('080-552 4025'), normalize(expected));
      calls.push(['verifyPhone', e.elementId]);
    };
    await caseRegistry.get('LOGIN_OPEN_PROFILE')({ core, additionalData: { loginMethod: 'phone', phoneNumber: '0805524025' } });
    assert.equal(calls.filter(c => c[1] === 'latestLoginPageLatestLoginNormalLoginButton' && c[0] === 'tap').length, latest ? 1 : 0);
    assert.deepEqual(calls.filter(c => c[0] === 'input'), [
      ['input', 'loginPagePhoneTextField', '0805524025'], ['input', 'loginPhoneOtpPageOtpTextField', '111111'],
    ]);
    assert.deepEqual(calls.at(-1), ['expectVisible', 'profilePageView']);
    assert.ok(calls.findIndex(c => c[0] === 'verifyPhone') < calls.findIndex(c => c[0] === 'tap' && c[1] === 'loginPageLoginButton'));
  });
}
test('invalid phone data and unsupported email stop before UI actions', async () => {
  const calls = [];
  for (const additionalData of [{ loginMethod: 'phone' }, { loginMethod: 'email', email: 'qa@example.com' }]) {
    await assert.rejects(caseRegistry.get('LOGIN_OPEN_PROFILE')({ core: mockCore(calls), additionalData }));
  }
  assert.equal(calls.length, 0);
});
test('OTP dismissal alone cannot pass without Profile', async () => {
  const calls = []; const core = mockCore(calls); const error = new Error('Profile not visible');
  core.waitForAnyVisible = async () => ({ targetId: 'loginPagePhoneTextField' });
  core.waitForEnabled = core.waitForVisible;
  core.clearText = core.inputText = core.expectValue = async () => {};
  const original = core.waitForVisible;
  core.waitForVisible = async id => { if (id === 'profilePageView') throw error; return original(id); };
  await assert.rejects(caseRegistry.get('LOGIN_OPEN_PROFILE')({ core, additionalData: { loginMethod: 'phone', phoneNumber: '0805524025' } }), actual => actual === error);
});
