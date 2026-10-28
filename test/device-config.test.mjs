import test from 'node:test';
import assert from 'node:assert/strict';
import { toCapabilities } from '../MainManager/device-config.mjs';
const ios = () => ({ schemaVersion: 1, profileName: 'ios', platform: 'iOS', device: { type: 'simulator', id: 'test-udid' }, app: { source: 'installed', bundleId: 'test.app' } });
test('installed iOS app produces XCUITest capabilities', () => {
  const caps = toCapabilities(ios(), '/tmp/config/device.json');
  assert.equal(caps['appium:bundleId'], 'test.app');
  assert.equal(caps['appium:automationName'], 'XCUITest');
  assert.equal(caps['appium:noReset'], true);
  assert.equal(caps['appium:app'], undefined);
});
test('file paths resolve relative to config, not working directory', () => {
  const config = ios(); config.app = { source: 'file', path: '../build/App.app' };
  assert.equal(toCapabilities(config, '/tmp/config/device.json')['appium:app'], '/tmp/build/App.app');
});
test('Android uses package and activity', () => {
  const config = ios(); config.platform = 'Android'; config.device.type = 'emulator';
  config.app = { source: 'installed', appPackage: 'test.app', appActivity: '.MainActivity' };
  const caps = toCapabilities(config, '/tmp/device.json');
  assert.equal(caps['appium:automationName'], 'UiAutomator2');
  assert.equal(caps['appium:appActivity'], '.MainActivity');
});
test('rejects wrong platform/type, placeholders and missing app identity', () => {
  const wrong = ios(); wrong.device.type = 'emulator';
  const placeholder = ios(); placeholder.device.id = 'REPLACE_WITH_UDID';
  const missing = ios(); delete missing.app.bundleId;
  for (const config of [null, {}, wrong, placeholder, missing]) assert.throws(() => toCapabilities(config, '/tmp/device.json'));
});
