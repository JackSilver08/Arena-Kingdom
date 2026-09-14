/** Markup that has already been escaped or is trusted. */
export class SafeHtml {
  constructor(readonly value: string) {}
  toString() {
    return this.value;
  }
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: unknown) {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  return escapeHtml(value);
}

/** Tagged template that escapes every interpolated value unless it is SafeHtml. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += renderValue(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

/** Wraps markup the app itself generated (e.g. built-in SVG art). Never pass user input. */
export function trusted(markup: string) {
  return new SafeHtml(markup);
}

export function setHtml(element: Element, content: SafeHtml) {
  element.innerHTML = content.value;
}

export function $<T extends Element = HTMLElement>(root: ParentNode, selector: string) {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}
