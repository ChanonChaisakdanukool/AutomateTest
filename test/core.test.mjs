import test from 'node:test';
import assert from 'node:assert/strict';
import { createCore } from '../Core/index.mjs';
const raw = id => ({ 'element-6066-11e4-a52e-4f735466cecf': id });
function setup(platform = 'iOS') {
  let scrolls = 0, clicks = 0;
  const driver = {
    findElements: async (_, value) => value === 'missing' ? [] : [raw(value)],
    findElementsFromElement: async (_, __, value) => value === 'target' && scrolls < 2 ? [] : [raw(value)],
    isElementDisplayed: async () => true,
    isElementEnabled: async () => true,
    getElementRect: async id => id === 'container' ? { x: 0, y: 0, width: 100, height: 100 } : { x: 10, y: 10, width: 20, height: 20 },
    getWindowRect: async () => ({ x: 0, y: 0, width: 100, height: 100 }),
    execute: async () => { scrolls++; return true; },
    elementClick: async () => { clicks++; },
    getElementText: async () => '50.00',
    getElementAttribute: async (_, attribute) => attribute,
    getContexts: async () => ['NATIVE_APP', 'WEBVIEW_shop'],
    switchContext: async () => {},
  };
  return { driver, core: createCore({ driver, platform, pollInterval: 1 }), counts: () => ({ scrolls, clicks }) };
}
test('scroll re-finds target, returns reference, then assertion and tap do not scroll', async () => {
  const { core, counts } = setup();
  const e = await core.findByScrolling({ containerId: 'container', targetId: 'target', maxScrolls: 3 });
  await core.expectText(e, '50.00'); await core.tap(e);
  assert.deepEqual(counts(), { scrolls: 2, clicks: 1 });
});
test('maxScrolls is exact; final viewport is inspected', async () => {
  const { core, counts } = setup();
  await assert.rejects(core.findByScrolling({ containerId: 'container', targetId: 'target', maxScrolls: 1 }), { code: 'SCROLL_TARGET_NOT_VISIBLE' });
  assert.equal(counts().scrolls, 1);
});
test('missing and mismatching values have separate codes', async () => {
  const { core } = setup();
  await assert.rejects(core.findElement('missing', { timeout: 10 }), { code: 'ELEMENT_NOT_FOUND' });
  const e = await core.findElement('label');
  await assert.rejects(core.expectText(e, '99', { timeout: 10 }), { code: 'ASSERTION_MISMATCH' });
});
test('session errors propagate unchanged, including isVisible', async () => {
  const { core, driver } = setup(); const e = await core.findElement('label');
  const error = new Error('invalid session id');
  driver.isElementDisplayed = async () => { throw error; };
  await assert.rejects(core.isVisible(e), e => e === error);
});
test('duplicate IDs reject instead of selecting first match', async () => {
  const { core, driver } = setup(); driver.findElements = async () => [raw('a'), raw('b')];
  await assert.rejects(core.findElement('button'), { code: 'AMBIGUOUS_ELEMENT' });
});
test('row scope is applied within container', async () => {
  const { core, driver } = setup(); const seen = [];
  driver.findElementsFromElement = async (parent, _, value) => { seen.push([parent, value]); return [raw(value)]; };
  await core.findByScrolling({ containerId: 'container', withinId: 'product123', targetId: 'buy' });
  assert.deepEqual(seen, [['container', 'product123'], ['product123', 'buy']]);
});
test('offscreen tap never clicks or scrolls', async () => {
  const { core, driver, counts } = setup(); const e = await core.findElement('button');
  driver.getElementRect = async () => ({ x: 0, y: 200, width: 20, height: 20 });
  await assert.rejects(core.tap(e), { code: 'ELEMENT_NOT_VISIBLE' });
  assert.deepEqual(counts(), { scrolls: 0, clicks: 0 });
});
test('command deadline prevents subsequent commands; no action retry', async () => {
  const { core, driver, counts } = setup(); const e = await core.findElement('button');
  driver.elementClick = () => new Promise(() => {});
  await assert.rejects(core.tap(e, { timeout: 10 }), { code: 'COMMAND_TIMEOUT' });
  await assert.rejects(core.getText(e), { code: 'SESSION_UNCERTAIN' });
  assert.equal(counts().scrolls, 0);
});
test('context changes invalidate old element references', async () => {
  const { core } = setup(); const e = await core.findElement('label');
  await core.switchToWebView('WEBVIEW_shop');
  await assert.rejects(core.getText(e), { code: 'INVALID_ELEMENT' });
});
test('platform value attributes are isolated', async () => {
  for (const [platform, expected] of [['iOS', 'value'], ['Android', 'text']]) {
    const { core } = setup(platform); assert.equal(await core.getValue(await core.findElement('input')), expected);
  }
});
