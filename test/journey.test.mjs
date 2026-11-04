import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourney } from '../MainManager/journey.mjs';
import { CoreError } from '../Core/index.mjs';
import { renderReport, getTimelineEntries } from '../MainManager/results.mjs';
import { createExcelReport } from '../MainManager/excel-report.mjs';
import ExcelJS from 'exceljs';

test('failed assertion preserves first error, marks remaining plan skipped and never executes it', async () => {
  const steps = [], events = [], calls = [];
  const error = new CoreError('ASSERTION_MISMATCH', 'unexpected value');
  const journey = createJourney({ steps, context: { executionIndex: 2, caseId: 'duplicate' }, onEvent: async event => events.push(structuredClone(event)) });
  await assert.rejects(journey.run([
    { id: 'open', name: 'เปิดหน้า', action: async () => calls.push('open') },
    { id: 'verify', name: 'ตรวจค่า', action: async () => { throw error; } },
    { id: 'pay', name: 'ขั้นตอนถัดไป', action: async () => calls.push('pay') },
  ]), actual => actual === error);
  assert.deepEqual(steps.map(step => step.status), ['PASS', 'FAIL', 'SKIPPED']);
  assert.deepEqual(calls, ['open']);
  assert.ok(steps[1].durationMs >= 0);
  assert.equal(steps[2].startedAt, undefined);
  assert.equal(events[0].executionIndex, 2);
  assert.equal(events[0].step.status, 'RUNNING');
  await assert.rejects(journey.run([{ id: 'retry', name: 'retry', action: async () => {} }]), /continue/);
});

test('system error is ERROR; each execution owns independent records', async () => {
  const first = [], second = [];
  await assert.rejects(createJourney({ steps: first }).run([{ id: 'one', name: 'ระบบ', action: async () => { throw Error('session lost'); } }]), /session lost/);
  await createJourney({ steps: second }).run([{ id: 'one', name: 'ระบบ', action: async () => 'secret return value' }]);
  assert.equal(first[0].status, 'ERROR'); assert.equal(second[0].status, 'PASS');
  assert.ok(!JSON.stringify(second).includes('secret'));
});

test('Journal failure prevents action; finishing Journal error cannot mask original failure', async () => {
  let called = false; const steps = [];
  await assert.rejects(createJourney({ steps, onEvent: async () => { throw Error('disk full'); } }).run([{ id: 'one', name: 'step', action: async () => { called = true; } }]), /disk full/);
  assert.equal(called, false); assert.equal(steps[0].status, 'ERROR');
  const original = Error('original');
  await assert.rejects(createJourney({ onEvent: async event => { if(event.event === 'stepFinished') throw Error('write failed'); } }).run([{ id: 'one', name: 'step', action: async () => { throw original; } }]), actual => actual === original);
});

test('HTML and Excel preserve executed and skipped steps with safe literal labels', async () => {
  const steps = [];
  await assert.rejects(createJourney({ steps }).run([
    { id: 'verify', name: '<script>ตรวจค่า</script>', action: async () => { throw Error('broken'); } },
    { id: 'later', name: '=1+1', action: async () => {} },
  ]));
  const result = { status: 'ERROR', cases: [{ executionIndex: 1, caseId: 'test', status: 'ERROR', steps, failedStep: 'verify' }], errors: [], skippedCases: [], startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() };
  const html = renderReport(result);
  assert.ok(html.includes('&lt;script&gt;ตรวจค่า&lt;/script&gt;')); assert.ok(!html.includes('<script>ตรวจค่า'));
  assert.ok(html.includes('SKIPPED')); assert.ok(html.includes('ตรวจพบปัญหาที่ขั้นตอน: verify'));
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await createExcelReport(result, getTimelineEntries(result)));
  const sheet = book.getWorksheet('Journey ราย Step');
  assert.equal(sheet.getCell('F5').value, 'ERROR'); assert.equal(sheet.getCell('F6').value, 'SKIPPED');
  assert.equal(sheet.getCell('E6').value, '=1+1'); assert.equal(sheet.getCell('E6').type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('G6').value, null);
});
