import { CoreError } from '../Core/index.mjs';

export function classifyFailure(error) {
  return error instanceof CoreError && error.code === 'ASSERTION_MISMATCH' ? 'FAIL' : 'ERROR';
}

/** แต่ละ execution เป็นเจ้าของ Step History; ไม่มี retry และไม่บันทึกค่าที่กรอก/return value */
export function createJourney({ steps = [], context = {}, onEvent = async () => {} } = {}) {
  let active = false;
  let stopped = false;
  async function run(plan) {
    if (active || stopped) throw new Error('Journey cannot run concurrently or continue after a failed step.');
    if (!Array.isArray(plan) || !plan.length) throw new TypeError('Journey requires a non-empty step plan.');
    const ids = new Set(steps.map(step => step.stepId));
    for (const item of plan) {
      if (!item || typeof item.id !== 'string' || !item.id.trim() || typeof item.name !== 'string' || !item.name.trim() || typeof item.action !== 'function' || ids.has(item.id)) {
        throw new TypeError('Each step requires a unique id, name and action function.');
      }
      ids.add(item.id);
    }
    const records = plan.map(item => ({ stepIndex: steps.length + 1 + plan.indexOf(item), stepId: item.id, stepName: item.name, status: 'SKIPPED' }));
    steps.push(...records);
    active = true;
    try {
      for (const [index, item] of plan.entries()) {
        const record = records[index];
        record.status = 'RUNNING';
        record.startedAt = new Date().toISOString();
        const start = performance.now();
        let failure;
        try {
          await onEvent({ event: 'stepStarted', ...context, step: { ...record } });
          await item.action();
          record.status = 'PASS';
        } catch (error) {
          failure = error;
          stopped = true;
          record.status = classifyFailure(error);
          record.error = { name: error?.name ?? 'Error', code: error?.code, message: error?.message ?? String(error) };
        }
        record.finishedAt = new Date().toISOString();
        record.durationMs = Math.round(performance.now() - start);
        try { await onEvent({ event: 'stepFinished', ...context, step: structuredClone(record) }); }
        catch (error) { stopped = true; if (!failure) throw error; }
        if (failure) throw failure;
      }
    } finally { active = false; }
  }
  return { run };
}
