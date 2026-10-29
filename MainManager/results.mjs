import { mkdir, readFile, writeFile, rename, appendFile, readdir, access, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runAutomation } from './runner.mjs';

const defaultRoot = fileURLToPath(new URL('../Results/', import.meta.url));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/** แสดงเวลาไทยโดยไม่ขึ้นกับ timezone ของเครื่องที่เปิดรายงาน */
function thaiTime(value) {
  if (!value || Number.isNaN(Date.parse(value))) return 'ไม่ระบุเวลา';
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(new Date(value));
}

/** ใช้เหตุการณ์จริง; รายงานเก่าใช้เวลาเริ่ม–จบที่บันทึกในผลเคส */
function renderTimeline(result) {
  const events = result.timeline ?? [
    { event: 'runStarted', at: result.startedAt },
    ...result.cases.flatMap(item => [
      ...(item.startedAt ? [{ event: 'caseStarted', at: item.startedAt, ...item }] : []),
      ...(item.finishedAt ? [{ event: 'caseFinished', at: item.finishedAt, result: item }] : []),
    ]),
  ];
  const entries = events.map(event => {
    const item = event.result ?? event;
    const caseName = `เคส #${item.executionIndex} ${item.caseId}`;
    const descriptions = {
      runStarted: ['เริ่มชุดทดสอบ', 'เริ่ม'],
      caseStarted: [`เริ่ม${caseName}`, 'เริ่ม'],
      caseFinished: [`จบ${caseName}`, item.status],
    };
    const [description, status] = descriptions[event.event] ?? [event.event, '—'];
    return [event.at ?? event.startedAt, description, status];
  });
  // เคสที่ข้ามไม่มีเวลา execution จึงไม่สร้างเวลาสมมุติให้
  for (const item of result.skippedCases) {
    entries.push([null, `ไม่ได้รันเคส #${item.executionIndex} ${item.caseId}`, 'SKIPPED']);
  }
  entries.push([result.finishedAt, 'จบชุดทดสอบ', result.status]);
  return entries.map(([at, description, status]) => `<tr><td>${escapeHtml(thaiTime(at))}</td><td>${escapeHtml(description)}</td><td>${escapeHtml(status)}</td></tr>`).join('');
}

/** รายงานอ่านจากผลดิบเท่านั้น ไม่ฝัง Config หรือ additionalData */
export function renderReport(result) {
  const rows = [...result.cases, ...result.skippedCases.map(item => ({ ...item, status: 'SKIPPED' }))]
    .sort((a, b) => a.executionIndex - b.executionIndex)
    .map(item => `<tr><td>${item.executionIndex}</td><td>${escapeHtml(item.caseId)}</td><td>${escapeHtml(item.status)}</td><td>${item.durationMs ?? '—'}</td><td>${escapeHtml(item.error?.message)}</td></tr>`).join('');
  return `<!doctype html><html lang="th"><meta charset="utf-8"><title>Automation Result</title>
<style>body{font:16px system-ui;max-width:1100px;margin:40px auto;padding:0 24px;color:#18252f}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd5db;padding:12px;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere}h1{color:#17675c}</style>
<h1>${escapeHtml(result.runName ?? 'Automation run')} — ${escapeHtml(result.status)}</h1>
<p>Run ID: ${escapeHtml(result.runId)}</p><p>เวลาไทย (Asia/Bangkok): ${escapeHtml(thaiTime(result.startedAt))} → ${escapeHtml(thaiTime(result.finishedAt))} (${result.durationMs} ms)</p>
<p>Platform: ${escapeHtml(result.platform ?? 'unknown')}</p>
<table><thead><tr><th>#</th><th>Case</th><th>Result</th><th>ms</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table>
<h2>ลำดับการทำงาน</h2>
<p>เวลาไทย (UTC+7) · PASS = ผ่าน · FAIL = พฤติกรรมไม่ตรงตามคาด · ERROR = ระบบทำงานผิดพลาด · SKIPPED = ไม่ได้รัน</p>
<table><thead><tr><th>วันและเวลา</th><th>เหตุการณ์</th><th>ผล</th></tr></thead><tbody>${renderTimeline(result)}</tbody></table>
<h2>ข้อผิดพลาดระดับชุดทดสอบ</h2><pre>${escapeHtml(JSON.stringify(result.errors, null, 2))}</pre>
<p>ยังไม่ได้เก็บ Screenshot / Video และ Step History ในรุ่นนี้</p><p><a href="result.json">ผลดิบ JSON</a> · <a href="journal.jsonl">Journal</a></p></html>`;
}

async function atomicWrite(path, content) {
  await writeFile(`${path}.tmp`, content, { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}

/** ชื่อสำหรับ filesystem; เก็บ runName ต้นฉบับไว้ในรายงาน */
export function formatRunFolderName(startedAt, count, runName) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(startedAt)).map(part => [part.type, part.value]));
  const stamp = `${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}-${parts.second}`;
  const safeName = typeof runName === 'string'
    ? Array.from(runName.trim().replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '-')).slice(0, 60).join('').replace(/[. ]+$/g, '')
    : '';
  return `${stamp}_${String(count).padStart(4, '0')}${safeName ? `_${safeName}` : ''}`;
}

/** mkdir แบบ exclusive ป้องกันชื่อซ้ำระหว่าง process ที่มี timestamp และชื่อเดียวกัน */
async function createRunFolder(root, startedAt, runName) {
  await mkdir(root, { recursive: true });
  for (let count = 1; ; count++) {
    const runId = formatRunFolderName(startedAt, count, runName);
    const folder = join(root, runId);
    try { await mkdir(folder, { mode: 0o700 }); return { runId, folder }; }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
}

/** ไม่มีผลสุดท้าย = รอบอาจหยุดกลางทาง ห้ามสรุป PASS หรือรันซ้ำเอง */
async function findIncompleteRuns(root) {
  const entries = await readdir(root, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const incomplete = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^(?:\d{14}_\d+|\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_\d+(?:_.+)?)$/.test(entry.name)) continue;
    try { await access(join(root, entry.name, 'result.json')); }
    catch (error) { if (error.code === 'ENOENT') incomplete.push(entry.name); else throw error; }
  }
  return incomplete;
}

/** จุดเข้าใช้งานจริง: เขียน Journal ก่อนเปิด session และบันทึกแม้ preflight ล้มเหลว */
export async function runWithResults(options, {
  root = defaultRoot, fallbackRoot = tmpdir(), run = runAutomation,
} = {}) {
  const startedAt = new Date().toISOString();
  const start = performance.now();
  let location;
  let storageError;
  let summary;
  let incompleteRuns = [];
  const timeline = [{ event: 'runStarted', at: startedAt }];
  let resolvedOptions;
  let argumentError;
  let runName = null;
  try { resolvedOptions = typeof options === 'function' ? options() : options; }
  catch (error) { argumentError = error; }
  // อ่านเฉพาะชื่อก่อนสร้างโฟลเดอร์; loader หลักยังตรวจ Config ตามเดิม
  if (resolvedOptions?.testCasePath) {
    try {
      const config = JSON.parse(await readFile(resolvedOptions.testCasePath, 'utf8'));
      if (typeof config?.runName === 'string' && config.runName.trim()) runName = config.runName;
    } catch { /* Config ผิดยังต้องมีโฟลเดอร์ผล และให้ preflight รายงานสาเหตุ */ }
  }
  try {
    incompleteRuns = await findIncompleteRuns(root);
    location = await createRunFolder(root, startedAt, runName);
    await appendFile(join(location.folder, 'journal.jsonl'), JSON.stringify({ event: 'runStarted', startedAt, runId: location.runId }) + '\n', { mode: 0o600 });
    if (argumentError) throw argumentError;
    summary = await run({ ...resolvedOptions, onEvent: async event => {
      const recordedEvent = structuredClone({ ...event, at: new Date().toISOString() });
      timeline.push(recordedEvent);
      try {
        await appendFile(join(location.folder, 'journal.jsonl'), JSON.stringify(recordedEvent) + '\n');
      } catch (error) {
        storageError = error;
        throw error;
      }
    } });
  } catch (error) {
    if (!location) storageError = error;
    summary = { runName, status: 'ERROR', cases: [], skippedCases: [], errors: [{ phase: storageError ? 'resultWrite' : 'preflight', name: error.name, message: error.message }] };
  }
  const result = {
    schemaVersion: 1, runId: location?.runId ?? startedAt.replace(/[^0-9]/g, ''),
    startedAt, finishedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - start),
    ...summary, incompleteRuns, timeline,
    evidence: { screenshot: 'notImplemented', video: 'notImplemented', stepHistory: 'notImplemented' },
  };
  try {
    if (storageError) throw storageError;
    await atomicWrite(join(location.folder, 'report.html'), renderReport(result));
    await appendFile(join(location.folder, 'journal.jsonl'), JSON.stringify({ event: 'runFinished', at: result.finishedAt, status: result.status }) + '\n');
    await atomicWrite(join(location.folder, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    return { ...result, resultLocation: location.folder };
  } catch (error) {
    result.status = 'ERROR';
    result.errors.push({ phase: 'resultWrite', message: error.message });
    try {
      const folder = await mkdtemp(join(fallbackRoot, 'automate-result-'));
      await atomicWrite(join(folder, 'result.json'), JSON.stringify(result, null, 2) + '\n');
      return { ...result, resultLocation: folder, resultFallback: true };
    } catch (fallbackError) {
      result.errors.push({ phase: 'resultFallback', message: fallbackError.message });
      return { ...result, resultLocation: null, resultSaveFailed: true };
    }
  }
}
