import type { ActionKind, PageState, Scalar, Target } from './types';

const CONTROL = 'button, a[href], input, textarea, select, form';
const SENSITIVE = /\b(?:password|passcode|pin|otp|one[ -]?time|(?:verification|security|authentication|recovery)[ -]?code|two[ -]?factor|credit[ -]?card|card[ -]?(?:number|holder)|cc[ -](?:name|number|exp|csc|type|given|family)|cvv|cvc|payment|bank[ -]?account|routing[ -]?number|iban|expir(?:y|ation)|social[ -]?security|ssn|secret|token|(?:api|access|private)[ -]?key)\b/i;
const TEXT_TYPES = new Set(['text', 'search', 'number', 'email', 'url', 'tel', 'date', 'time', 'datetime-local', 'month', 'week']);
export type Control = HTMLButtonElement | HTMLAnchorElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLFormElement;

export function cleanText(value: string, limit = 160): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_+\/-]{32,}={0,2}\b/g, '[redacted]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[redacted]').slice(0, limit);
}
function visible(element: Element): boolean {
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) !== 0 && element.getClientRects().length > 0;
}
function textOf(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const chunks: string[] = [];
  while (walker.nextNode() && chunks.join(' ').length < 500) {
    const parent = walker.currentNode.parentElement;
    if (parent && !parent.closest('input, textarea, select, script, style, [hidden], [aria-hidden="true"]') && visible(parent)) chunks.push(walker.currentNode.textContent || '');
  }
  return cleanText(chunks.join(' '));
}
function named(element: Element): string {
  const aria = element.getAttribute('aria-label');
  if (aria) return cleanText(aria);
  const refs = element.getAttribute('aria-labelledby');
  if (refs) return cleanText(refs.split(/\s+/).map(id => { const node = document.getElementById(id); return node && visible(node) ? textOf(node) : ''; }).join(' '));
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    const labels = Array.from(element.labels || []).map(textOf).join(' ');
    if (labels) return cleanText(labels);
    if (element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type)) return cleanText(element.value);
    return '';
  }
  if (element instanceof HTMLFormElement) {
    const submit = element.querySelector('button:not([type]), button[type="submit"], input[type="submit"]');
    return submit ? named(submit) : '';
  }
  return textOf(element);
}
function contextOf(element: Element): string | undefined {
  const group = element.parentElement?.closest('dialog, [role="dialog"], fieldset, form, section, article');
  if (!group) return undefined;
  const heading = group.querySelector('legend, h1, h2, h3, [role="heading"]');
  const context = group.getAttribute('aria-label') || (heading ? textOf(heading) : '');
  return context ? cleanText(context) : undefined;
}
export function sensitive(element: Element): boolean {
  const metadata = ['name', 'id', 'type', 'autocomplete', 'placeholder', 'aria-label'].map(key => element.getAttribute(key) || '').join(' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  if (SENSITIVE.test(metadata + ' ' + named(element) + ' ' + (contextOf(element) || ''))) return true;
  if (element instanceof HTMLInputElement && !TEXT_TYPES.has(element.type) && !['checkbox', 'button', 'submit', 'reset'].includes(element.type)) return true;
  // A site's hidden CSRF field is not something we read or fill. Its presence
  // should not block an otherwise ordinary, explicitly approved form submit.
  return element instanceof HTMLFormElement && Array.from(element.querySelectorAll('input, textarea, select')).some(control => visible(control) && sensitive(control));
}
export function controlFor(node: EventTarget | null): Control | null {
  const element = node instanceof Element ? node.closest(CONTROL) : null;
  return element instanceof HTMLElement && !sensitive(element) ? element as Control : null;
}
export function targetOf(element: Control): Target | null {
  if (!visible(element) || sensitive(element)) return null;
  let role: string;
  if (element instanceof HTMLInputElement) role = element.type === 'checkbox' ? 'checkbox' : ['button', 'submit', 'reset'].includes(element.type) ? 'button' : 'textbox';
  else role = element instanceof HTMLButtonElement ? 'button' : element instanceof HTMLAnchorElement ? 'link' : element instanceof HTMLSelectElement ? 'combobox' : element instanceof HTMLFormElement ? 'form' : 'textbox';
  const name = named(element);
  if (!name || SENSITIVE.test(name)) return null;
  return { tag: element.tagName.toLowerCase(), role, name, context: contextOf(element), ...(element instanceof HTMLInputElement ? { inputType: element.type } : {}) };
}
export function valueOf(element: Control): Scalar | undefined {
  if (sensitive(element)) return undefined;
  if (element instanceof HTMLInputElement && element.type === 'checkbox') return element.checked;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    const value = element.value;
    if (value.length > 500 || SENSITIVE.test(value) || /\b(?:\d[ -]?){13,19}\b|\b[A-Za-z0-9_+\/-]{32,}={0,2}\b/.test(value)) return undefined;
    return value;
  }
  return undefined;
}
export function pageState(): PageState {
  const texts = (selector: string, labelsOnly = false) => Array.from(document.querySelectorAll(selector)).filter(visible).map(element => {
    const label = labelsOnly ? element.getAttribute('aria-label') || textOf(element.querySelector('h1, h2, h3, [role="heading"]') || element) : textOf(element);
    return SENSITIVE.test(label) ? '[sensitive content omitted]' : cleanText(label);
  }).filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).slice(0, 6);
  return { path: location.pathname.slice(0, 300), headings: texts('h1, h2, [role="heading"]'), dialogs: texts('dialog[open], [role="dialog"]', true), notices: texts('[role="status"], [role="alert"], [aria-live="polite"], [aria-live="assertive"]') };
}
export function describeControls(): Target[] {
  return Array.from(document.querySelectorAll(CONTROL)).map(element => targetOf(element as Control)).filter((target): target is Target => !!target).slice(0, 40);
}
export function resolveTarget(target: Target): Control {
  const matches = Array.from(document.querySelectorAll(CONTROL)).filter(element => {
    const candidate = targetOf(element as Control);
    return candidate && candidate.tag === target.tag && candidate.role === target.role && candidate.name === target.name && candidate.context === target.context && candidate.inputType === target.inputType;
  }) as Control[];
  if (matches.length !== 1) throw new Error(matches.length ? 'Target is ambiguous; more than one control matches.' : 'Target is missing, hidden, unlabeled, or excluded.');
  return matches[0]!;
}
export function actionable(element: Control): void {
  if (!element.isConnected || !visible(element) || sensitive(element) || element.matches(':disabled, [aria-disabled="true"]') || element.closest('[aria-disabled="true"]')) throw new Error('Target is hidden, disabled, or excluded.');
  if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.readOnly) throw new Error('Target is read-only.');
  const hitTarget = element instanceof HTMLFormElement ? element.querySelector<HTMLElement>('button:not([type]), button[type="submit"], input[type="submit"]') : element;
  if (!hitTarget) throw new Error('Form has no supported submit control.');
  hitTarget.scrollIntoView({ block: 'center', inline: 'center' });
  if (!hitTarget.isConnected || !visible(hitTarget) || hitTarget.matches(':disabled') || hitTarget.closest('[aria-disabled="true"]')) throw new Error('Target changed or became unavailable.');
  const rect = hitTarget.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  if (!hit || (hit !== hitTarget && !hitTarget.contains(hit))) throw new Error('Target is covered by another element.');
}
export function perform(element: Control, kind: ActionKind, value?: Scalar, verifyContext: () => void = () => {}): void {
  actionable(element);
  verifyContext();
  if (kind === 'fill' || kind === 'select') {
    const allowed = kind === 'select' ? element instanceof HTMLSelectElement : element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement && TEXT_TYPES.has(element.type);
    if (!allowed || typeof value === 'boolean' || value === undefined) throw new Error('Action and value do not match the control.');
    const text = String(value);
    if (element instanceof HTMLSelectElement && !Array.from(element.options).some(option => option.value === text && !option.disabled && !option.parentElement?.matches('optgroup:disabled'))) throw new Error('Requested option is unavailable.');
    element.focus();
    actionable(element);
    verifyContext();
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, text);
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  } else if (kind === 'check') {
    if (!(element instanceof HTMLInputElement) || element.type !== 'checkbox' || typeof value !== 'boolean') throw new Error('Expected a checkbox and boolean value.');
    if (element.checked !== value) element.click();
  } else if (kind === 'submit') {
    if (!(element instanceof HTMLFormElement) || !element.checkValidity()) throw new Error('Form is invalid or unavailable.');
    const submitter = element.querySelector<HTMLButtonElement | HTMLInputElement>('button:not([type]), button[type="submit"], input[type="submit"]');
    if (!submitter) throw new Error('Form has no supported submit control.');
    verifyContext();
    element.requestSubmit(submitter);
  } else {
    if (!(element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement || element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type))) throw new Error('Click requires a native button or link.');
    if (element instanceof HTMLAnchorElement && (!['http:', 'https:'].includes(new URL(element.href).protocol) || new URL(element.href).origin !== location.origin || element.target && element.target !== '_self' || element.hasAttribute('download'))) throw new Error('Links must stay in this tab and origin.');
    if ((element instanceof HTMLButtonElement || element instanceof HTMLInputElement) && element.type === 'submit' && element.form && sensitive(element.form)) throw new Error('Forms containing sensitive fields are excluded.');
    element.click();
  }
}
export function changedState(before: PageState, after?: PageState): boolean {
  return !!after && (before.path !== after.path || (['headings', 'dialogs', 'notices'] as const).some(key => before[key].join('\n') !== after[key].join('\n')));
}
export function stateMatchesDelta(before: PageState, after: PageState, current: PageState): boolean {
  if (before.path !== after.path && current.path !== after.path) return false;
  return (['headings', 'dialogs', 'notices'] as const).every(key => {
    const added = after[key].filter(value => !before[key].includes(value));
    const removed = before[key].filter(value => !after[key].includes(value));
    return added.every(value => current[key].includes(value)) && removed.every(value => !current[key].includes(value));
  });
}
