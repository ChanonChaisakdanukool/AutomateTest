import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.includes('REPLACE_WITH_')) {
    throw new Error(`${name} must be a non-empty value; replace example placeholders.`);
  }
}

export function toCapabilities(config, configPath) {
  if (config?.schemaVersion !== 1) throw new Error('schemaVersion must be 1.');
  requireText(config.profileName, 'profileName');
  const allowed = { iOS: ['real', 'simulator'], Android: ['real', 'emulator'] };
  if (!allowed[config.platform]?.includes(config.device?.type)) throw new Error('Invalid platform / device.type combination.');
  requireText(config.device.id, 'device.id');
  const app = config.app;
  if (!app || !['installed', 'file'].includes(app.source)) throw new Error('app.source must be installed or file.');
  const caps = {
    platformName: config.platform,
    'appium:automationName': config.platform === 'iOS' ? 'XCUITest' : 'UiAutomator2',
    'appium:udid': config.device.id,
    // Preserve persisted app data. Per-case soft reset belongs to Main Manager.
    'appium:noReset': true,
  };
  if (app.source === 'file') {
    requireText(app.path, 'app.path');
    caps['appium:app'] = resolve(dirname(resolve(configPath)), app.path);
  }
  const appKey = config.platform === 'iOS' ? 'bundleId' : 'appPackage';
  if (app.source === 'installed' || app[appKey] !== undefined) {
    requireText(app[appKey], `app.${appKey}`);
    caps[`appium:${appKey}`] = app[appKey];
  }
  if (config.platform === 'Android' && app.appActivity !== undefined) {
    requireText(app.appActivity, 'app.appActivity');
    caps['appium:appActivity'] = app.appActivity;
  }
  return caps;
}

export async function loadDeviceConfig(path) {
  const absolutePath = resolve(path);
  const config = JSON.parse(await readFile(absolutePath, 'utf8'));
  const capabilities = toCapabilities(config, absolutePath);
  if (capabilities['appium:app']) await access(capabilities['appium:app']);
  return { config, capabilities };
}
