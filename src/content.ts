import { actionable, changedState, controlFor, pageState, perform, resolveTarget, stateMatchesDelta, targetOf, valueOf, type Control } from './dom';
import { NativeProvider, sendContent } from './provider';
import { bindState, bindText, resolveValue } from './workflow';
import type { CapturedAction, ContentCommand, ContentMessage, PageState, Reply, Run, Scalar, Target } from './types';

type PendingEdit = { element: Control; target: Target; value: Scalar; before: PageState };
type ActiveRun = { id: string; controller: AbortController };
const pause = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

function install(): { handle: (command: ContentCommand) => Promise<unknown> } {
  let enabled = false;
  let traceId: string | null = null;
  let actionCount = 0;
  let pendingEdit: PendingEdit | null = null;
  let observation: { traceId: string; actionId: string; timer: ReturnType<typeof setTimeout> } | null = null;
  let queue: Promise<void> = Promise.resolve();
  let captureError: string | null = null;
  let focusState: PageState | null = null;
  let activeRun: ActiveRun | null = null;
  let lastRunId: string | null = null;
  let lastSubmit: { form: HTMLFormElement; at: number } | null = null;
  let lastValues = new WeakMap<Element, Scalar>();
  const provider = new NativeProvider(sendContent);

  function enqueue(message: ContentMessage): void {
    queue = queue.then(async () => {
      if (await sendContent(message) === false) throw new Error('The recording is no longer active.');
    }).catch(error => {
      captureError = error instanceof Error ? error.message : 'Recording could not be saved.';
      traceId = null;
    });
  }
  function sealObservation(): void {
    if (!observation) return;
    clearTimeout(observation.timer);
    enqueue({ type: 'CAPTURE_AFTER', traceId: observation.traceId, actionId: observation.actionId, after: pageState() });
    observation = null;
  }
  function warn(warning: string): void {
    if (traceId) enqueue({ type: 'CONTENT_WARNING', traceId, warning });
  }
  function record(kind: CapturedAction['kind'], target: Target, before: PageState, value?: Scalar): void {
    if (!enabled || !traceId || activeRun) return;
    sealObservation();
    if (actionCount >= 60) { warn('Recording reached the 60-step limit. Finish and review this trace.'); return; }
    const action: CapturedAction = { id: crypto.randomUUID(), kind, target, before, ...(value !== undefined ? { value } : {}), at: Date.now() };
    enqueue({ type: 'CAPTURE_ACTION', traceId, action });
    actionCount++;
    observation = { traceId, actionId: action.id, timer: setTimeout(sealObservation, 450) };
  }
  function flushEdit(): void {
    if (!pendingEdit) return;
    const edit = pendingEdit;
    pendingEdit = null;
    const value = valueOf(edit.element);
    if (value === undefined) { warn('An excluded or oversized field edit was omitted.'); return; }
    if (lastValues.get(edit.element) === value) return;
    record('fill', edit.target, edit.before, value);
    lastValues.set(edit.element, value);
  }
  function capturing(event: Event): boolean { return enabled && !!traceId && !activeRun && event.isTrusted; }

  const takeOver = (event: Event) => { if (event.isTrusted && activeRun) activeRun.controller.abort(); };
  document.addEventListener('pointerdown', takeOver, true);
  document.addEventListener('keydown', takeOver, true);
  // A BFCache restoration must not revive a permission that navigation removed.
  window.addEventListener('pagehide', () => {
    if (enabled) void sendContent({ type: 'PAGE_HIDDEN' }).catch(() => {});
    enabled = false;
    activeRun?.controller.abort();
    traceId = null;
    pendingEdit = null;
    if (observation) clearTimeout(observation.timer);
    observation = null;
    provider.stop();
  });

  document.addEventListener('focusin', event => {
    if (!capturing(event)) return;
    if (pendingEdit && pendingEdit.element !== controlFor(event.target)) flushEdit();
    focusState = pageState();
  }, true);
  document.addEventListener('input', event => {
    if (!capturing(event)) return;
    const element = controlFor(event.target);
    if (!element || !(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) || element instanceof HTMLInputElement && ['checkbox', 'button', 'submit', 'reset'].includes(element.type)) return;
    const target = targetOf(element);
    const value = valueOf(element);
    if (!target || value === undefined) { if (pendingEdit?.element === element) pendingEdit = null; return; }
    if (pendingEdit?.element !== element) {
      flushEdit();
      sealObservation();
      pendingEdit = { element, target, value, before: focusState || pageState() };
    } else pendingEdit.value = value;
  }, true);
  document.addEventListener('focusout', event => { if (capturing(event)) flushEdit(); }, true);
  document.addEventListener('change', event => {
    if (!capturing(event)) return;
    const element = controlFor(event.target);
    if (!element) return;
    if (!(element instanceof HTMLSelectElement || element instanceof HTMLInputElement && element.type === 'checkbox')) { flushEdit(); return; }
    flushEdit();
    const target = targetOf(element);
    const value = valueOf(element);
    if (target && value !== undefined) record(element instanceof HTMLSelectElement ? 'select' : 'check', target, focusState || pageState(), value);
  }, true);
  document.addEventListener('click', event => {
    if (!capturing(event)) return;
    const element = controlFor(event.target);
    if (!element) return;
    if (!(element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement || element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type))) return;
    flushEdit();
    sealObservation();
    const target = targetOf(element);
    if (!target) return;
    if ((element instanceof HTMLButtonElement || element instanceof HTMLInputElement) && element.type === 'submit' && element.form) lastSubmit = { form: element.form, at: Date.now() };
    record('click', target, pageState());
  }, true);
  document.addEventListener('submit', event => {
    if (!capturing(event)) return;
    const element = controlFor(event.target);
    if (!(element instanceof HTMLFormElement)) return;
    if (lastSubmit?.form === element && Date.now() - lastSubmit.at < 500) { lastSubmit = null; return; }
    flushEdit();
    const target = targetOf(element);
    if (target) record('submit', target, pageState());
  }, true);

  async function finish(): Promise<{ actions: number }> {
    flushEdit();
    // Give the last input handler a chance to render before the final observation.
    await pause(150);
    sealObservation();
    traceId = null;
    await queue;
    if (captureError) throw new Error(captureError);
    return { actions: actionCount };
  }
  async function replay(run: Run, execution: ActiveRun): Promise<void> {
    let stepIndex = 0;
    const verifyContext = (path?: string) => {
      if (execution.controller.signal.aborted || !enabled || activeRun !== execution) throw new Error('Replay stopped.');
      if (location.origin !== run.origin || run.workflow.origin !== run.origin) throw new Error('Page origin changed; replay stopped.');
      if (path !== undefined && location.pathname !== path) throw new Error('Page route does not match the recorded step.');
    };
    const progress = async (status: 'running' | 'complete' | 'failed' | 'stopped', message: string) => {
      if (await sendContent({ type: 'RUN_PROGRESS', runId: run.id, stepIndex, status, message }) !== true) throw new Error('The extension no longer considers this run active.');
    };
    try {
      verifyContext(bindText(run.workflow.startPath, run.inputs));
      if (!run.workflow.steps.length || run.workflow.steps.length > 60) throw new Error('Workflow must have between 1 and 60 steps.');
      for (const [index, step] of run.workflow.steps.entries()) {
        stepIndex = index;
        const before = bindState(step.before, run.inputs);
        const after = step.after ? bindState(step.after, run.inputs) : undefined;
        verifyContext(before.path);
        await progress('running', `Step ${index + 1} of ${run.workflow.steps.length}: ${step.kind}`);
        verifyContext(before.path);
        const target = { ...step.target, name: bindText(step.target.name, run.inputs), context: step.target.context === undefined ? undefined : bindText(step.target.context, run.inputs) };
        const element = resolveTarget(target);
        actionable(element);
        const value = resolveValue(step.value, run.inputs);
        // One interaction only: observations may wait, actions are never retried.
        perform(element, step.kind, value, () => {
          verifyContext(before.path);
          if (resolveTarget(target) !== element) throw new Error('Target changed before the action could run.');
        });
        await pause(150);
        verifyContext();
        if (['fill', 'select', 'check'].includes(step.kind)) {
          const actual = valueOf(resolveTarget(target));
          if (actual !== (typeof value === 'number' ? String(value) : value)) throw new Error('The control did not retain the requested value.');
        }
        if (after && changedState(before, after)) {
          const deadline = Date.now() + 2500;
          while (!stateMatchesDelta(before, after, pageState())) {
            verifyContext();
            if (location.pathname !== before.path && location.pathname !== after.path) throw new Error('Page moved to an unexpected route.');
            if (Date.now() >= deadline) throw new Error('The recorded UI change was not observed. Review the page before retrying.');
            await pause(100);
          }
        }
        verifyContext(after?.path || before.path);
        stepIndex = index + 1;
        await progress('running', `Observed step ${stepIndex} of ${run.workflow.steps.length}.`);
      }
      const last = run.workflow.steps.at(-1)!;
      await progress('complete', changedState(bindState(last.before, run.inputs), last.after ? bindState(last.after, run.inputs) : undefined)
        ? 'Replay finished; observed UI checks passed.'
        : 'Steps finished; no final UI change was recorded. Review the page.');
    } catch (error) {
      const stopped = execution.controller.signal.aborted || !enabled;
      try { await progress(stopped ? 'stopped' : 'failed', stopped ? 'Replay stopped. Review the page; completed actions were not undone.' : error instanceof Error ? error.message : 'Replay failed. Review the page before retrying.'); } catch { /* A lost extension connection cannot safely continue a run. */ }
    } finally {
      if (activeRun === execution) activeRun = null;
    }
  }
  async function handle(command: ContentCommand): Promise<unknown> {
    switch (command.command) {
      case 'init': {
        enabled = true;
        await provider.update(command.workflows);
        const nativeAvailable = enabled && provider.available;
        if (!enabled) return { nativeAvailable: false };
        await sendContent({ type: 'CONTENT_READY', nativeAvailable });
        return { nativeAvailable };
      }
      case 'start':
        if (!enabled || activeRun || traceId) throw new Error('Enable this page and finish the active operation before recording.');
        traceId = command.traceId;
        actionCount = 0;
        captureError = null;
        pendingEdit = null;
        focusState = null;
        lastValues = new WeakMap();
        lastSubmit = null;
        return { recording: true };
      case 'finish': return finish();
      case 'stop': activeRun?.controller.abort(); return { stopped: true };
      case 'disable':
        activeRun?.controller.abort();
        traceId = null;
        pendingEdit = null;
        if (observation) clearTimeout(observation.timer);
        observation = null;
        enabled = false;
        provider.stop();
        return { enabled: false };
      case 'status': return { enabled, recording: !!traceId, nativeAvailable: provider.available, runId: activeRun?.id || null };
      case 'replay': {
        if (!enabled || traceId || activeRun) throw new Error('Finish recording or the current replay first.');
        if (lastRunId === command.run.id) throw new Error('This run was already dispatched. Review the page before making a new proposal.');
        const execution = { id: command.run.id, controller: new AbortController() };
        activeRun = execution;
        lastRunId = command.run.id;
        // Return acceptance before the first action so the worker can store running state.
        setTimeout(() => { void replay(command.run, execution); }, 0);
        return { accepted: true };
      }
    }
  }
  chrome.runtime.onMessage.addListener((message: unknown, sender, reply: (value: Reply) => void) => {
    if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object' || (message as { type?: string }).type !== 'BRIDGE_CONTENT') return;
    void handle(message as ContentCommand).then(data => reply({ ok: true, data }), error => reply({ ok: false, error: error instanceof Error ? error.message : 'Content command failed.' }));
    return true;
  });
  return { handle };
}

// executeScript may inject this bundle again; the isolated-world instance owns listeners.
const isolated = window as Window & { __webmcpWorkflowBridgeV1?: ReturnType<typeof install> };
const bridge = isolated.__webmcpWorkflowBridgeV1 ||= install();
export const handleContentCommand = bridge.handle;
