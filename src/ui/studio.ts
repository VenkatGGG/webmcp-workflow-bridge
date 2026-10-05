import type { BridgeState, CapturedAction, Inputs, PageState, ParameterBinding, Workflow, WorkflowStep } from '../types';
import { EMPTY_STATE } from '../types';
import { button, el, empty, field, notice, runtime, time, watchState } from './common';

let state: BridgeState = EMPTY_STATE;
let selectedId = '';
let traceId = '';
let workflowName = '';
let captureKey = '', libraryKey = '', runKey = '';
const bindingDrafts = new Map<string, { enabled: boolean; name: string; type: ParameterBinding['type'] }>();
const inputDrafts = new Map<string, Record<string, string | boolean>>();
const tabDrafts = new Map<string, number>();
const section = (id: string) => document.getElementById(id)!;
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 45) || 'value';
const heading = (step: number, text: string) => { const h = el('h2'); h.append(el('span', String(step).padStart(2, '0'), 'section-number'), document.createTextNode(text)); return h; };
function sideEffect(kind: WorkflowStep['kind']): string {
  return { fill: 'Changes a field value.', select: 'Changes a selected option.', check: 'Changes a checkbox.', click: 'Activates a control; may change application data.', submit: 'Submits a form; may save or send data.' }[kind];
}
function stateCard(label: string, page?: PageState): HTMLElement {
  const box = el('div', '', 'state-card'); box.append(el('span', label, 'eyebrow'));
  if (!page) box.append(el('p', 'No observed result recorded.', 'muted'));
  else {
    box.append(el('code', page.path));
    if (page.headings.length) box.append(el('p', page.headings.join(' · ')));
    if (page.dialogs.length) box.append(el('p', `Dialogs: ${page.dialogs.join(' · ')}`, 'small'));
    if (page.notices.length) box.append(el('p', `Notices: ${page.notices.join(' · ')}`, 'small'));
  }
  return box;
}
function graph(before: PageState, after?: PageState): HTMLElement {
  const row = el('div', '', 'state-graph');
  const arrow = el('span', '→', 'graph-arrow'); arrow.setAttribute('aria-label', 'then');
  row.append(stateCard('Before', before), arrow, stateCard('Observed after', after)); return row;
}
function resolved(text: string, inputs?: Inputs): string {
  return inputs ? text.replace(/\{\{([a-zA-Z0-9_]+)(\|url|\|lowerurl)?\}\}/g, (whole, key: string, url: string | undefined) => key in inputs ? (url ? encodeURIComponent(url === '|lowerurl' ? String(inputs[key]).toLowerCase() : String(inputs[key])) : String(inputs[key])) : whole) : text;
}
function stepsList(steps: WorkflowStep[], inputs?: Inputs): HTMLElement {
  const list = el('ol', '', 'steps');
  for (const step of steps) {
    const item = el('li');
    item.append(el('h3', `${step.kind} · ${resolved(step.target.name || step.target.tag, inputs)}`));
    if (step.target.context) item.append(el('p', `Within: ${resolved(step.target.context, inputs)}`, 'small muted'));
    if (step.value) item.append(el('code', `Value: ${step.value.parameter ? (inputs ? String(inputs[step.value.parameter]) : `{{${step.value.parameter}}}`) : String(step.value.literal)}`));
    item.append(el('p', sideEffect(step.kind), 'small muted'), graph(step.before, step.after)); list.append(item);
  }
  return list;
}
function renderCapability(): void {
  const node = section('capability'); node.replaceChildren();
  const title = el('div', '', 'section-title'); title.append(el('h2', 'Connected pages'), el('span', `${state.enabled.length} enabled`, 'pill')); node.append(title);
  if (!state.enabled.length) node.append(el('p', 'Open the extension on a website and choose Enable this tab. Then choose Teach task and demonstrate the task.', 'muted'));
  for (const tab of state.enabled) {
    const row = el('div', '', 'connected-page');
    const receipt = state.receipts.filter(item => item.origin === tab.origin).sort((a, b) => b.at - a.at)[0];
    const detail = el('div'); detail.append(el('strong', tab.title || tab.origin), el('p', `${tab.origin} · Tab ${tab.tabId}`, 'small muted'));
    const status = el('div'); status.append(el('span', tab.nativeAvailable ? 'Native tools registered' : 'Native tools unavailable', tab.nativeAvailable ? 'badge' : 'badge neutral'), el('p', receipt ? `Diagnostic receipt ${time(receipt.at)}` : 'No diagnostic receipt yet', 'small muted'));
    if (receipt) status.append(el('code', receipt.id));
    row.append(detail, status); node.append(row);
  }
  node.append(el('p', 'Native API availability and diagnostic receipts do not prove Gemini compatibility. Native workflow calls appear below as proposals for your approval.', 'small muted'));
}
function parameterReview(action: CapturedAction): HTMLElement {
  let draft = bindingDrafts.get(action.id);
  if (!draft) { draft = { enabled: false, name: slug(action.target.name), type: typeof action.value as ParameterBinding['type'] }; bindingDrafts.set(action.id, draft); }
  const box = el('div', '', 'parameter-review');
  const toggle = el('input'); toggle.type = 'checkbox'; toggle.checked = draft.enabled;
  const choice = field('Make this value an input', toggle); choice.className = 'check-field'; box.append(choice);
  const controls = el('div', '', 'parameter-fields');
  const name = el('input'); name.value = draft.name; name.autocomplete = 'off'; name.spellcheck = false;
  const type = el('select');
  for (const value of ['string', 'number', 'boolean'] as const) { const option = el('option', value); option.value = value; type.append(option); }
  type.value = draft.type;
  const example = el('input'); example.value = String(action.value); example.readOnly = true;
  controls.append(field('Parameter name', name), field('Type', type), field('Captured example', example));
  const update = () => { draft!.enabled = toggle.checked; draft!.name = name.value; draft!.type = type.value as ParameterBinding['type']; name.disabled = type.disabled = !toggle.checked; };
  toggle.addEventListener('change', update); name.addEventListener('input', update); type.addEventListener('change', update); update();
  box.append(controls); return box;
}
function renderCapture(): void {
  const node = section('capture'); node.replaceChildren(heading(1, 'Review your demonstration'));
  const trace = state.trace;
  if (!trace) { node.append(empty('A task starts with a demonstration.', 'Use Teach task in the extension popup, interact with the page, and finish teaching to review the captured events here.')); return; }
  if (trace.id !== traceId) { traceId = trace.id; workflowName = ''; bindingDrafts.clear(); }
  node.append(el('p', `${trace.origin}${trace.startPath}`, 'small muted'));
  const row = el('div', '', 'toolbar'); row.append(el('span', `${trace.recording ? 'Teaching' : 'Ready to compile'} · ${trace.actions.length} actions`, 'badge'));
  if (trace.recording) row.append(button('Finish teaching', async () => { await runtime({ type: 'FINISH_RECORDING' }); await reload(); }, true));
  row.append(button('Discard recording', async () => { if (confirm('Discard this recording? Saved workflows will remain.')) { await runtime({ type: 'DISCARD_TRACE' }); await reload(); } }, true)); node.append(row);
  if (trace.warning) node.append(el('p', trace.warning, 'notice error'));
  if (!trace.actions.length) node.append(empty('Waiting for the first action.', 'Interact with a labeled field, button, select, or checkbox on the enabled page.'));
  const list = el('ol', '', 'steps');
  for (const action of trace.actions) {
    const item = el('li'); item.append(el('h3', `${action.kind} · ${action.target.name || action.target.tag}`));
    if (action.target.context) item.append(el('p', `Within: ${action.target.context}`, 'small muted'));
    if (action.value !== undefined) item.append(el('code', `Captured value: ${String(action.value)}`));
    item.append(graph(action.before, action.after));
    if (['fill', 'select', 'check'].includes(action.kind) && action.value !== undefined) item.append(parameterReview(action));
    list.append(item);
  }
  node.append(list);
  const name = el('input'); name.value = workflowName; name.placeholder = 'For example, Take a snapshot'; name.maxLength = 100;
  name.addEventListener('input', () => { workflowName = name.value; }); node.append(field('Workflow name', name));
  node.append(el('p', 'Choose which captured values become inputs. Examples stay tied to your demonstration; edit the values for each run after saving.', 'small muted'));
  const compileResult = el('p'); compileResult.hidden = true; compileResult.setAttribute('aria-live', 'polite');
  const save = button('Compile & save workflow', async () => {
    try {
    const bindings: ParameterBinding[] = trace.actions.flatMap(action => {
      const draft = bindingDrafts.get(action.id);
      if (!draft?.enabled) return [];
      return [{ actionId: action.id, name: draft.name.trim(), type: draft.type, example: action.value! }];
    });
    const workflow = await runtime<Workflow>({ type: 'COMPILE', name: workflowName.trim(), bindings });
    selectedId = workflow.id; libraryKey = '';
    const message = `Saved “${workflow.name}” as ${workflow.toolName}. Review its inputs before requesting a run.`;
    compileResult.textContent = message; compileResult.hidden = false; compileResult.className = 'notice success'; notice(message);
    await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      compileResult.textContent = message; compileResult.hidden = false; compileResult.className = 'notice error'; compileResult.setAttribute('role', 'alert'); notice(message, true);
    }
  });
  save.disabled = trace.recording || !trace.actions.length; node.append(save, compileResult);
  if (trace.recording) node.append(el('p', 'Finish teaching before compiling.', 'small muted'));
}
function exportWorkflow(workflow: Workflow): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' }));
  const link = el('a'); link.href = url; link.download = `${slug(workflow.toolName)}.json`; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); notice(`Exported “${workflow.name}” as original workflow JSON.`);
}
function renderLibrary(): void {
  const node = section('library'); node.replaceChildren(heading(2, 'Saved workflows'));
  if (!state.workflows.length) { node.append(empty('Your reusable tasks will live here.', 'Finish a demonstration, choose its parameters, and compile your first workflow.')); return; }
  const workflow = state.workflows.find(item => item.id === selectedId) || state.workflows[0]; selectedId = workflow.id;
  const picker = el('select');
  for (const item of state.workflows) { const option = el('option', item.name); option.value = item.id; picker.append(option); }
  picker.value = selectedId; picker.addEventListener('change', () => { selectedId = picker.value; renderLibrary(); }); node.append(field('Workflow', picker));
  node.append(el('p', `${workflow.origin}${workflow.startPath}`, 'small muted'), el('code', workflow.toolName));
  const actions = el('div', '', 'toolbar');
  actions.append(button('Export JSON', () => exportWorkflow(workflow), true), button('Delete workflow', async () => {
    if (!confirm(`Delete “${workflow.name}”? Export it first if you need a copy.`)) return;
    await runtime({ type: 'DELETE_WORKFLOW', workflowId: workflow.id }); inputDrafts.delete(workflow.id); notice('Workflow deleted.'); await reload();
  }, true)); node.append(actions);
  const details = el('details'); details.append(el('summary', `Review ${workflow.steps.length} saved actions`), stepsList(workflow.steps)); node.append(details);
  const targets = state.enabled.filter(tab => tab.origin === workflow.origin);
  const target = el('select');
  if (!targets.length) target.append(el('option', 'No enabled tab on this origin'));
  for (const tab of targets) { const option = el('option', `${tab.title || tab.origin} · Tab ${tab.tabId}`); option.value = String(tab.tabId); target.append(option); }
  target.value = String(targets.find(tab => tab.tabId === tabDrafts.get(workflow.id))?.tabId ?? targets[0]?.tabId ?? '');
  target.addEventListener('change', () => { tabDrafts.set(workflow.id, Number(target.value)); }); node.append(field('Target enabled tab', target));
  node.append(el('p', `Before running, return the target tab to the taught start route: ${workflow.startPath}. Use the page’s navigation; replay cannot continue across a reload.`, 'small muted'));
  if (!targets.length) node.append(el('p', `Enable a tab on ${workflow.origin} to run this workflow.`, 'small muted'));
  let values = inputDrafts.get(workflow.id);
  if (!values) { values = Object.fromEntries(workflow.parameters.map(parameter => [parameter.name, typeof parameter.example === 'boolean' ? parameter.example : String(parameter.example)])); inputDrafts.set(workflow.id, values); }
  for (const parameter of workflow.parameters) {
    const input = el('input'); input.type = parameter.type === 'boolean' ? 'checkbox' : parameter.type === 'number' ? 'number' : 'text';
    if (parameter.type === 'boolean') input.checked = values[parameter.name] === true; else input.value = String(values[parameter.name]);
    if (parameter.type === 'number') input.step = 'any';
    input.addEventListener('input', () => { values![parameter.name] = parameter.type === 'boolean' ? input.checked : input.value; });
    node.append(field(parameter.name, input, `${parameter.type} · Recorded example: ${String(parameter.example)}`));
  }
  if (!workflow.parameters.length) node.append(el('p', 'This workflow uses its captured values and has no inputs.', 'small muted'));
  const request = button('Review run proposal', async () => {
    const inputs: Inputs = {};
    for (const parameter of workflow.parameters) {
      const value = values![parameter.name];
      if (parameter.type === 'number' && String(value).trim() === '') throw new Error(`Enter a number for ${parameter.name}.`);
      inputs[parameter.name] = parameter.type === 'number' ? Number(value) : value;
    }
    await runtime({ type: 'REQUEST_RUN', tabId: Number(target.value), workflowId: workflow.id, inputs });
    notice('Run proposal ready. Review all actions below, then explicitly approve the run.'); await reload(); section('run').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  request.disabled = !targets.length || state.run?.status === 'running' || state.run?.status === 'pending'; node.append(request);
}
function renderRun(): void {
  const node = section('run'); node.replaceChildren(heading(3, 'Review & run'));
  const run = state.run;
  if (!run) { node.append(empty('Every run starts with your approval.', 'Create a proposal above, or request a workflow through native WebMCP. Proposed actions will appear here before they run.')); return; }
  node.append(el('span', run.status, `badge ${run.status === 'failed' ? 'failed' : ''}`), el('h3', run.workflow.name), el('p', `Origin: ${run.origin} · Tab ${run.tabId}`, 'small'), el('code', `Proposal ${run.id}`));
  const inputs = el('pre', JSON.stringify(run.inputs, null, 2)); node.append(el('h3', 'Proposed inputs'), inputs);
  if (run.status === 'pending') {
    node.append(el('p', `Required start route: ${run.workflow.startPath}. Return this tab to that route before approving.`, 'notice warning'));
    node.append(el('p', 'Approving will execute every action below on this tab. Clicks and form submissions may save, send, or change application data.', 'notice warning'));
    node.append(stepsList(run.workflow.steps, run.inputs));
    node.append(button('Run approved', async () => { await runtime({ type: 'APPROVE_RUN', runId: run.id }); notice('Approved. Watch progress here; Stop interrupts further actions.'); await reload(); }));
  } else {
    const progress = el('progress'); progress.max = run.workflow.steps.length || 1; progress.value = run.status === 'complete' ? progress.max : run.stepIndex; progress.setAttribute('aria-label', 'Workflow progress');
    node.append(progress, el('p', `${Math.min(progress.value, progress.max)} / ${run.workflow.steps.length} actions · ${run.message}`, run.status === 'failed' ? 'notice error' : 'small'));
    const details = el('details'); details.append(el('summary', 'Review approved actions'), stepsList(run.workflow.steps, run.inputs)); node.append(details);
  }
  if (run.status === 'running' || run.status === 'pending') node.append(button(run.status === 'pending' ? 'Reject proposal' : 'Stop run', async () => { await runtime({ type: 'STOP_RUN', runId: run.id }); notice('Stop requested. Completed actions are not undone.'); await reload(); }, true));
}
const reload = watchState(next => {
  state = next; renderCapability();
  const nextCapture = JSON.stringify(next.trace);
  const nextLibrary = JSON.stringify([next.workflows, next.enabled, next.run?.status]);
  const nextRun = JSON.stringify(next.run);
  if (nextCapture !== captureKey) { captureKey = nextCapture; renderCapture(); }
  if (nextLibrary !== libraryKey) { libraryKey = nextLibrary; renderLibrary(); }
  if (nextRun !== runKey) { runKey = nextRun; renderRun(); }
});
