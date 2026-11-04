import { fileURLToPath } from 'node:url';
import { elementLocators } from '../Config/element-locators.mjs';
import { remote } from 'webdriverio';
import { createCore } from '../Core/index.mjs';
import { TIMEOUTS } from '../Config/timeouts.mjs';
import { loadDeviceConfig } from './device-config.mjs';
import { loadTestCaseConfig, getLoginConfig } from './testcase-config.mjs';
import { createJourney, classifyFailure } from './journey.mjs';
import { caseRegistry } from './case-registry.mjs';

/** เลือก profile หลักต่อ platform จากโฟลเดอร์ Local ของโปรเจกต์ */
export function selectDeviceConfig(platform) {
  const files = { iOS: 'DeviceConfig.ios.json', Android: 'DeviceConfig.android.json' };
  if (!Object.hasOwn(files, platform)) {
    throw new TypeError('RunConfig.platform must be iOS or Android.');
  }
  return fileURLToPath(new URL(`../Config/Local/${files[platform]}`, import.meta.url));
}

/** แปลง error เป็นข้อมูลสรุป ไม่เก็บ Config หรือ additionalData ซึ่งอาจมีรหัสผ่าน */
function describeError(error) {
  return {
    name: error?.name ?? 'Error',
    code: error?.code,
    ...(error?.code === 'AMBIGUOUS_ELEMENT' ? { details: error.details } : {}),
    message: error?.message ?? String(error),
  };
}

/** Timeout ไม่ยกเลิกคำสั่งบนอุปกรณ์; เมื่อเกิดขึ้น runner จะหยุด ไม่ retry */
async function withTimeout(operation, timeout, phase) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${phase} timed out; command may still be running.`)), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * รันหนึ่งอุปกรณ์ตามลำดับ ใช้ Appium server ที่เปิดไว้แล้ว
 * เคสรับ { core, loginConfig, additionalData, executionIndex } และ throw เมื่อไม่ผ่าน
 * คืนสรุปพร้อมเวลา และส่ง event ให้ Result Writer ผ่าน onEvent
 */
export async function runAutomation({
  devicePath,
  testCasePath,
  registry = caseRegistry,
  createSession = remote,
  coreFactory = createCore,
  onEvent = async () => {},
  saveVideo,
}) {
  const testConfig = await loadTestCaseConfig(testCasePath, registry);
  const selectedDevicePath = devicePath ?? selectDeviceConfig(testConfig.platform);
  const { config: deviceConfig, capabilities } = await loadDeviceConfig(selectedDevicePath);
  if (testConfig.platform !== undefined && testConfig.platform !== deviceConfig.platform) {
    throw new TypeError('RunConfig.platform must match DeviceConfig.platform.');
  }
  const loginConfig = getLoginConfig(testConfig);
  const appId = deviceConfig.platform === 'iOS'
    ? deviceConfig.app.bundleId
    : deviceConfig.app.appPackage;

  // แม้ติดตั้งจาก file ก็ต้องรู้ app ID เพื่อปิด–เปิดแอปหลังแต่ละเคส
  if (typeof appId !== 'string' || !appId.trim() || appId.includes('REPLACE_WITH_')) {
    throw new TypeError('Runner requires app.bundleId (iOS) or app.appPackage (Android) for soft reset.');
  }

  const summary = {
    runName: testConfig.runName ?? null,
    platform: deviceConfig.platform,
    status: 'PASS',
    cases: [],
    errors: [],
    skippedCases: [],
  };
  let driver;
  let phase = 'sessionStart';

  try {
    // ปิด retry ของ WebdriverIO เพื่อไม่ replay คำสั่ง/ธุรกรรมโดยอัตโนมัติ
    // ใช้ HTTP timeout ของ client สำหรับสร้าง session เพื่อไม่ทิ้ง late session จาก Promise.race
    driver = await createSession({
      hostname: '127.0.0.1',
      port: 4723,
      path: '/',
      logLevel: 'error',
      connectionRetryCount: 0,
      connectionRetryTimeout: TIMEOUTS.sessionStart,
      capabilities,
    });

    phase = 'coreSetup';
    await driver.setTimeout({ implicit: 0 });
    let core = coreFactory({ driver, platform: deviceConfig.platform, locators: elementLocators });

    for (const [index, entry] of testConfig.testCases.entries()) {
      const definition = entry.case;
      const result = { executionIndex: index + 1, caseId: definition.id, status: 'PASS', steps: [] };
      phase = 'caseExecution';
      const caseStart = performance.now();
      result.startedAt = new Date().toISOString();
      await onEvent({ event: 'caseStarted', executionIndex: result.executionIndex, caseId: result.caseId });

      let recording = false;
      if (saveVideo) {
        try {
          await driver.startRecordingScreen({ forceRestart: true });
          recording = true;
        } catch (error) {
          result.video = { status: 'unavailable', phase: 'start', error: describeError(error) };
        }
      }

      try {
        // Clone ต่อ execution ป้องกันเคสแก้ข้อมูลแล้วส่งผลต่อ duplicate case ถัดไป
        await registry.get(definition.id)({
          core,
          journey: createJourney({ steps: result.steps, context: { executionIndex: index + 1, caseId: definition.id }, onEvent }),
          loginConfig: structuredClone(loginConfig),
          additionalData: structuredClone(definition.additionalData ?? {}),
          executionIndex: index + 1,
        });
      } catch (error) {
        // เฉพาะ assertion ที่อ่านค่าแล้วไม่ตรงเท่านั้นเป็น FAIL
        // หาไม่พบ/timeout ยังไม่ยืนยันสาเหตุ จึงรายงาน ERROR ใน runner ขั้นพื้นฐาน
        result.status = classifyFailure(error);
        result.error = describeError(error);
        const failedStep = result.steps.find(step => ['FAIL', 'ERROR'].includes(step.status));
        if (failedStep) result.failedStep = failedStep.stepId;
      }
      result.finishedAt = new Date().toISOString();
      result.durationMs = Math.round(performance.now() - caseStart);
      if (recording) {
        let videoPhase = 'stop';
        try {
          const encoded = await driver.stopRecordingScreen();
          if (result.status !== 'PASS') {
            if (!encoded) throw new Error('Appium returned an empty screen recording.');
            videoPhase = 'save';
            const path = await saveVideo(result.executionIndex, Buffer.from(encoded, 'base64'));
            result.video = { status: 'saved', path };
          }
        } catch (error) {
          result.video = { status: 'unavailable', phase: videoPhase, error: describeError(error) };
        }
      }
      summary.cases.push(result);
      await onEvent({ event: 'caseFinished', result });

      if (result.status === 'ERROR') {
        summary.status = 'ERROR';
        if (result.error?.code === 'COMMAND_TIMEOUT') break;
      }
      if (result.status === 'FAIL' && summary.status !== 'ERROR') {
        summary.status = 'FAIL';
      }

      phase = 'softReset';
      await withTimeout(() => driver.terminateApp(appId), TIMEOUTS.appTerminate, phase);
      await withTimeout(() => driver.activateApp(appId), TIMEOUTS.appLaunch, phase);
      await driver.switchContext('NATIVE_APP');
      core = coreFactory({ driver, platform: deviceConfig.platform, locators: elementLocators });

      if (['FAIL', 'ERROR'].includes(result.status) && !testConfig.shouldContinueNextCaseWhenFail) {
        break;
      }
    }
  } catch (error) {
    summary.status = 'ERROR';
    summary.errors.push({ phase, ...describeError(error) });
  } finally {
    if (driver) {
      try {
        await withTimeout(() => driver.deleteSession(), TIMEOUTS.sessionClose, 'sessionClose');
      } catch (error) {
        summary.status = 'ERROR';
        summary.errors.push({ phase: 'sessionClose', ...describeError(error) });
      }
    }
  }

  summary.skippedCases = testConfig.testCases.slice(summary.cases.length).map((entry, offset) => ({
    executionIndex: summary.cases.length + offset + 1,
    caseId: entry.case.id,
  }));
  return summary;
}
