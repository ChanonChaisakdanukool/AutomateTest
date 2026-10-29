import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runWithResults, renderReport, formatRunFolderName } from '../MainManager/results.mjs';

async function fixture(t) {
  const folder = await mkdtemp(join(tmpdir(), 'result-test-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  return { root: join(folder, 'Results'), fallbackRoot: folder };
}
const summary = () => ({ runName: 'Smoke', status: 'PASS', cases: [{ executionIndex: 1, caseId: 'same', status: 'PASS' }, { executionIndex: 2, caseId: 'same', status: 'PASS' }], errors: [], skippedCases: [] });

test('saves raw result, escaped report and ordered journal; duplicate IDs remain distinct', async t => {
  const config = await fixture(t);
  const result = await runWithResults({}, { ...config, run: async ({ onEvent }) => {
    await onEvent({ event: 'caseStarted', executionIndex: 1, caseId: 'same' });
    return summary();
  } });
  const raw = JSON.parse(await readFile(join(result.resultLocation, 'result.json'), 'utf8'));
  assert.deepEqual(raw.cases.map(c => c.executionIndex), [1, 2]);
  assert.equal(raw.status, 'PASS');
  assert.deepEqual(raw.timeline.map(e => e.event), ['runStarted', 'caseStarted']);
  const journal = (await readFile(join(result.resultLocation, 'journal.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(journal.map(e => e.event), ['runStarted', 'caseStarted', 'runFinished']);
  assert.match(await readFile(join(result.resultLocation, 'report.html'), 'utf8'), /Smoke/);
});

test('preflight and sessionStart failures are saved without inventing cases', async t => {
  const config = await fixture(t);
  const preflight = await runWithResults(() => { throw new Error('invalid args'); }, config);
  assert.equal(preflight.errors[0].phase, 'preflight');
  assert.ok(preflight.resultLocation);
  const result = await runWithResults({}, { ...config, run: async () => ({ status: 'ERROR', cases: [], errors: [{ phase: 'sessionStart', message: 'WDA timeout' }], skippedCases: [{ executionIndex: 1, caseId: 'login' }] }) });
  const raw = JSON.parse(await readFile(join(result.resultLocation, 'result.json'), 'utf8'));
  assert.equal(raw.errors[0].phase, 'sessionStart');
  assert.equal(raw.cases.length, 0);
  assert.equal(raw.skippedCases.length, 1);
});

test('unwritable primary stops before automation and writes fallback', async t => {
  const config = await fixture(t);
  await writeFile(config.root, 'file blocks directory');
  let ran = false;
  const result = await runWithResults({}, { ...config, run: async () => { ran = true; return summary(); } });
  assert.equal(ran, false);
  assert.equal(result.status, 'ERROR');
  assert.equal(result.resultFallback, true);
  assert.ok(JSON.parse(await readFile(join(result.resultLocation, 'result.json'), 'utf8')));
});

test('failed final write preserves original FAIL and uses fallback', async t => {
  const config = await fixture(t);
  const result = await runWithResults({}, { ...config, run: async () => {
    // Removing output after preflight simulates losing the primary destination mid-run.
    await rm(config.root, { recursive: true });
    return { ...summary(), status: 'FAIL', cases: [{ executionIndex: 1, caseId: 'one', status: 'FAIL', error: { message: 'original mismatch' } }] };
  } });
  assert.equal(result.status, 'ERROR');
  assert.equal(result.cases[0].error.message, 'original mismatch');
  assert.equal(result.resultFallback, true);
});

test('both destinations failing reports unsaved result', async t => {
  const config = await fixture(t);
  await writeFile(config.root, 'blocked');
  const result = await runWithResults({}, { ...config, fallbackRoot: config.root });
  assert.equal(result.resultSaveFailed, true);
  assert.equal(result.resultLocation, null);
});

test('concurrent runs have different folders and unfinished run is listed', async t => {
  const config = await fixture(t);
  await mkdir(join(config.root, '20261029000000_0001'), { recursive: true });
  const results = await Promise.all([1, 2].map(() => runWithResults({}, { ...config, run: async () => summary() })));
  assert.notEqual(results[0].resultLocation, results[1].resultLocation);
  assert.ok(results[0].incompleteRuns.includes('20261029000000_0001'));
});

test('HTML escapes names and error messages instead of executing markup', () => {
  const html = renderReport({ ...summary(), runName: '<script>alert(1)</script>', errors: [{ message: '<img src=x onerror=alert(1)>' }] });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;script&gt;/);
  const timelineHtml = renderReport({ ...summary(), startedAt: '2026-10-29T10:30:00Z', finishedAt: '2026-10-29T10:31:00Z', timeline: [
    { event: 'runStarted', at: '2026-10-29T10:30:00Z' },
    { event: 'caseStarted', at: '2026-10-29T10:30:01Z', executionIndex: 2, caseId: '<bad>' },
    { event: 'caseFinished', at: '2026-10-29T10:30:02Z', result: { executionIndex: 2, caseId: '<bad>', status: 'FAIL' } },
  ], skippedCases: [{ executionIndex: 3, caseId: 'next' }] });
  assert.match(timelineHtml, /17:30:00/);
  assert.match(timelineHtml, /เริ่มเคส #2 &lt;bad&gt;/);
  assert.match(timelineHtml, /จบเคส #2 &lt;bad&gt;/);
  assert.match(timelineHtml, /ไม่ได้รันเคส #3 next/);
  assert.ok(!timelineHtml.includes('<bad>'));

});


test('folder uses Thai time and optional sanitized runName from config', async t => {
  assert.equal(formatRunFolderName('2026-10-29T10:30:15Z', 1, 'LoginOpenProfile'), '2026-10-29_17-30-15_0001_LoginOpenProfile');
  assert.equal(formatRunFolderName('2026-10-29T20:30:15Z', 2), '2026-10-30_03-30-15_0002');
  assert.equal(formatRunFolderName('2026-10-29T10:30:15Z', 1, '../a:b/c'), '2026-10-29_17-30-15_0001_..-a-b-c');
  const config = await fixture(t);
  const testCasePath = join(config.fallbackRoot, 'config.json');
  await writeFile(testCasePath, JSON.stringify({ runName: 'LoginOpenProfile' }));
  const result = await runWithResults({ testCasePath }, { ...config, run: async () => ({ ...summary(), runName: 'LoginOpenProfile' }) });
  assert.match(result.runId, /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_\d{4}_LoginOpenProfile$/);
  assert.ok(result.resultLocation.endsWith(result.runId));
  const journal = JSON.parse((await readFile(join(result.resultLocation, 'journal.jsonl'), 'utf8')).split('\n')[0]);
  assert.equal(journal.runId, result.runId);
  await mkdir(join(config.root, '2026-10-29_17-30-15_0001_Unfinished'));
  const next = await runWithResults({}, { ...config, run: async () => summary() });
  assert.ok(next.incompleteRuns.includes('2026-10-29_17-30-15_0001_Unfinished'));
});
