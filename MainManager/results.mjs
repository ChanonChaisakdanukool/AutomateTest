import { webLocalized } from '../Localization/web-th.mjs';
import { mkdir, readFile, writeFile, rename, appendFile, readdir, access, mkdtemp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createExcelReport } from './excel-report.mjs';
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
export function getTimelineEntries(result) {
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
      stepStarted: [`${caseName} — เริ่มขั้นตอน ${event.step?.stepName ?? ''}`, 'เริ่ม'],
      stepFinished: [`${caseName} — จบขั้นตอน ${event.step?.stepName ?? ''}`, event.step?.status],
    };
    const [description, status] = descriptions[event.event] ?? [event.event, '—'];
    return [event.at ?? event.startedAt, description, status];
  });
  // เคสที่ข้ามไม่มีเวลา execution จึงไม่สร้างเวลาสมมุติให้
  for (const item of result.skippedCases) {
    entries.push([null, `ไม่ได้รันเคส #${item.executionIndex} ${item.caseId}`, 'SKIPPED']);
  }
  entries.push([result.finishedAt, 'จบชุดทดสอบ', result.status]);
  return entries;
}

function renderTimeline(result) {
  return getTimelineEntries(result).map(([at, description, status]) => `<tr><td>${escapeHtml(thaiTime(at))}</td><td>${escapeHtml(description)}</td><td>${escapeHtml(webLocalized['status'+status]??status)}</td></tr>`).join('');
}

/** แสดงทุก execution แยกกัน รวมขั้นตอนที่ยังไม่ได้ทำตามแผน */
function renderJourneys(result) {
  return result.cases.map(item => {
    const rows = (item.steps ?? []).map(step => `<tr><td>${step.stepIndex}</td><td>${escapeHtml(step.stepId)}</td><td>${escapeHtml(step.stepName)}</td><td title="${escapeHtml(step.status)}">${escapeHtml(webLocalized['status'+step.status] ?? step.status)}</td><td>${escapeHtml(thaiTime(step.startedAt))}</td><td>${escapeHtml(thaiTime(step.finishedAt))}</td><td>${step.durationMs ?? '—'}</td><td>${escapeHtml(step.error?.message)}</td></tr>`).join('');
    return `<h3>เคส #${item.executionIndex} ${escapeHtml(item.caseId)} — ${escapeHtml(webLocalized['status'+item.status] ?? item.status)}</h3>${item.failedStep ? `<p class="step-problem" ><span aria-hidden="true">⚠</span> ${webLocalized.failedStep}: ${escapeHtml(item.failedStep)}</p>` : ''}${item.video?.status === 'unavailable' ? `<p>${webLocalized.videoUnavailable} (${escapeHtml(item.video.phase)}) · ${escapeHtml(item.video.error.message)}</p>` : ''}${rows ? `<div style="overflow-x:auto"><table><thead><tr><th>#</th><th>Step ID</th><th>${webLocalized.reportStep}</th><th>ผล</th><th>${webLocalized.reportStart}</th><th>${webLocalized.reportFinish}</th><th>ms</th><th>${webLocalized.reportProblem}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p>${webLocalized.reportNoSteps}</p>`}`;
  }).join('') || `<p>${webLocalized.reportNoCases}</p>`;
}

/** รายงานอ่านจากผลดิบเท่านั้น ไม่ฝัง Config หรือ additionalData */
export function renderReport(result) {
  const rows = [...result.cases, ...result.skippedCases.map(item => ({ ...item, status: 'SKIPPED' }))]
    .sort((a, b) => a.executionIndex - b.executionIndex)
    .map(item => `<tr class="${['PASS', 'FAIL', 'ERROR'].includes(item.status) ? item.status : ''}"><td>${item.executionIndex}</td><td class="case-name">${escapeHtml(item.caseId)}${['FAIL', 'ERROR'].includes(item.status) && item.video?.status === 'saved' ? `<div class="video-action"><button type="button" data-video-case="${item.executionIndex}">${webLocalized.reportVideo}</button></div>` : ''}</td><td>${escapeHtml(webLocalized['status'+item.status] ?? item.status)}</td><td>${item.durationMs ?? '—'}</td><td>${escapeHtml(item.error?.message)}</td></tr>`).join('');
  return `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${webLocalized.reportTitle}</title>
<style>body{font:16px system-ui;max-width:1100px;margin:40px auto;padding:0 24px;color:#18252f}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd5db;padding:12px;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere}h1{color:#17675c}tr.PASS{background:#e6f4ea}tr.ERROR,tr.FAIL{background:#fde9e9}.video-action{margin-top:10px}button{padding:8px 16px;cursor:pointer;border:0;border-radius:6px;background:#215b82;color:white;font:inherit}dialog{width:min(900px,94vw);border:1px solid #bcc9d5;border-radius:12px;padding:20px}dialog::backdrop{background:#000a}video{display:block;max-width:100%;max-height:75vh;margin:12px auto}
:root{color-scheme:light;--bg:#fff;--text:#242b35;--border:#dce1e7;--soft:#f6f8fa;--pass:#eaf5ee;--error:#fceced;--problem:#b42318}
html[data-theme=dark]{color-scheme:dark;--bg:#1b1e24;--text:#e1e6ef;--border:#363d48;--soft:#222730;--pass:#193b2c;--error:#43272c;--problem:#ffb7bd}
@media(prefers-color-scheme:dark){html:not([data-theme=light]){color-scheme:dark;--bg:#1b1e24;--text:#e1e6ef;--border:#363d48;--soft:#222730;--pass:#193b2c;--error:#43272c;--problem:#ffb7bd}}
body{font:14px/1.6 system-ui,sans-serif;color:var(--text);background:var(--bg);margin:24px auto;padding:0 20px}h1{font-size:24px;color:var(--text);margin:20px 0 12px}h2{font-size:18px;margin-top:32px}h3{font-size:15px}td,th{border-color:var(--border);padding:10px 12px;overflow-wrap:anywhere}th{background:var(--soft);font-size:12px}tr.PASS{background:var(--pass)}tr.ERROR,tr.FAIL{background:var(--error)}.case-name{font-family:ui-monospace,monospace}.step-problem{color:var(--problem);font-weight:700}dialog{background:var(--bg);color:var(--text);border-color:var(--border);border-radius:8px}.summary-strip{display:flex;flex-wrap:wrap;gap:20px;padding:14px 0;border-bottom:1px solid var(--border)}.summary-strip strong{font-size:20px}button{font-size:13px}a{color:#4688be}
</style>
<div class="summary-strip">${['PASS','FAIL','ERROR','SKIPPED'].map(status=>`<span><strong>${status==='SKIPPED'?result.skippedCases.length:result.cases.filter(item=>item.status===status).length}</strong> ${webLocalized['status'+status]}</span>`).join('')}<span>${Number.isFinite(result.durationMs)?(result.durationMs/1000).toFixed(1):'—'} s</span></div>
<h1>${escapeHtml(result.runName ?? 'Automation run')} — ${escapeHtml(webLocalized['status'+result.status] ?? result.status)}</h1>
<p><strong>${webLocalized.reportRunId}:</strong> ${escapeHtml(result.runId)}</p><p><strong>${webLocalized.reportThaiTime}:</strong> ${escapeHtml(thaiTime(result.startedAt))} → ${escapeHtml(thaiTime(result.finishedAt))} (${result.durationMs} ms)</p>
<p><strong>${webLocalized.platform}:</strong> ${escapeHtml(result.platform ?? 'unknown')}</p>
<table><thead><tr><th>#</th><th>${webLocalized.reportCase}</th><th>${webLocalized.reportResult}</th><th>ms</th><th>${webLocalized.reportError}</th></tr></thead><tbody>${rows}</tbody></table>
<h2>${webLocalized.reportSteps}</h2>
${renderJourneys(result)}
<h2>${webLocalized.reportTimeline}</h2>
<p>${webLocalized.reportLegend}</p>
<table><thead><tr><th>${webLocalized.reportTime}</th><th>${webLocalized.reportEvent}</th><th>ผล</th></tr></thead><tbody>${renderTimeline(result)}</tbody></table>
<h2>${webLocalized.reportErrors}</h2><pre>${escapeHtml(JSON.stringify(result.errors, null, 2))}</pre>
<p>${webLocalized.reportVideoPolicy}</p><p><a href="report.xlsx">${webLocalized.downloadExcel}</a> · <a href="result.json">${webLocalized.reportRaw}</a> · <a href="journal.jsonl">Journal</a></p>
<dialog id="reportVideoDialog"><button type="button" id="reportVideoClose">${webLocalized.close}</button><p id="reportVideoMessage"></p><video id="reportVideo" controls playsinline></video></dialog>
<script>
const dialog=document.getElementById('reportVideoDialog');
const video=document.getElementById('reportVideo');
const message=document.getElementById('reportVideoMessage');
document.querySelectorAll('[data-video-case]').forEach(button=>button.onclick=()=>{
 message.textContent='${webLocalized.caseNumber}'+button.dataset.videoCase;
 video.src='case-'+button.dataset.videoCase+'.mp4';dialog.showModal();
});
document.getElementById('reportVideoClose').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>{video.pause();video.removeAttribute('src');video.load();});
video.onerror=()=>{if(video.getAttribute('src'))message.textContent='${webLocalized.videoUnsupported}';};
</script></html>`;
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
    summary = await run({ ...resolvedOptions, saveVideo: async (executionIndex, video) => {
      const path = resolve(location.folder, `case-${executionIndex}.mp4`);
      await atomicWrite(path, video);
      return path;
    }, onEvent: async event => {
      const recordedEvent = structuredClone({ ...event, at: new Date().toISOString() });
      timeline.push(recordedEvent);
      if (process.env.AUTOMATION_PROGRESS === '1') {
        const item = event.result ?? event;
        console.log(`[${recordedEvent.at}] ${event.event} #${item.executionIndex ?? '-'} ${item.caseId ?? ''} ${event.step?.stepName ?? ''} ${event.step?.status ?? item.status ?? ''}`);
      }
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
    evidence: { screenshot: 'notImplemented', video: 'failedCasesOnly', stepHistory: 'scriptDefined' },
  };
  try {
    if (storageError) throw storageError;
    await atomicWrite(join(location.folder, 'report.xlsx'), await createExcelReport(result, getTimelineEntries(result)));
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
