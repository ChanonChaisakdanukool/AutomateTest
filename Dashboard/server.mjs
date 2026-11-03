import { webLocalized } from '../Localization/web-th.mjs';
import http from 'node:http';
import { promisify, stripVTControlCharacters } from 'node:util';
import { readFile, readdir, realpath, writeFile, rename, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { caseRegistry, caseSchemas } from '../MainManager/case-registry.mjs';
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
let stopping = false;
const exec = promisify(execFile);
let runState = { status: 'idle', exitCode: null };
const logs = { appium: '', run: '' };
const log = (kind, text) => { logs[kind] = (logs[kind] + stripVTControlCharacters(text)).slice(-200000); };

async function appiumStatus() {
  if (stopping) return 'stopping';
  try {
    const response = await fetch('http://127.0.0.1:4723/status', { signal: AbortSignal.timeout(1200) });
    const data = await response.json();
    if (response.ok && data.value?.build?.version && data.value?.ready === true) return 'ready';
    return 'unavailable';
  } catch { return appium ? 'starting' : 'offline'; }
}

function launch(kind, args) {
  const child = spawn(process.execPath, args, { detached: process.platform !== 'win32', cwd: root, env: { ...process.env, AUTOMATION_PROGRESS: kind === 'run' ? '1' : '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
    else { run = null; runState = { status: child.userStopped ? 'STOPPED' : code === 0 ? 'PASS' : code === 1 ? 'FAIL' : 'ERROR', exitCode: code }; }
  });
  return child;
}

/** หยุด process group ของ Dashboard เพื่อรวม process ลูก ไม่แตะโปรแกรมอื่น */
async function stopOwned(child) {
  if (!child?.pid) return;
  const pid = process.platform === 'win32' ? child.pid : -child.pid;
  const exists = () => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
  if (!exists()) return;
  process.kill(pid, 'SIGTERM');
  for (let i = 0; i < 50 && exists(); i++) await new Promise(resolve => setTimeout(resolve, 100));
  if (exists()) process.kill(pid, 'SIGKILL');
}

/** Appium ที่เปิดจาก Terminal ใช้ได้เช่นกัน แต่ต้องเป็น Appium ของ user ปัจจุบัน */
async function stopExternalAppium() {
  let output;
  try { output = (await exec('/usr/sbin/lsof', ['-nP', '-t', '-iTCP:4723', '-sTCP:LISTEN'])).stdout; }
  catch (error) { if (error.code === 1 && !error.stdout) return; throw error; }
  for (const pid of [...new Set(output.trim().split(/\s+/).filter(Boolean))]) {
    const inspect = async () => (await exec('/bin/ps', ['-p', pid, '-o', 'uid=', '-o', 'command='])).stdout.trim();
    const identity = await inspect();
    const match = identity.match(/^(\d+)\s+(.+)$/);
    if (!match || Number(match[1]) !== process.getuid() || !/(^|[ /])appium([ /]|$)/.test(match[2])) throw new Error('พอร์ต 4723 ไม่ใช่ Appium ของผู้ใช้ปัจจุบัน จึงไม่ปิด process นี้');
    process.kill(Number(pid), 'SIGTERM');
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      try { if (await inspect() !== identity) break; }
      catch (error) { if (error.code === 1) break; throw error; }
      if (i === 49) process.kill(Number(pid), 'SIGKILL');
    }
  }
}

async function stopAll() {
  stopping = true;
  const hadRun = !!run;
  try {
    log('run', 'ผู้ใช้สั่งปิด Appium และหยุดการทำงาน\n');
    if (run) run.userStopped = true;
    await stopOwned(run);
    await stopOwned(appium);
    await stopExternalAppium();
    if (hadRun) runState = { status: 'STOPPED', exitCode: null };
    log('appium', 'ปิด Appium แล้ว\n');
  } finally { stopping = false; }
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
    const validated = await loadTestCaseConfig(temporary, caseRegistry);
    await writeFile(temporary, JSON.stringify(validated, null, 2) + '\n', { mode: 0o600 });
    selectDeviceConfig(config.platform);
    await rename(temporary, configPath);
  } finally { await rm(temporary, { force: true }); }
}

async function resultFile(runName, file) {
  if (!runName || runName.includes('/') || runName.includes('\\') || !['report.html', 'report.xlsx', 'result.json', 'journal.jsonl'].includes(file)) throw new Error('Invalid result path');
  const resultsRoot = await realpath(join(root, 'Results'));
  const target = await realpath(join(resultsRoot, runName, file));
  if (!target.startsWith(resultsRoot + '/')) throw new Error('Invalid result path');
  return target;
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
      const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
      const page = html.replace(/\{\{web\.(\w+)\}\}/g, (_, key) => {
        if (!Object.hasOwn(webLocalized, key)) throw new Error(`Missing web localized key: ${key}`);
        return escape(webLocalized[key]);
      });
      return res.end(page.replace('__TOKEN__', token).replace('__WEB_LOCALIZED__', JSON.stringify(webLocalized).replace(/</g, '\\u003c')));
    }
    const modules = { '/Shared/additional-data.mjs': '../Shared/additional-data.mjs', '/Dashboard/schema-form.mjs': './schema-form.mjs' };
    if (req.method === 'GET' && Object.hasOwn(modules, req.url)) {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      return res.end(await readFile(new URL(modules[req.url], import.meta.url)));
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
      return json(200, { config, cases, schemas: Object.fromEntries(caseSchemas) });
    }
    const url = new URL(req.url, origin);
    if (req.method === 'GET' && url.pathname === '/api/device') {
      const platform = url.searchParams.get('platform');
      const path = selectDeviceConfig(platform);
      let config;
      try { config = JSON.parse(await readFile(path, 'utf8')); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        config = JSON.parse(await readFile(join(root, 'Config/Examples', platform === 'iOS' ? 'DeviceConfig.ios.json' : 'DeviceConfig.android.json'), 'utf8'));
      }
      return json(200, { config });
    }
    if (req.method === 'GET' && url.pathname === '/api/results') {
      const results = [];
      for (const entry of await readdir(join(root, 'Results'), { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        try {
          const value = JSON.parse(await readFile(await resultFile(entry.name, 'result.json'), 'utf8'));
          results.push({ folder: entry.name, runName: value.runName, status: value.status, startedAt: value.startedAt });
        } catch { /* incomplete runs do not have a final report yet */ }
      }
      results.sort((a,b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
      return json(200, { results });
    }
    if (req.method === 'GET' && url.pathname === '/api/results/file') {
      const file = url.searchParams.get('file');
      const content = await readFile(await resultFile(url.searchParams.get('run'), file));
      res.writeHead(200, { 'Content-Type': file === 'report.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' });
      return res.end(content);
    }
    if (req.method === 'GET' && req.url === '/api/status') return json(200, { appium: await appiumStatus(), run: runState, logs });
    if (req.method === 'POST' && req.url === '/api/appium/stop') {
      if (stopping || busy) return json(409, { error: webLocalized.working });
      await stopAll();
      return json(200, { message: webLocalized.stoppedAll });
    }
    if (req.method !== 'POST' || !['/api/config', '/api/device', '/api/appium/start', '/api/run/start'].includes(req.url)) return json(404, { error: 'Not found' });
    if (busy || run || stopping) return json(409, { error: webLocalized.busy });
    busy = true;
    try {
      if (req.url === '/api/device') {
        const config = await body(req);
        const path = selectDeviceConfig(config.platform);
        const temp = `${path}.${randomBytes(6).toString('hex')}.tmp`;
        await mkdir(join(root, 'Config/Local'), { recursive: true });
        try {
          await writeFile(temp, JSON.stringify(config, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
          await loadDeviceConfig(temp);
          const identity = config.platform === 'iOS' ? config.app.bundleId : config.app.appPackage;
          if (typeof identity !== 'string' || !identity.trim() || identity.includes('REPLACE_WITH_')) throw new Error('กรุณาระบุ Bundle ID / App Package สำหรับเปิดแอปหลังจบเคส');
          await rename(temp, path);
        } finally { await rm(temp, { force: true }); }
        return json(200, { message: webLocalized.savedDevice });
      }
      if (req.url === '/api/config') { await saveConfig(await body(req)); return json(200, { message: webLocalized.savedConfig }); }
      if (req.url === '/api/appium/start') {
        if (await appiumStatus() === 'ready') return json(200, { message: webLocalized.alreadyReady });
        if (appium) return json(200, { message: webLocalized.opening });
        appium = launch('appium', ['node_modules/appium/build/lib/main.js', '--address', '127.0.0.1', '--port', '4723']);
        return json(200, { message: webLocalized.opening });
      }
      if (await appiumStatus() !== 'ready') return json(409, { error: webLocalized.needAppium });
      const config = await loadTestCaseConfig(configPath, caseRegistry);
      const device = await loadDeviceConfig(selectDeviceConfig(config.platform));
      if (device.config.platform !== config.platform) throw new Error('Device Config platform ไม่ตรงกัน');
      runState = { status: 'running', exitCode: null };
      run = launch('run', ['MainManager/run.mjs']);
      return json(200, { message: webLocalized.startedRun });
    } finally { busy = false; }
  } catch (error) { json(400, { error: error.message }); }
});
server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(3000) });
      const html = await response.text();
      if (!response.ok || !html.includes('<title>Automation Dashboard</title>') || !/const token='[a-f0-9]{64}'/.test(html)) {
        throw new Error('Port is occupied by another service');
      }
      console.log(`Dashboard เปิดอยู่แล้ว กำลังเปิดหน้าเว็บ: ${origin}`);
      if (process.platform === 'darwin' && process.env.DASHBOARD_NO_OPEN !== '1') {
        spawn('open', [origin], { stdio: 'ignore' }).on('error', openError => {
          console.error(`เปิด Browser ไม่สำเร็จ กรุณาเปิด ${origin}: ${openError.message}`);
          process.exitCode = 1;
        });
      }
      return;
    } catch {
      console.error(`พอร์ต ${port} ถูกใช้งาน แต่ตรวจไม่พบ Automation Dashboard กรุณาตรวจโปรแกรมที่ใช้พอร์ตนี้`);
      process.exitCode = 1;
      return;
    }
  }
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Dashboard: ${origin}\nKeep this window open. Control+C closes dashboard and its child processes.`);
  if (process.platform === 'darwin' && process.env.DASHBOARD_NO_OPEN !== '1') spawn('open', [origin], { stdio: 'ignore' }).on('error', () => {});
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  run?.kill('SIGTERM'); appium?.kill('SIGTERM'); server.close();
  setTimeout(() => process.exit(0), 2000).unref();
});
