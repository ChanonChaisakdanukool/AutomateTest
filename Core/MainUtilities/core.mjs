import { performance } from 'node:perf_hooks';
import { TIMEOUTS, POLL_INTERVAL_MS } from '../../Config/timeouts.mjs';
import { adapters } from '../adapters.mjs';

import { createCoreError } from '../errors.mjs';

// คง export เดิมสำหรับผู้เรียกที่ import จากไฟล์นี้โดยตรง
export { CoreError } from '../errors.mjs';

/**
 * ตรวจ ID ว่าเป็น string ที่ไม่ว่าง คืนค่าเดิมโดยไม่ trim หรือเปลี่ยน ID
 */
const validateId = value => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('ID must be a non-empty string');
  }
  return value;
};
/**
 * ตรวจว่ากรอบ target อยู่เต็มในพื้นที่ร่วมของ container และหน้าจอ ไม่ตรวจ overlay ที่บัง
 */
const isFullyInside = (target, container, screen) => {
  const left = Math.max(container.x, screen.x);
  const top = Math.max(container.y, screen.y);
  const right = Math.min(container.x + container.width, screen.x + screen.width);
  const bottom = Math.min(container.y + container.height, screen.y + screen.height);
  return target.width > 0 && target.height > 0 && target.x >= left && target.y >= top &&
    target.x + target.width <= right && target.y + target.height <= bottom;
};

/**
 * สร้าง Interface กลางสำหรับ session ที่เปิดแล้ว ใช้หนึ่ง Core ต่อ session และเรียกคำสั่งตามลำดับ
 * @param {object} options
 * @param {object} options.driver WebdriverIO session ที่ Main Manager สร้างไว้
 * @param {'iOS'|'Android'|'Web'} options.platform Native ต้องเริ่มใน NATIVE_APP
 * @param {object} [options.locators] ฟังก์ชันแปลง ID เป็น { using, value } แยกตาม platform
 * @param {number} [options.pollInterval] ระยะ polling เป็นมิลลิวินาที ค่าเริ่มต้นจากไฟล์เวลากลาง
 * @returns {object} API ค้นหา รอ กด อ่าน ตรวจผล และเปลี่ยน context
 */
export function createCore({ driver, platform, locators = {}, pollInterval = POLL_INTERVAL_MS }) {
  if (!adapters[platform]) {
    throw new TypeError('platform must be iOS, Android or Web');
  }
  if (!Number.isFinite(pollInterval) || pollInterval <= 0) {
    throw new TypeError('Invalid pollInterval');
  }
  let currentPlatform = platform;
  let contextGeneration = 0;
  let sessionUncertain = false;
  const owner = Symbol('core');
  /**
   * เลือก implementation ตาม context ปัจจุบัน: Native ของ platform หรือ Web
   */
  const getAdapter = () => adapters[currentPlatform];
  /**
   * แปลง ID เป็น locator; ใช้ mapping ที่ผู้เรียกกำหนดก่อนค่าเริ่มต้นของ platform
   */
  const resolveLocator = getElementId => (locators[currentPlatform] ?? getAdapter().locator)(validateId(getElementId));
  /**
   * สร้าง deadline เดียวของ operation; timeout เป็นมิลลิวินาทีและต้องมากกว่า 0
   */
  function createDeadline(timeout) {
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new TypeError('timeout must be positive milliseconds');
    }
    const expiresAt = performance.now() + timeout;
    return {
      /**
       * คืนเวลาที่เหลือเป็นมิลลิวินาที โดยไม่ติดลบและไม่เริ่ม deadline ใหม่
       */
      left: () => Math.max(0, expiresAt - performance.now()),
      /**
       * เรียกคำสั่งครั้งเดียวภายในเวลาที่เหลือ; หมดเวลาแล้วปิดการใช้ Core ต่อ เพราะยกเลิกคำสั่งบน device ไม่ได้
       */
      async call(operation) {
        if (sessionUncertain) {
          throw createCoreError('SESSION_UNCERTAIN', 'Previous command timed out; stop using this Core');
        }
        const left = expiresAt - performance.now();
        if (left <= 0) {
          throw createCoreError('TIMEOUT', 'Operation deadline exceeded');
        }
        let timer;
        try {
          return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
            timer = setTimeout(() => {
              sessionUncertain = true;
              reject(createCoreError('COMMAND_TIMEOUT', 'Command may still be running; manager must stop this session'));
            }, left);
          })]);
        } finally {
          clearTimeout(timer);
        }
      },
      /**
       * พักระหว่าง polling ไม่เกินเวลาที่เหลือ; ไม่ใช่การ retry action
       */
      async pause() {
        const delay = Math.min(pollInterval, this.left());
        await new Promise(resolve => setTimeout(resolve, delay));
      },
    };
  }
  /**
   * ห่อ protocol element เป็น reference ของ Core พร้อมเจ้าของและรุ่น context
   */
  function createElementReference(protocolElement) {
    return Object.freeze({
      elementId: protocolElement['element-6066-11e4-a52e-4f735466cecf'] ?? protocolElement.ELEMENT,
      owner,
      generation: contextGeneration,
    });
  }
  /**
   * ตรวจ reference ว่ามาจาก Core/context นี้ แล้วคืน protocol element ID; ไม่ค้นหาใหม่เมื่อ stale
   */
  function getElementId(element) {
    if (
      !element ||
      element.owner !== owner ||
      element.generation !== contextGeneration ||
      !element.elementId
    ) {
      throw createCoreError('INVALID_ELEMENT', 'Use an Element from this Core and current context');
    }
    return element.elementId;
  }
  /**
   * ค้นหาหนึ่งครั้งใน parent หรือทั้งหน้า คืน reference/null; พบหลายตัวจะ throw AMBIGUOUS_ELEMENT
   */
  async function queryElement(targetId, parent, deadline) {
    const { using, value } = resolveLocator(targetId);
    const matches = await deadline.call(() => {
      if (parent) {
        return driver.findElementsFromElement(getElementId(parent), using, value);
      }
      return driver.findElements(using, value);
    });
    if (matches.length > 1) {
      throw createCoreError('AMBIGUOUS_ELEMENT', 'Multiple matches; provide a unique withinId', { targetId });
    }
    return matches.length ? createElementReference(matches[0]) : null;
  }
  /**
   * ค้นหา withinId ก่อน แล้วค้นหา target ภายใน; ถ้าไม่พบ parent คืน null
   */
  async function queryWithinScope(targetId, withinId, deadline) {
    const parent = withinId ? await queryElement(withinId, null, deadline) : null;
    if (withinId && !parent) {
      return null;
    }
    return queryElement(targetId, parent, deadline);
  }
  /** อ่านกรอบ element ด้วยพิกัดที่ adapter ของ platform กำหนด */
  async function readElementRect(element, deadline) {
    return deadline.call(() => {
      const platformAdapter = getAdapter();
      const elementId = getElementId(element);
      if (platformAdapter.rect) {
        return platformAdapter.rect(driver, elementId);
      }
      return driver.getElementRect(elementId);
    });
  }

  /**
   * ตรวจ displayed และกรอบ: ปกติเห็นบางส่วนถือว่า visible; ถ้ามี container ต้องเห็นเต็มกรอบ ไม่มีการเลื่อน
   */
  async function checkVisibility(element, deadline, container) {
    if (!await deadline.call(() => driver.isElementDisplayed(getElementId(element)))) {
      return false;
    }
    const target = await readElementRect(element, deadline);
    const screen = await deadline.call(() => {
      const platformAdapter = getAdapter();
      if (platformAdapter.viewport) {
        return platformAdapter.viewport(driver);
      }
      return driver.getWindowRect();
    });
    const bounds = container ? await readElementRect(container, deadline) : screen;
    if (container) {
      return isFullyInside(target, bounds, screen);
    }
    return target.width > 0 && target.height > 0 && target.x < screen.x + screen.width &&
      target.y < screen.y + screen.height && target.x + target.width > screen.x && target.y + target.height > screen.y;
  }
  /**
   * ค้นหาใหม่ทุก poll จน check ผ่าน คืน reference (หรือ null เมื่อ hidden เพราะไม่มี element); หมดเวลา throw code ที่ระบุ
   */
  async function waitForCondition(targetId, options, check, code) {
    const deadline = createDeadline(options.timeout);
    do {
      const element = await queryWithinScope(targetId, options.withinId, deadline);
      if (await check(element, deadline)) {
        return element;
      }
      await deadline.pause();
    } while (deadline.left() > 0);
    throw createCoreError(code, 'Condition not met before deadline', { targetId });
  }
  /**
   * ตรวจ reference แล้วเรียกคำสั่งหนึ่งครั้งภายใน timeout; ส่งต่อ driver error โดยไม่ retry
   */
  async function runElementCommand(element, operation, timeout = TIMEOUTS.action) {
    const deadline = createDeadline(timeout);
    getElementId(element);
    return deadline.call(() => operation(getElementId(element)));
  }
  /**
   * อ่านซ้ำจน Object.is(actual, expected) เป็นจริง; คืน undefined เมื่อผ่าน หรือ throw ASSERTION_MISMATCH เมื่อหมดเวลา
   */
  async function waitForExpectedValue(element, read, expected, timeout) {
    const deadline = createDeadline(timeout);
    let actual;
    do {
      actual = await read(element, deadline);
      if (Object.is(actual, expected)) {
        return;
      }
      await deadline.pause();
    } while (deadline.left() > 0);
    throw createCoreError('ASSERTION_MISMATCH', 'Observed value differs from expected', { expected, actual });
  }
  // ค้นหาและรอ

  /**
   * ค้นหาโดยไม่เลื่อน ไม่รับประกันว่า element มองเห็น
   * @param {string} targetId ID เป้าหมาย
   * @param {object} [options]
   * @param {string} [options.withinId] ID ของ parent ที่ใช้จำกัดการค้นหา
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<object>}
   */
  async function findElement(targetId, options = {}) {
    return waitForCondition(
      targetId,
      { timeout: TIMEOUTS.findElement, ...options },
      element => Boolean(element),
      'ELEMENT_NOT_FOUND',
    );
  }

  /**
   * ค้นหาใหม่จน element มองเห็น โดยไม่เลื่อน
   * @param {string} targetId ID เป้าหมาย
   * @param {object} [options]
   * @param {string} [options.withinId] ID ของ parent ที่ใช้จำกัดการค้นหา
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<object>}
   */
  async function waitForVisible(targetId, options = {}) {
    return waitForCondition(
      targetId,
      { timeout: TIMEOUTS.waitForVisible, ...options },
      (element, deadline) => element && checkVisibility(element, deadline),
      'VISIBILITY_TIMEOUT',
    );
  }

  /**
   * รอจน element หายหรือไม่มองเห็น โดยไม่เลื่อน
   * @param {string} targetId ID เป้าหมาย
   * @param {object} [options]
   * @param {string} [options.withinId] ID ของ parent ที่ใช้จำกัดการค้นหา
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<object|null>}
   */
  async function waitForHidden(targetId, options = {}) {
    return waitForCondition(
      targetId,
      { timeout: TIMEOUTS.waitForHidden, ...options },
      async (element, deadline) => !element || !await checkVisibility(element, deadline),
      'VISIBILITY_TIMEOUT',
    );
  }

  /**
   * ค้นหาใหม่หลังเลื่อนจนเป้าหมายเห็นเต็ม container ภายในเวลารวม
   * @param {object} options
   * @param {string} options.containerId ID ของพื้นที่เลื่อน
   * @param {string} options.targetId ID เป้าหมาย
   * @param {string} [options.withinId] ID ของแถวภายใน container
   * @param {"up"|"down"|"left"|"right"} [options.direction] ทิศทาง ค่าเริ่มต้น down
   * @param {number} [options.maxScrolls] จำนวนเลื่อนสูงสุด ค่าเริ่มต้น 5
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<object>}
   */
  async function findByScrolling({ containerId, targetId, withinId, direction = 'down', maxScrolls = 5, timeout = TIMEOUTS.findByScrolling }) {
    validateId(containerId);
    validateId(targetId);
    if (!['up', 'down', 'left', 'right'].includes(direction)) {
      throw new TypeError('Invalid direction');
    }
    if (!Number.isInteger(maxScrolls) || maxScrolls < 0) {
      throw new TypeError('Invalid maxScrolls');
    }
    const deadline = createDeadline(timeout);
    let canScroll = true;
    for (let count = 0; count <= maxScrolls; count++) {
      const container = await queryElement(containerId, null, deadline);
      if (!container) {
        throw createCoreError('CONTAINER_NOT_FOUND', 'Scroll container not found', { containerId });
      }
      const row = withinId ? await queryElement(withinId, container, deadline) : container;
      const element = row ? await queryElement(targetId, row, deadline) : null;
      if (element && await checkVisibility(element, deadline, container)) {
        return element;
      }
      if (!canScroll || count === maxScrolls || deadline.left() <= 0) {
        break;
      }
      canScroll = await deadline.call(() => getAdapter().scroll(driver, getElementId(container), direction)) !== false;
      await deadline.pause();
      if (deadline.left() <= 0) {
        break;
      }
    }
    throw createCoreError('SCROLL_TARGET_NOT_VISIBLE', 'Target not visible within scroll search limits', { containerId, targetId, maxScrolls });
  }

  // Action

  /**
   * ตรวจ visible/enabled แล้วกดครั้งเดียว ไม่เลื่อนหรือ retry
   * @param {object} element Reference ที่ได้จาก Core ใน context ปัจจุบัน
   * @param {object} [options]
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<void>}
   */
  async function tap(element, { timeout = TIMEOUTS.action } = {}) {
    const deadline = createDeadline(timeout);
    if (!await checkVisibility(element, deadline)) {
      throw createCoreError('ELEMENT_NOT_VISIBLE', 'Explicitly find/scroll before tap');
    }
    if (!await deadline.call(() => driver.isElementEnabled(getElementId(element)))) {
      throw createCoreError('ELEMENT_DISABLED', 'Element is disabled');
    }
    await deadline.call(() => driver.elementClick(getElementId(element)));
  }

  /**
   * ส่งข้อความครั้งเดียวเมื่อ visible โดยไม่ล้างข้อความเดิม
   * @param {object} element Reference ที่ได้จาก Core ใน context ปัจจุบัน
   * @param {string} value ข้อความที่จะกรอก
   * @param {object} [options]
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<void>}
   */
  async function inputText(element, value, { timeout = TIMEOUTS.action } = {}) {
    if (typeof value !== 'string') {
      throw new TypeError('Input must be a string');
    }
    const deadline = createDeadline(timeout);
    if (!await checkVisibility(element, deadline)) {
      throw createCoreError('ELEMENT_NOT_VISIBLE', 'Explicitly find/scroll before input');
    }
    await deadline.call(() => driver.elementSendKeys(getElementId(element), value));
  }

  /**
   * ล้างช่องกรอกเมื่อ visible โดยไม่เลื่อน
   * @param {object} element Reference ที่ได้จาก Core ใน context ปัจจุบัน
   * @param {object} [options]
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<void>}
   */
  async function clearText(element, { timeout = TIMEOUTS.action } = {}) {
    const deadline = createDeadline(timeout);
    if (!await checkVisibility(element, deadline)) {
      throw createCoreError('ELEMENT_NOT_VISIBLE', 'Explicitly find/scroll before clear');
    }
    await deadline.call(() => driver.elementClear(getElementId(element)));
  }

  // อ่านค่าและสถานะ

  /**
   * อ่านข้อความจาก driver โดยไม่แปลงรูปแบบ
   * @param {object} element Reference ที่ได้จาก Core ใน context ปัจจุบัน
   * @param {object} [options]
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<string>}
   */
  async function getText(element, { timeout } = {}) {
    return runElementCommand(element, elementId => driver.getElementText(elementId), timeout);
  }

  /**
   * อ่านค่าตาม platform; control พิเศษอาจต้องเพิ่ม mapping
   * @param {object} element Reference ที่ได้จาก Core ใน context ปัจจุบัน
   * @param {object} [options]
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<*>}
   */
  async function getValue(element, { timeout } = {}) {
    return runElementCommand(element, elementId => getAdapter().value(driver, elementId), timeout);
  }

  /**
   * ตรวจ displayed และ viewport; driver error ส่งต่อ ไม่กลบเป็น false
   * @param {object} element Reference ที่ได้จาก Core ใน context ปัจจุบัน
   * @param {object} [options]
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<boolean>}
   */
  async function isVisible(element, { timeout = TIMEOUTS.action } = {}) {
    return checkVisibility(element, createDeadline(timeout));
  }

  /**
   * ตรวจ enabled โดยไม่ตรวจ visible; driver error ส่งต่อ
   * @param {object} element Reference ที่ได้จาก Core ใน context ปัจจุบัน
   * @param {object} [options]
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<boolean>}
   */
  async function isEnabled(element, { timeout } = {}) {
    return runElementCommand(element, elementId => driver.isElementEnabled(elementId), timeout);
  }

  // ตรวจผล

  /**
   * รอ reference เดิมให้ visible โดยไม่เลื่อน
   * @param {object} element Reference ที่ได้จาก Core ใน context ปัจจุบัน
   * @param {object} [options]
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<void>}
   */
  async function expectVisible(element, { timeout = TIMEOUTS.assertion } = {}) {
    return waitForExpectedValue(element, checkVisibility, true, timeout);
  }

  /**
   * รอข้อความตรงแบบ exact ไม่ trim หรือแปลงชนิด
   * @param {object} element Reference ที่ได้จาก Core ใน context ปัจจุบัน
   * @param {*} expected ค่าที่คาดหวัง
   * @param {object} [options]
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<void>}
   */
  async function expectText(element, expected, { timeout = TIMEOUTS.assertion } = {}) {
    return waitForExpectedValue(
      element,
      (element, deadline) => deadline.call(() => driver.getElementText(getElementId(element))),
      expected,
      timeout,
    );
  }

  /**
   * รอค่าตรงด้วย Object.is โดยไม่แปลงชนิด
   * @param {object} element Reference ที่ได้จาก Core ใน context ปัจจุบัน
   * @param {*} expected ค่าที่คาดหวัง
   * @param {object} [options]
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<void>}
   */
  async function expectValue(element, expected, { timeout = TIMEOUTS.assertion } = {}) {
    return waitForExpectedValue(
      element,
      (element, deadline) => deadline.call(() => getAdapter().value(driver, getElementId(element))),
      expected,
      timeout,
    );
  }

  // Context

  /**
   * กลับ Native และยกเลิก reference เก่า ไม่รองรับ browser-only
   * @param {object} [options]
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<void>}
   */
  async function switchToNative({ timeout = TIMEOUTS.contextSwitch } = {}) {
    if (platform === 'Web') {
      throw createCoreError('UNSUPPORTED_CONTEXT', 'Browser-only session has no Native context');
    }
    await createDeadline(timeout).call(() => driver.switchContext('NATIVE_APP'));
    currentPlatform = platform;
    contextGeneration++;
  }

  /**
   * เลือก context ด้วยชื่อตรงตัว แล้วเปลี่ยน Web adapter และยกเลิก reference เก่า
   * @param {string} name ชื่อ WebView context
   * @param {object} [options]
   * @param {number} [options.timeout] เวลาสูงสุด (ms) ค่าเริ่มต้นจาก Config/timeouts.mjs
   * @returns {Promise<void>}
   */
  async function switchToWebView(name, { timeout = TIMEOUTS.contextSwitch } = {}) {
    validateId(name);
    if (platform === 'Web') {
      throw createCoreError('UNSUPPORTED_CONTEXT', 'Browser-only session is already Web');
    }
    const deadline = createDeadline(timeout);
    do {
      const contexts = await deadline.call(() => driver.getContexts());
      if (name !== 'NATIVE_APP' && contexts.includes(name)) {
        await deadline.call(() => driver.switchContext(name));
        currentPlatform = 'Web';
        contextGeneration++;
        return;
      }
      await deadline.pause();
    } while (deadline.left() > 0);
    throw createCoreError('CONTEXT_NOT_FOUND', 'Requested WebView context not found', { name });
  }

  return {
    findElement,
    waitForVisible,
    waitForHidden,
    findByScrolling,
    tap,
    inputText,
    clearText,
    getText,
    getValue,
    isVisible,
    isEnabled,
    expectVisible,
    expectText,
    expectValue,
    switchToNative,
    switchToWebView,
  };
}
