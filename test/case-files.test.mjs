import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTestCaseConfig } from '../MainManager/testcase-config.mjs';

async function setup(t, entries, content) {
  const folder = await mkdtemp(join(tmpdir(), 'case refs '));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await mkdir(join(folder, 'local'));
  const path = join(folder, 'local', 'run.json');
  await writeFile(path, JSON.stringify({ shouldContinueNextCaseWhenFail: false, testCases: entries }));
  if (content !== undefined) await writeFile(join(folder, 'case.json'), content);
  return path;
}
const registry = new Map([['one', async () => {}], ['two', async () => {}]]);
test('relative refs and inline preserve order and duplicate independence', async t => {
  const path = await setup(t, [{ file: '../case.json' }, { case: { id: 'two' } }, { file: '../case.json' }], JSON.stringify({ case: { id: 'one', additionalData: { value: 1 } } }));
  const result = await loadTestCaseConfig(path, registry);
  assert.deepEqual(result.testCases.map(x => x.case.id), ['one', 'two', 'one']);
  result.testCases[0].case.additionalData.value = 2;
  assert.equal(result.testCases[2].case.additionalData.value, 1);
});
test('missing or malformed case files fail preflight', async t => {
  for (const content of [undefined, '{bad', JSON.stringify({ file: 'case.json' }), JSON.stringify({ case: { id: 'unknown' } })]) {
    const path = await setup(t, [{ file: '../case.json' }], content);
    await assert.rejects(loadTestCaseConfig(path, registry));
  }
});
test('mixed file and inline keys rejected', async t => {
  const path = await setup(t, [{ file: '../case.json', case: { id: 'one' } }]);
  await assert.rejects(loadTestCaseConfig(path, registry), /only a non-empty file path/);
});
