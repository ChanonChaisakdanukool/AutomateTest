const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const get = (root, path) => path.split('.').reduce((value, key) => value?.[key], root);
export function matches(condition, root) {
  if (!condition) return true;
  if (condition.all) return condition.all.every(item => matches(item, root));
  if (condition.any) return condition.any.some(item => matches(item, root));
  return Object.is(get(root, condition.field), condition.equals);
}

/** ใช้ทั้ง Browser และ Node: คืนสำเนาและล้างค่าฟิลด์ที่ไม่เข้าเงื่อนไข */
export function normalizeAdditionalData(schema, data = {}, { validate = true } = {}) {
  if (!object(data)) throw new TypeError('additionalData must be an object');
  const output = structuredClone(data);
  function prune(fields, value) {
    let changed = false;
    for (const [key, field] of Object.entries(fields)) {
      if (!matches(field.visibleWhen, output)) { if (Object.hasOwn(value, key)) { delete value[key]; changed = true; } }
      else {
        if (value[key] === undefined && Object.hasOwn(field, 'default') && matches(field.defaultWhen, output)) { value[key] = structuredClone(field.default); changed = true; }
        if (field.type === 'object' && object(value[key])) changed = prune(field.fields ?? {}, value[key]) || changed;
      }
    }
    return changed;
  }
  // Repeat so dependent fields are cleared even when schema keys are in a different order.
  for (let i = 0; prune(schema, output); i++) if (i > 100) throw new Error('Schema conditions did not settle');
  function check(fields, value, prefix = '') {
    for (const key of Object.keys(value)) if (!Object.hasOwn(fields, key)) throw new TypeError(`Unknown additionalData field: ${prefix}${key}`);
    for (const [key, field] of Object.entries(fields)) {
      if (!matches(field.visibleWhen, output)) continue;
      const item = value[key], path = prefix + key;
      const required = field.required === true || (field.requiredWhen && matches(field.requiredWhen, output));
      if (item === undefined) { if (required) throw new TypeError(`${path} is required`); continue; }
      if (field.type === 'object') {
        if (!object(item)) throw new TypeError(`${path} must be an object`);
        check(field.fields ?? {}, item, path + '.');
      } else if (field.type === 'enum') {
        if (!(field.options ?? []).some(option => Object.is(option.value, item))) throw new TypeError(`${path} has an invalid enum value`);
      } else if (!['string', 'number', 'boolean'].includes(field.type) || typeof item !== field.type || (field.type === 'number' && !Number.isFinite(item))) {
        throw new TypeError(`${path} must be ${field.type}`);
      }
      if (typeof item === 'string') {
        if (field.minLength !== undefined && item.length < field.minLength) throw new TypeError(`${path} is too short`);
        if (field.maxLength !== undefined && item.length > field.maxLength) throw new TypeError(`${path} is too long`);
        if (field.pattern && !new RegExp(field.pattern).test(item)) throw new TypeError(`${path} has an invalid format`);
      }
      if (required && typeof item === 'string' && !item.trim()) throw new TypeError(`${path} is required`);
    }
  }
  if (validate) check(schema, output);
  return output;
}
