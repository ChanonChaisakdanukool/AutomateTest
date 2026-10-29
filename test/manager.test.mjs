import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAutomation } from '../MainManager/runner.mjs';
import { CoreError } from '../Core/index.mjs';

async function fixture(t, { continueOnFail = false, ids = ['one', 'one'] } = {}) {
  const folder = await mkdtemp(join(tmpdir(), 'manager-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const devicePath = join(folder, 'device.json');
  const testCasePath = join(folder, 'cases.json');
  await writeFile(devicePath, JSON.stringify({ schemaVersion: 1, profileName: 'test', platform: 'iOS', device: { type: 'simulator', id: 'sim-test' }, app: { source: 'installed', bundleId: 'test.app' } }));
  await writeFile(testCasePath, JSON.stringify({ shouldContinueNextCaseWhenFail: continueOnFail, testCases: ids.map(id => ({ case: { id, additionalData: { value: 1 } } })) }));
  const calls = [];
  const driver = {
    setTimeout: async () => calls.push('timeouts'),
    terminateApp: async () => calls.push('terminate'),
    activateApp: async () => calls.push('activate'),
    switchContext: async () => calls.push('native'),
    deleteSession: async () => calls.push('delete'),
  };
  const registry = new Map([['one', async ({ core, executionIndex, additionalData }) => {
    assert.ok(core); assert.equal(additionalData.value, 1); additionalData.value = 2;
    calls.push(`case${executionIndex}`);
  }]]);
  return {
    calls, driver, registry,
    options: { devicePath, testCasePath, registry,
      createSession: async options => { assert.equal(options.connectionRetryCount, 0); calls.push('open'); return driver; },
      coreFactory: () => ({ test: true }),
    },
  };
}
test('manager runs duplicate cases in order and closes after soft resets', async t => {
  const f = await fixture(t); const result = await runAutomation(f.options);
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.cases.map(c => c.executionIndex), [1, 2]);
  assert.deepEqual(f.calls, ['open', 'timeouts', 'case1', 'terminate', 'activate', 'native', 'case2', 'terminate', 'activate', 'native', 'delete']);
});
test('all registrations checked before opening session', async t => {
  const f = await fixture(t, { ids: ['one', 'unknown'] });
  await assert.rejects(runAutomation(f.options), /not registered/);
  assert.deepEqual(f.calls, []);
});
test('FAIL stops or continues according to config', async t => {
  for (const continueOnFail of [false, true]) {
    const f = await fixture(t, { continueOnFail });
    f.registry.set('one', async () => { throw new CoreError('ASSERTION_MISMATCH', 'wrong value'); });
    const result = await runAutomation(f.options);
    assert.equal(result.status, 'FAIL');
    assert.equal(result.cases.length, continueOnFail ? 2 : 1);
    assert.equal(result.skippedCases.length, continueOnFail ? 0 : 1);
    assert.equal(f.calls.at(-1), 'delete');
  }
});
test('system ERROR stops even when continuation is enabled', async t => {
  const f = await fixture(t, { continueOnFail: true });
  f.registry.set('one', async () => { throw new Error('session lost'); });
  const result = await runAutomation(f.options);
  assert.equal(result.status, 'ERROR'); assert.equal(result.cases.length, 1);
  assert.ok(!f.calls.includes('terminate')); assert.equal(f.calls.at(-1), 'delete');
});
test('cleanup failure preserves original case failure', async t => {
  const f = await fixture(t);
  f.registry.set('one', async () => { throw new CoreError('ASSERTION_MISMATCH', 'original'); });
  f.driver.deleteSession = async () => { throw new Error('cleanup'); };
  const result = await runAutomation(f.options);
  assert.equal(result.status, 'ERROR'); assert.equal(result.cases[0].error.message, 'original');
  assert.equal(result.errors[0].phase, 'sessionClose');
});
test('reset failure stops next case and still closes', async t => {
  const f = await fixture(t); f.driver.activateApp = async () => { throw new Error('reset failed'); };
  const result = await runAutomation(f.options);
  assert.equal(result.status, 'ERROR'); assert.equal(result.errors[0].phase, 'softReset');
  assert.equal(result.cases.length, 1); assert.equal(f.calls.at(-1), 'delete');
});
test('session creation failure does not call case or delete nonexistent session', async t => {
  const f = await fixture(t); f.options.createSession = async () => { throw new Error('offline'); };
  const result = await runAutomation(f.options);
  assert.equal(result.status, 'ERROR'); assert.equal(result.errors[0].phase, 'sessionStart');
  assert.equal(result.skippedCases.length, 2); assert.deepEqual(f.calls, []);
});
test('core setup failure still closes the session', async t => {
  const f = await fixture(t); f.options.coreFactory = () => { throw new Error('setup'); };
  const result = await runAutomation(f.options);
  assert.equal(result.status, 'ERROR'); assert.equal(result.errors[0].phase, 'coreSetup');
  assert.equal(f.calls.at(-1), 'delete');
});

test('run login config reaches every case independently from additionalData', async t => {
  const f = await fixture(t);
  const { readFile } = await import('node:fs/promises');
  const config = JSON.parse(await readFile(f.options.testCasePath, 'utf8'));
  Object.assign(config, { shouldLogin: true, loginMethod: 'phone', phoneNumber: '0800000000', email: 'test@example.com' });
  config.testCases[0].case.additionalData.phoneNumber = 'case-only';
  await writeFile(f.options.testCasePath, JSON.stringify(config));
  let executions = 0;
  f.registry.set('one', async ({ loginConfig, additionalData }) => {
    assert.equal(loginConfig.phoneNumber, '0800000000');
    assert.equal(loginConfig.loginMethod, 'phone');
    assert.equal(loginConfig.shouldLogin, true);
    if (executions++ === 0) assert.equal(additionalData.phoneNumber, 'case-only');
    loginConfig.phoneNumber = 'changed';
  });
  const result = await runAutomation(f.options);
  assert.equal(result.status, 'PASS');
  assert.equal(executions, 2);
  assert.ok(!JSON.stringify(result).includes('0800000000'));
});

test('invalid shared login config is rejected before session creation', async t => {
  const f = await fixture(t);
  const { readFile } = await import('node:fs/promises');
  const config = JSON.parse(await readFile(f.options.testCasePath, 'utf8'));
  config.shouldLogin = 'true';
  await writeFile(f.options.testCasePath, JSON.stringify(config));
  await assert.rejects(runAutomation(f.options), /shouldLogin/);
  assert.deepEqual(f.calls, []);
});

test('platform mapping selects project-local profiles and rejects unsupported platform', async () => {
  const { selectDeviceConfig } = await import('../MainManager/runner.mjs');
  assert.ok(selectDeviceConfig('iOS').endsWith('/Config/Local/DeviceConfig.ios.json'));
  assert.ok(selectDeviceConfig('Android').endsWith('/Config/Local/DeviceConfig.android.json'));
  assert.throws(() => selectDeviceConfig('windows'), /platform/);
});

test('platform mismatch rejected before opening session', async t => {
  const f = await fixture(t);
  const { readFile } = await import('node:fs/promises');
  const config = JSON.parse(await readFile(f.options.testCasePath, 'utf8'));
  config.platform = 'Android';
  await writeFile(f.options.testCasePath, JSON.stringify(config));
  await assert.rejects(runAutomation(f.options), /must match/);
  assert.deepEqual(f.calls, []);
});


test('journal failure stops next case and still closes session', async t => {
  const f = await fixture(t);
  f.options.onEvent = async event => {
    if (event.event === 'caseFinished') throw new Error('journal write failed');
  };
  const result = await runAutomation(f.options);
  assert.equal(result.status, 'ERROR');
  assert.equal(result.cases[0].status, 'PASS');
  assert.equal(result.cases.length, 1);
  assert.equal(result.skippedCases.length, 1);
  assert.equal(f.calls.at(-1), 'delete');
  assert.ok(!f.calls.includes('case2'));
});
