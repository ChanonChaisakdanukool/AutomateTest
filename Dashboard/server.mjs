import http from 'node:http';
import { stripVTControlCharacters } from 'node:util';
import { readFile, readdir, writeFile, rename, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { caseRegistry } from '../MainManager/case-registry.mjs';
import { loadTestCaseConfig } from '../MainManager/testcase-config.mjs';
import { loadDeviceConfig } from '../MainManager/device-config.mjs';
import { selectDeviceConfig } from '../MainManager/runner.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = join(root, 'Config/Local/RunConfig.json');
const port = Number(process.env.DASHBOARD_PORT ?? 4730);
const origin = `http://127.0.0.1:${port}`;
const token = randomBytes(32).toString('hex');
let appium;
let run;
let busy = false;
let runState = { status: 'idle', exitCode: null };
const logs = { appium: '', run: '' };
const log = (kind, text) => { logs[kind] = (logs[kind] + stripVTControlCharacters(text)).slice(-200000); };

async function appiumStatus() {
  try {
    const response = await fetch('http://127.0.0.1:4723/status', { signal: AbortSignal.timeout(1200) });
    const data = await response.json();
    if (response.ok && data.value?.build?.version && data.value?.ready === true) return 'ready';
    return 'unavailable';
  } catch { return appium ? 'starting' : 'offline'; }
}

function launch(kind, args) {
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, AUTOMATION_PROGRESS: kind === 'run' ? '1' : '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  logs[kind] = '';
  log(kind, `เริ่ม ${kind} เวลา ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}\n`);
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', chunk => log(kind, chunk));
  }
  child.on('error', error => log(kind, `${error.message}\n`));
  child.on('close', (code, signal) => {
    log(kind, `\nจบ ${kind}: exit=${code}, signal=${signal ?? '-'}\n`);
    if (kind === 'appium') appium = null;
    else { run = null; runState = { status: code === 0 ? 'PASS' : code === 1 ? 'FAIL' : 'ERROR', exitCode: code }; }
  });
  return child;
}

async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 262144) throw new Error('Config ใหญ่เกิน 256 KB');
  }
  return JSON.parse(text);
}

async function saveConfig(config) {
  // temporary file อยู่ข้าง RunConfig เพื่อให้ relative case references ยังทำงานเดิม
  const temporary = `${configPath}.dashboard-${randomBytes(6).toString('hex')}.tmp`;
  await mkdir(join(root, 'Config/Local'), { recursive: true });
  try {
    await writeFile(temporary, JSON.stringify(config, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await loadTestCaseConfig(temporary, caseRegistry);
    selectDeviceConfig(config.platform);
    await rename(temporary, configPath);
  } finally { await rm(temporary, { force: true }); }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
  // Local-only API, Host + Origin + per-process token prevent other websites controlling the runner.
  if (req.headers.host !== `127.0.0.1:${port}`) return json(403, { error: 'Invalid host' });
  if (req.headers.origin && req.headers.origin !== origin) return json(403, { error: 'Invalid origin' });
  try {
    if (req.method === 'GET' && req.url === '/') {
      const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html.replace('__TOKEN__', token));
    }
    if (req.headers['x-dashboard-token'] !== token) return json(403, { error: 'Invalid token' });
    if (req.method === 'GET' && req.url === '/api/config') {
      let config;
      try { config = JSON.parse(await readFile(configPath, 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; config = JSON.parse(await readFile(join(root, 'Config/Examples/RunConfig.json'), 'utf8')); }
      const caseFolder = join(root, 'Config/TestCases');
      const cases = [];
      for (const file of (await readdir(caseFolder, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
        if (!file.isFile() || !file.name.endsWith('.json')) continue;
        const entry = JSON.parse(await readFile(join(caseFolder, file.name), 'utf8'));
        if (!entry.case || Object.keys(entry).length !== 1 || !caseRegistry.has(entry.case.id)) throw new Error(`Invalid case file: ${file.name}`);
        cases.push({ name: file.name.slice(0, -5), entry });
      }
      // Resolve existing references before editing so each execution owns an independent data copy.
      const sourcePath = await readFile(configPath).then(() => configPath).catch(error => {
        if (error.code === 'ENOENT') return join(root, 'Config/Examples/RunConfig.json');
        throw error;
      });
      config = await loadTestCaseConfig(sourcePath, caseRegistry);
      return json(200, { config, cases });
    }
    if (req.method === 'GET' && req.url === '/api/status') return json(200, { appium: await appiumStatus(), run: runState, logs });
    if (req.method !== 'POST' || !['/api/config', '/api/appium/start', '/api/run/start'].includes(req.url)) return json(404, { error: 'Not found' });
    if (busy || run) return json(409, { error: 'กำลังทำงาน กรุณารอให้จบก่อน' });
    busy = true;
    try {
      if (req.url === '/api/config') { await saveConfig(await body(req)); return json(200, { message: 'บันทึก RunConfig แล้ว' }); }
      if (req.url === '/api/appium/start') {
        if (await appiumStatus() === 'ready') return json(200, { message: 'Appium พร้อมใช้งานอยู่แล้ว' });
        if (appium) return json(200, { message: 'กำลังเปิด Appium' });
        appium = launch('appium', ['node_modules/appium/build/lib/main.js', '--address', '127.0.0.1', '--port', '4723']);
        return json(200, { message: 'กำลังเปิด Appium' });
      }
      if (await appiumStatus() !== 'ready') return json(409, { error: 'กรุณาเปิด Appium และรอสถานะพร้อมก่อน' });
      const config = await loadTestCaseConfig(configPath, caseRegistry);
      const device = await loadDeviceConfig(selectDeviceConfig(config.platform));
      if (device.config.platform !== config.platform) throw new Error('Device Config platform ไม่ตรงกัน');
      runState = { status: 'running', exitCode: null };
      run = launch('run', ['MainManager/run.mjs']);
      return json(200, { message: 'เริ่มทดสอบแล้ว ดู log ด้านล่าง' });
    } finally { busy = false; }
  } catch (error) { json(400, { error: error.message }); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  console.log(`Dashboard: ${origin}\nKeep this window open. Control+C closes dashboard and its child processes.`);
  if (process.platform === 'darwin' && process.env.DASHBOARD_NO_OPEN !== '1') spawn('open', [origin], { stdio: 'ignore' }).on('error', () => {});
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  run?.kill('SIGTERM'); appium?.kill('SIGTERM'); server.close();
  setTimeout(() => process.exit(0), 2000).unref();
});
