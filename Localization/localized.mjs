import { th } from './th.mjs';

/** ป้องกันชื่อ Step แสดง undefined แทน ID ที่หายไป */
function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string.`);
  return value;
}

function format(key, values = {}) {
  if (!Object.hasOwn(th, key)) throw new TypeError(`Unknown localized key: ${key}`);
  return th[key].replace(/\{(\w+)\}/g, (_, name) => text(values[name], name));
}

/** ชื่อขั้นตอนสำหรับ Script/Page/Core; เก็บข้อความที่แปลงแล้วใน Result ณ เวลารัน */
export const localized = Object.freeze({
  wait: id => format('wait', { id }),
  findElement: id => format('findElement', { id }),
  findByScrolling: (containerId, id) => format('findByScrolling', { containerId, id }),
  waitForVisible: id => format('waitForVisible', { id }),
  waitForHidden: id => format('waitForHidden', { id }),
  tap: id => format('tap', { id }),
  inputText: id => format('inputText', { id }),
  clearText: id => format('clearText', { id }),
  getText: id => format('getText', { id }),
  getValue: id => format('getValue', { id }),
  isVisible: id => format('isVisible', { id }),
  isEnabled: id => format('isEnabled', { id }),
  expectVisible: id => format('expectVisible', { id }),
  expectText: id => format('expectText', { id }),
  expectValue: id => format('expectValue', { id }),
  switchToNative: () => format('switchToNative'),
  switchToWebView: () => format('switchToWebView'),
  sequence: (first, next) => format('sequence', { first, next }),
});
