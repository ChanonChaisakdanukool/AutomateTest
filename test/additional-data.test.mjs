import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAdditionalData } from '../Shared/additional-data.mjs';
import { loginAdditionalDataSchema as login, LoginMethod } from '../Scripts/Login/additional-data-schema.mjs';
import { validateTestCaseConfig } from '../MainManager/testcase-config.mjs';
import { caseRegistry } from '../MainManager/case-registry.mjs';

test('login enum is optional, only phone/email allowed, conditional identity required', () => {
  assert.deepEqual(Object.values(LoginMethod), ['phone', 'email']);
  assert.deepEqual(normalizeAdditionalData(login), {});
  for (const value of ['none', 'sms', null, true]) assert.throws(() => normalizeAdditionalData(login, { loginMethod: value }), /enum/);
  assert.throws(() => normalizeAdditionalData(login, { loginMethod: 'phone' }), /phoneNumber is required/);
  assert.throws(() => normalizeAdditionalData(login, { loginMethod: 'email', email: '' }), /required/);
  const source = { loginMethod: 'phone', phoneNumber: '0800000000', email: 'unused@example.com' };
  assert.deepEqual(normalizeAdditionalData(login, source), { loginMethod: 'phone', phoneNumber: '0800000000', otp: '111111' });
  assert.ok(source.email);
  assert.deepEqual(normalizeAdditionalData(login, { phoneNumber: 'unused' }), {});
});

test('nested objects and enum dependencies prune descendants independent of field order', () => {
  const schema = {
    login: { type: 'object', required: true, fields: {
      speed: { type: 'enum', options: [{ value: 'slow' }], visibleWhen: { all: [{ field: 'login.method', equals: 'phone' }, { field: 'login.mode', equals: 'keyboard' }] } },
      mode: { type: 'enum', options: [{ value: 'keyboard' }, { value: 'auto' }], visibleWhen: { field: 'login.method', equals: 'phone' } },
      method: { type: 'enum', required: true, options: [{ value: 'phone' }, { value: 'email' }] },
      enabled: { type: 'boolean' }, retries: { type: 'number' },
    } },
  };
  const source = { login: { method: 'email', mode: 'keyboard', speed: 'slow', enabled: false, retries: 0 } };
  assert.deepEqual(normalizeAdditionalData(schema, source), { login: { method: 'email', enabled: false, retries: 0 } });
  assert.ok(source.login.speed);
  assert.throws(() => normalizeAdditionalData(schema, { login: { method: 'phone', enabled: 'false' } }), /boolean/);
  assert.throws(() => normalizeAdditionalData(schema, { login: { method: 'email', surprise: 1 } }), /Unknown/);
});

test('runner preflight validates registered schemas and rejects old global login fields', () => {
  const config = { shouldContinueNextCaseWhenFail: false, testCases: [{ case: { id: 'LOGIN_OPEN_PROFILE', additionalData: { loginMethod: 'phone' } } }] };
  assert.throws(() => validateTestCaseConfig(config, caseRegistry), /phoneNumber/);
  config.testCases[0].case.additionalData.phoneNumber = '0800000000';
  assert.equal(validateTestCaseConfig(config, caseRegistry).testCases[0].case.additionalData.loginMethod, 'phone');
  config.loginMethod = 'phone';
  assert.throws(() => validateTestCaseConfig(config, caseRegistry), /belongs in/);
});


test('OTP belongs to phone branch, defaults for Stage and retains leading zeroes', () => {
  const base = { loginMethod: 'phone', phoneNumber: '0800000000' };
  assert.equal(normalizeAdditionalData(login, base).otp, '111111');
  assert.equal(normalizeAdditionalData(login, { ...base, otp: '012345' }).otp, '012345');
  for (const otp of ['11111', '1111111', 'abcdef', 111111, '']) assert.throws(() => normalizeAdditionalData(login, { ...base, otp }));
  assert.deepEqual(normalizeAdditionalData(login, { loginMethod: 'email', email: 'test@example.com', phoneNumber: '0800000000', otp: '111111' }), { loginMethod: 'email', email: 'test@example.com' });
  assert.deepEqual(normalizeAdditionalData(login, { otp: '111111' }), {});
});
