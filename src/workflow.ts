import type { Inputs, PageState, Parameter, ParameterBinding, Scalar, Trace, ValueBinding, Workflow } from './types';

const NAME = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
const reserved = new Set(['constructor', 'prototype', '__proto__']);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function bindText(text: string, inputs: Inputs): string {
  return text.replace(/\{\{([a-zA-Z][a-zA-Z0-9_]*)(\|url|\|lowerurl)?\}\}/g, (_, key: string, format: string) => {
    if (!Object.hasOwn(inputs, key)) throw new Error(`Missing input: ${key}`);
    const value = String(inputs[key]);
    return format ? encodeURIComponent(format === '|lowerurl' ? value.toLowerCase() : value) : value;
  });
}
export function bindState(state: PageState, inputs: Inputs): PageState {
  return { path: bindText(state.path, inputs), headings: state.headings.map(s => bindText(s, inputs)), dialogs: state.dialogs.map(s => bindText(s, inputs)), notices: state.notices.map(s => bindText(s, inputs)) };
}
export function resolveValue(binding: ValueBinding | undefined, inputs: Inputs): Scalar | undefined {
  if (!binding) return undefined;
  if (binding.parameter) {
    if (!Object.hasOwn(inputs, binding.parameter)) throw new Error(`Missing input: ${binding.parameter}`);
    return inputs[binding.parameter];
  }
  return binding.literal;
}

export function validateInputs(workflow: Workflow, raw: unknown): Inputs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Workflow inputs must be an object.');
  const source = raw as Record<string, unknown>;
  const known = new Set(workflow.parameters.map(p => p.name));
  if (Object.keys(source).some(k => !known.has(k))) throw new Error('Unknown workflow input.');
  const inputs: Inputs = {};
  for (const p of workflow.parameters) {
    const value = source[p.name];
    if (!Object.hasOwn(source, p.name) || typeof value !== p.type) throw new Error(`${p.name} must be a ${p.type}.`);
    if (typeof value === 'string' && (value.length === 0 || value.length > 500)) throw new Error(`${p.name} must contain 1–500 characters.`);
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${p.name} must be a finite number.`);
    inputs[p.name] = value as Scalar;
  }
  return inputs;
}

export function compileTrace(trace: Trace, rawName: string, bindings: ParameterBinding[]): Workflow {
  const name = rawName.trim();
  if (trace.recording) throw new Error('Finish teaching before compiling.');
  if (!name || name.length > 80) throw new Error('Give the workflow a name of 1–80 characters.');
  if (!trace.actions.length) throw new Error('No actions captured. Teach a task first.');
  if (trace.actions.length > 60) throw new Error('Keep the demonstration under 60 actions.');
  if (trace.warning) throw new Error(`This recording needs to be retaught: ${trace.warning}`);
  if (!Array.isArray(bindings) || bindings.length > 30) throw new Error('Too many parameters.');
  const byAction = new Map<string, ParameterBinding>();
  const params = new Map<string, Parameter>();
  for (const b of bindings) {
    if (!b || !NAME.test(b.name) || reserved.has(b.name)) throw new Error('Parameter names must start with a letter and contain only letters, digits or underscores.');
    const action = trace.actions.find(a => a.id === b.actionId);
    if (!action || action.value === undefined || action.kind === 'click' || action.kind === 'submit') throw new Error('Only captured field values can become inputs.');
    if (byAction.has(b.actionId)) throw new Error('A field action has more than one parameter binding.');
    if (!['string', 'number', 'boolean'].includes(b.type)) throw new Error('Unsupported parameter type.');
    if (String(action.value) !== String(b.example)) throw new Error('Keep the recorded example unchanged; edit values when running the workflow.');
    let example: Scalar = action.value;
    if (b.type === 'number') {
      if (String(example).trim() === '' || !Number.isFinite(Number(example))) throw new Error(`${b.name} has no numeric example.`);
      example = Number(example);
    } else if (b.type === 'boolean') {
      if (typeof example !== 'boolean') throw new Error(`${b.name} is not a checkbox value.`);
    } else example = String(example);
    if (typeof example === 'string' && !example.length) throw new Error('An empty example cannot become a parameter.');
    const existing = params.get(b.name);
    if (existing && (existing.type !== b.type || existing.example !== example)) throw new Error(`Parameter ${b.name} has conflicting examples.`);
    if ([...params.values()].some(p => p.name !== b.name && String(p.example) === String(example))) throw new Error('Fields with the same example must share a parameter name, or remain fixed.');
    params.set(b.name, { name: b.name, type: b.type, example });
    byAction.set(b.actionId, { ...b, example });
  }
  const parameters = [...params.values()];
  // Replace observed literals in targets AND checks. A single pass avoids reinterpreting inserted bindings.
  function template(text: string, path = false): string {
    if (text.includes('{{')) throw new Error('Literal double-brace text is unsupported in this small demo compiler.');
    const candidates = parameters.filter(p => typeof p.example !== 'boolean').flatMap(p => {
      const value = String(p.example);
      return path ? [{ p, value: encodeURIComponent(value), format: '|url' }, ...(value.toLowerCase() !== value ? [{ p, value: encodeURIComponent(value.toLowerCase()), format: '|lowerurl' }] : [])] : [{ p, value, format: '' }];
    }).sort((a, b) => b.value.length - a.value.length);
    if (!candidates.length) return text;
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${candidates.map(c => escape(c.value)).join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
    return text.replace(re, value => {
      const match = candidates.find(c => c.value === value)!;
      return `{{${match.p.name}${match.format}}}`;
    });
  }
  const state = (s: PageState): PageState => ({ path: template(s.path, true), headings: s.headings.map(t => template(t)), dialogs: s.dialogs.map(t => template(t)), notices: s.notices.map(t => template(t)) });
  const id = crypto.randomUUID();
  return {
    id, name, toolName: `workflow_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 32)}_${id.slice(0, 8)}`,
    origin: trace.origin, startPath: template(trace.startPath, true), parameters, createdAt: Date.now(),
    steps: trace.actions.map(a => ({
      id: a.id, kind: a.kind,
      target: { ...a.target, name: template(a.target.name), context: a.target.context ? template(a.target.context) : undefined },
      value: a.value === undefined ? undefined : byAction.has(a.id) ? { parameter: byAction.get(a.id)!.name } : { literal: a.value },
      before: state(a.before), after: a.after ? state(a.after) : undefined
    }))
  };
}
