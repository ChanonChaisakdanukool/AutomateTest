import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** ค่ากลางระดับ Run ไม่รวมกับ additionalData ของเคส */
export function getLoginConfig(config) {
  const shouldLogin = config.shouldLogin ?? true;
  if (typeof shouldLogin !== 'boolean') {
    throw new TypeError('shouldLogin must be boolean.');
  }
  if (config.loginMethod !== undefined && !['phone', 'email'].includes(config.loginMethod)) {
    throw new TypeError('loginMethod must be phone or email.');
  }
  for (const key of ['phoneNumber', 'email']) {
    if (config[key] !== undefined && (typeof config[key] !== 'string' || !config[key].trim())) {
      throw new TypeError(`${key} must be a non-empty string.`);
    }
  }
  if (shouldLogin && config.loginMethod) {
    const requiredField = config.loginMethod === 'phone' ? 'phoneNumber' : 'email';
    if (!config[requiredField]) {
      throw new TypeError(`${requiredField} is required for the selected loginMethod.`);
    }
  }
  return {
    shouldLogin,
    loginMethod: config.loginMethod,
    phoneNumber: config.phoneNumber,
    email: config.email,
  };
}

/** ตรวจทุกเคสก่อนสร้าง session เพื่อไม่ให้รันไปครึ่งทางแล้วพบ config ผิด */
export function validateTestCaseConfig(config, registry) {
  if (!isObject(config) || typeof config.shouldContinueNextCaseWhenFail !== 'boolean') {
    throw new TypeError('TestCase Config requires shouldContinueNextCaseWhenFail (boolean).');
  }
  if (config.platform !== undefined && !['iOS', 'Android'].includes(config.platform)) {
    throw new TypeError('RunConfig.platform must be iOS or Android.');
  }
  getLoginConfig(config);
  if (config.runName !== undefined && (typeof config.runName !== 'string' || !config.runName.trim())) {
    throw new TypeError('runName must be a non-empty string when provided.');
  }
  if (!Array.isArray(config.testCases) || config.testCases.length === 0) {
    throw new TypeError('testCases must contain at least one case.');
  }
  for (const [index, entry] of config.testCases.entries()) {
    const definition = entry?.case;
    if (!isObject(definition) || typeof definition.id !== 'string' || !definition.id.trim()) {
      throw new TypeError(`Invalid case.id at index ${index}.`);
    }
    if (typeof registry.get(definition.id) !== 'function') {
      throw new TypeError(`Case is not registered: ${definition.id}`);
    }
    if (definition.additionalData !== undefined && !isObject(definition.additionalData)) {
      throw new TypeError(`additionalData must be an object: ${definition.id}`);
    }
  }
  return config;
}

/** โหลด file references หนึ่งระดับตามลำดับก่อน validate/open session */
export async function loadTestCaseConfig(path, registry) {
  const configPath = resolve(path);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  if (!isObject(config) || !Array.isArray(config.testCases)) {
    return validateTestCaseConfig(config, registry);
  }

  const testCases = [];
  for (const [index, entry] of config.testCases.entries()) {
    if (!isObject(entry) || !Object.hasOwn(entry, 'file')) {
      testCases.push(entry);
      continue;
    }
    if (Object.keys(entry).length !== 1 || typeof entry.file !== 'string' || !entry.file.trim()) {
      throw new TypeError(`testCases[${index}] file reference must contain only a non-empty file path.`);
    }
    const casePath = resolve(dirname(configPath), entry.file);
    let loaded;
    try {
      loaded = JSON.parse(await readFile(casePath, 'utf8'));
    } catch (error) {
      throw new Error(`Cannot load testCases[${index}] from ${casePath}: ${error.message}`, { cause: error });
    }
    // ไฟล์หนึ่งรายการต้องมี case เท่านั้น ไม่ทำ recursive include หรือ override ค่ากลาง
    if (!isObject(loaded) || Object.keys(loaded).length !== 1 || !Object.hasOwn(loaded, 'case')) {
      throw new TypeError(`Case file must contain exactly one case object: ${casePath}`);
    }
    testCases.push(loaded);
  }
  return validateTestCaseConfig({ ...config, testCases }, registry);
}
