import { matches, normalizeAdditionalData } from '../Shared/additional-data.mjs';

/** Renderer กลาง ไม่ผูกเงื่อนไขกับ Case ID; enum ใช้ index เพื่อคงชนิด value เดิม */
export function renderSchemaForm(container, schema, data, onChange, labels) {
  container.replaceChildren();
  function fields(definitions, value, root) {
    const fragment = document.createDocumentFragment();
    for (const [key, field] of Object.entries(definitions)) {
      if (!matches(field.visibleWhen, root)) continue;
      if (field.type === 'object') {
        const group = document.createElement('fieldset'); group.className = 'schema-group'; const title = document.createElement('legend'); title.textContent = field.label ?? key; group.append(title);
        // Editing a nested field materializes the object only when needed.
        const nested = value[key] ?? {};
        group.append(fields(field.fields ?? {}, nested, root));
        group.addEventListener('input', () => { value[key] = nested; });
        fragment.append(group); continue;
      }
      const label = document.createElement('label');
      label.className = field.visibleWhen ? 'schema-field schema-field-child' : 'schema-field';
      const title = document.createElement('span'); title.textContent = field.label ?? key; label.append(title);
      const choice = field.type === 'enum' || field.type === 'boolean';
      const input = document.createElement(choice ? 'select' : 'input');
      input.required = field.required === true || !!(field.requiredWhen && matches(field.requiredWhen, root));
      if (choice) {
        const options = field.type === 'boolean' ? [{ value: true, label: 'true' }, { value: false, label: 'false' }] : field.options;
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = labels.unspecified; input.append(empty);
        options.forEach((option, index) => { const element = document.createElement('option'); element.value = String(index); element.textContent = option.label; input.append(element); });
        const index = options.findIndex(option => Object.is(option.value, value[key])); input.value = index < 0 ? '' : String(index);
        input.onchange = () => {
          if (input.value === '') delete value[key]; else value[key] = options[Number(input.value)].value;
          for (const [dependentKey, dependent] of Object.entries(definitions)) {
            if (dependent.resetOnChange === key) delete value[dependentKey];
          }
          // Materialize ancestors before normalization and redraw.
          input.dispatchEvent(new Event('input', { bubbles: true }));
          onChange(normalizeAdditionalData(schema, data, { validate: false }));
        };
      } else {
        input.type = field.masked ? 'password' : field.type === 'number' ? 'number' : 'text';
        if (field.type === 'number') input.step = 'any';
        input.value = value[key] ?? '';
        if (field.minLength !== undefined) input.minLength = field.minLength;
        if (field.maxLength !== undefined) input.maxLength = field.maxLength;
        if (field.pattern) input.pattern = field.pattern;
        input.oninput = () => {
          if (input.value === '' && !input.required) delete value[key];
          else value[key] = field.type === 'number' ? input.value === '' ? undefined : Number(input.value) : input.value;
        };
      }
      label.append(input); fragment.append(label);
    }
    return fragment;
  }
  container.append(fields(schema, data, data));
}
