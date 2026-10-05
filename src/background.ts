import { EMPTY_STATE, type BridgeState, type ContentCommand, type ContentMessage, type Inputs, type Reply, type Run, type UiMessage } from './types';
import { compileTrace, validateInputs } from './workflow';

const KEY = 'workflow-bridge-v1';
let writes: Promise<unknown> = Promise.resolve();
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
async function read(): Promise<BridgeState> {
  await writes.catch(() => {});
  return (await chrome.storage.local.get(KEY))[KEY] as BridgeState | undefined ?? structuredClone(EMPTY_STATE);
}
function change<T>(fn: (state: BridgeState) => T): Promise<T> {
  const next = writes.then(async () => {
    const state: BridgeState = (await chrome.storage.local.get(KEY))[KEY] as BridgeState | undefined ?? structuredClone(EMPTY_STATE);
    const result = fn(state);
    await chrome.storage.local.set({ [KEY]: state });
    void chrome.action.setBadgeText({ text: state.run?.status === 'pending' ? '!' : state.trace?.recording ? 'REC' : state.run?.status === 'running' ? 'RUN' : '' });
    void chrome.action.setBadgeBackgroundColor({ color: '#15766d' });
    return structuredClone(result);
  });
  writes = next.catch(() => {});
  return next;
}
const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);
async function content(tabId: number, command: ContentCommand): Promise<unknown> {
  const reply = await chrome.tabs.sendMessage<ContentCommand, Reply>(tabId, command, { frameId: 0 });
  if (!reply || !reply.ok) throw new Error(reply && !reply.ok ? reply.error : 'The page did not respond. Enable it again.');
  return reply.data;
}
function activeRun(run: Run | null) { return run?.status === 'running' || run?.status === 'pending'; }
async function enabled(tabId: number) {
  const entry = (await read()).enabled.find(t => t.tabId === tabId);
  if (!entry) throw new Error('Enable the website from its toolbar popup first.');
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || new URL(tab.url).origin !== entry.origin) throw new Error('The tab changed origin. Enable it again.');
  return entry;
}
async function refreshProviders() {
  const state = await read();
  await Promise.allSettled(state.enabled.map(t => content(t.tabId, { type: 'BRIDGE_CONTENT', command: 'init', workflows: state.workflows.filter(w => w.origin === t.origin) })));
}
async function propose(tabId: number, workflowId: string, rawInputs: Inputs) {
  const tab = await enabled(tabId);
  return change(state => {
    if (state.trace?.recording) throw new Error('Finish teaching before running a workflow.');
    if (activeRun(state.run)) throw new Error('Approve or stop the current proposal/run first.');
    const workflow = state.workflows.find(w => w.id === workflowId && w.origin === tab.origin);
    if (!workflow) throw new Error('This workflow is not available on this origin.');
    const inputs = validateInputs(workflow, rawInputs);
    state.run = { id: crypto.randomUUID(), tabId, origin: tab.origin, workflow: structuredClone(workflow), inputs, status: 'pending', stepIndex: 0, message: 'Review the exact inputs and steps in Workflow Bridge, then approve.', requestedAt: Date.now() };
    return state.run;
  });
}
async function finishTrace() {
  const trace = (await read()).trace;
  if (!trace) throw new Error('There is no recording to finish.');
  if (trace.recording) {
    try { await content(trace.tabId, { type: 'BRIDGE_CONTENT', command: 'finish' }); }
    catch (e) { await change(s => { if (s.trace?.id === trace.id) s.trace.warning = `Recording interrupted: ${errorText(e)}`; }); }
  }
  return change(s => { if (s.trace?.id === trace.id) s.trace.recording = false; return s.trace; });
}

async function ui(message: UiMessage): Promise<unknown> {
  switch (message.type) {
    case 'GET_STATE': {
      const state = await read();
      // A browser restart may preserve stored IDs but not the isolated runtime.
      if (state.run?.status === 'running' && Date.now() - (state.run.startedAt ?? state.run.requestedAt) > 2_000) {
        try {
          const status = await content(state.run.tabId, { type: 'BRIDGE_CONTENT', command: 'status' }) as { runId?: string };
          if (status?.runId !== state.run.id) throw new Error('Replay runtime is gone.');
        } catch {
          await change(s => { if (s.run?.id === state.run!.id && s.run.status === 'running') { s.run.status = 'failed'; s.run.message = 'Replay interrupted. Inspect the page; no actions were automatically retried.'; } });
        }
      }
      return read();
    }
    case 'ENABLE_TAB': {
      if (!Number.isInteger(message.tabId)) throw new Error('Select a website tab.');
      const tab = await chrome.tabs.get(message.tabId);
      const url = new URL(tab.url ?? '');
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Open an ordinary HTTP or HTTPS website first. Chrome internal pages are unsupported.');
      const state = await read();
      if (state.run?.tabId === message.tabId && activeRun(state.run)) throw new Error('Stop the current run before re-enabling this page.');
      await change(s => {
        s.enabled = s.enabled.filter(t => t.tabId !== message.tabId);
        s.enabled.push({ tabId: message.tabId, origin: url.origin, title: (tab.title ?? url.hostname).slice(0, 120), nativeAvailable: false });
      });
      try {
        await chrome.scripting.executeScript({ target: { tabId: message.tabId, frameIds: [0] }, files: ['content.js'] });
        await content(message.tabId, { type: 'BRIDGE_CONTENT', command: 'init', workflows: state.workflows.filter(w => w.origin === url.origin) });
      } catch (e) {
        await change(s => { s.enabled = s.enabled.filter(t => t.tabId !== message.tabId); });
        throw new Error(`Could not enable this page: ${errorText(e)}`);
      }
      return read();
    }
    case 'DISABLE_TAB': {
      await content(message.tabId, { type: 'BRIDGE_CONTENT', command: 'disable' }).catch(() => {});
      return change(s => {
        s.enabled = s.enabled.filter(t => t.tabId !== message.tabId);
        if (s.trace?.tabId === message.tabId && s.trace.recording) { s.trace.recording = false; s.trace.warning = 'Page disabled during teaching.'; }
        if (s.run?.tabId === message.tabId && activeRun(s.run)) { s.run.status = 'stopped'; s.run.message = 'Page disabled. Inspect any already-applied changes.'; }
        return s;
      });
    }
    case 'START_RECORDING': {
      const entry = await enabled(message.tabId);
      const tab = await chrome.tabs.get(message.tabId);
      const trace = await change(s => {
        if (activeRun(s.run)) throw new Error('Stop the current run or proposal before teaching.');
        if (s.trace?.recording) throw new Error('Finish the current recording first.');
        s.trace = { id: crypto.randomUUID(), tabId: message.tabId, origin: entry.origin, startPath: new URL(tab.url!).pathname, startedAt: Date.now(), recording: true, actions: [] };
        return s.trace;
      });
      try { await content(message.tabId, { type: 'BRIDGE_CONTENT', command: 'start', traceId: trace.id }); }
      catch (e) { await change(s => { if (s.trace?.id === trace.id) { s.trace.recording = false; s.trace.warning = errorText(e); } }); throw e; }
      return trace;
    }
    case 'FINISH_RECORDING': return finishTrace();
    case 'DISCARD_TRACE': {
      const trace = (await read()).trace;
      if (trace?.recording) await content(trace.tabId, { type: 'BRIDGE_CONTENT', command: 'finish' }).catch(() => {});
      return change(s => { s.trace = null; return s; });
    }
    case 'COMPILE': {
      const workflow = await change(s => {
        if (!s.trace) throw new Error('Teach a workflow first.');
        if (s.workflows.length >= 20) throw new Error('This demo stores up to 20 workflows. Delete one to make room.');
        const w = compileTrace(s.trace, message.name, message.bindings);
        s.workflows.push(w);
        return w;
      });
      await refreshProviders();
      return workflow;
    }
    case 'DELETE_WORKFLOW': {
      await change(s => {
        if (activeRun(s.run) && s.run?.workflow.id === message.workflowId) throw new Error('Stop this run before deleting its workflow.');
        s.workflows = s.workflows.filter(w => w.id !== message.workflowId);
      });
      await refreshProviders();
      return read();
    }
    case 'REQUEST_RUN': return propose(message.tabId, message.workflowId, message.inputs);
    case 'APPROVE_RUN': {
      const current = (await read()).run;
      if (!current || current.id !== message.runId || current.status !== 'pending') throw new Error('This proposal is no longer pending.');
      await enabled(current.tabId);
      if (Date.now() - current.requestedAt > 10 * 60_000) throw new Error('This proposal expired. Stop it and request a fresh run.');
      const run = await change(s => {
        if (s.run?.id !== current.id || s.run.status !== 'pending') throw new Error('This run was already approved or stopped.');
        s.run.status = 'running'; s.run.startedAt = Date.now(); s.run.message = 'Starting approved UI replay…'; return s.run;
      });
      try { await content(run.tabId, { type: 'BRIDGE_CONTENT', command: 'replay', run }); }
      catch (e) { await change(s => { if (s.run?.id === run.id && s.run.status === 'running') { s.run.status = 'failed'; s.run.message = `Could not start or confirm replay: ${errorText(e)}. Inspect the page before retrying.`; } }); throw e; }
      return read();
    }
    case 'STOP_RUN': {
      const run = await change(s => {
        if (!s.run || s.run.id !== message.runId) throw new Error('Run not found.');
        s.run.status = 'stopped'; s.run.message = 'Stopping further actions…'; return s.run;
      });
      let acknowledged = false;
      try { await content(run.tabId, { type: 'BRIDGE_CONTENT', command: 'stop' }); acknowledged = true; } catch {}
      return change(s => {
        if (s.run?.id === run.id) s.run.message = acknowledged ? 'Stopped further actions. Already-applied changes remain; inspect the page.' : 'Stop requested, but the page runtime did not acknowledge. Inspect the tab before doing anything else.';
        return s.run;
      });
    }
  }
  throw new Error('Unknown management command.');
}

async function fromContent(message: ContentMessage, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (sender.frameId !== 0 || sender.tab?.id === undefined || !sender.url) throw new Error('Only an enabled top-level page can send this request.');
  const tabId = sender.tab.id;
  const state = await read();
  const entry = state.enabled.find(t => t.tabId === tabId && t.origin === new URL(sender.url!).origin);
  if (!entry || (entry.documentId && sender.documentId !== entry.documentId)) throw new Error('Page is disabled or its document changed. Enable it again.');
  switch (message.type) {
    case 'PAGE_HIDDEN':
      await interruptTab(tabId, 'Full navigation/reload interrupted this session. Enable the new page again.', entry.documentId);
      return true;
    case 'CONTENT_READY': return change(s => {
      const t = s.enabled.find(t => t.tabId === tabId);
      if (t) { t.nativeAvailable = !!message.nativeAvailable; t.documentId = sender.documentId; }
      return true;
    });
    case 'CAPTURE_ACTION': return change(s => {
      const trace = s.trace;
      if (!trace?.recording || trace.id !== message.traceId || trace.tabId !== tabId) return false;
      if (trace.actions.length >= 60) { trace.warning = '60-action limit reached. Teach a shorter task.'; return false; }
      if (JSON.stringify(message.action).length > 16_000) { trace.warning = 'An event was too large to store safely.'; return false; }
      if (!trace.actions.some(a => a.id === message.action.id)) trace.actions.push(message.action);
      return true;
    });
    case 'CAPTURE_AFTER': return change(s => {
      if (s.trace?.id !== message.traceId || s.trace.tabId !== tabId) return false;
      const action = s.trace.actions.find(a => a.id === message.actionId);
      if (action) action.after = message.after;
      return true;
    });
    case 'CONTENT_WARNING': return change(s => { if (s.trace?.id === message.traceId && s.trace.tabId === tabId) s.trace.warning = message.warning.slice(0, 300); return true; });
    case 'NATIVE_REQUEST_RUN': {
      const run = await propose(tabId, message.workflowId, message.inputs);
      return { status: 'needs_user', runId: run.id, message: 'Open the Workflow Bridge toolbar popup or studio to review and approve. No UI actions have run.' };
    }
    case 'NATIVE_STATUS': return state.run?.tabId === tabId && state.run.origin === entry.origin ? { runId: state.run.id, status: state.run.status, stepIndex: state.run.stepIndex, message: state.run.message } : { status: 'idle' };
    case 'PROBE_RECEIPT': return change(s => {
      const receipt = { id: String(message.receipt.id).slice(0, 100), origin: entry.origin, at: Date.now() };
      s.receipts = [...s.receipts.slice(-9), receipt]; return receipt;
    });
    case 'RUN_PROGRESS': return change(s => {
      const run = s.run;
      if (!run || run.tabId !== tabId || run.id !== message.runId || run.status !== 'running') return false;
      if (!['running', 'complete', 'failed', 'stopped'].includes(message.status) || !Number.isInteger(message.stepIndex) || message.stepIndex < run.stepIndex || message.stepIndex > run.workflow.steps.length) return false;
      run.status = message.status; run.stepIndex = message.stepIndex; run.message = message.message.slice(0, 500);
      if (message.status !== 'running') run.finishedAt = Date.now();
      return true;
    });
  }
  throw new Error('Unknown page command.');
}

chrome.runtime.onMessage.addListener((message: UiMessage | ContentMessage, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message.type !== 'string') return false;
  const trustedUi = !sender.tab?.url?.startsWith('http') && sender.url?.startsWith(chrome.runtime.getURL(''));
  const task = trustedUi ? ui(message as UiMessage) : fromContent(message as ContentMessage, sender);
  task.then(data => respond({ ok: true, data } satisfies Reply), e => respond({ ok: false, error: errorText(e) } satisfies Reply));
  return true;
});

async function interruptTab(tabId: number, reason: string, documentId?: string) {
  const s = await read();
  if (!s.enabled.some(t => t.tabId === tabId && (!documentId || t.documentId === documentId))) return;
  void chrome.tabs.sendMessage(tabId, { type: 'BRIDGE_CONTENT', command: 'disable' }, documentId ? { documentId } : { frameId: 0 }).catch(() => {});
  await change(state => {
    if (!state.enabled.some(t => t.tabId === tabId && (!documentId || t.documentId === documentId))) return;
    state.enabled = state.enabled.filter(t => t.tabId !== tabId);
    if (state.trace?.tabId === tabId && state.trace.recording) { state.trace.recording = false; state.trace.warning = reason; }
    if (state.run?.tabId === tabId && activeRun(state.run)) { state.run.status = 'failed'; state.run.message = `${reason} Inspect the page; no actions will be automatically retried.`; }
  });
}
// Chrome also reports loading for History API transitions. Preserve the session
// only when the originally enabled document still owns an active runtime.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== 'complete') return;
  void (async () => {
    const entry = (await read()).enabled.find(t => t.tabId === tabId);
    if (!entry?.documentId) return;
    try {
      const reply = await chrome.tabs.sendMessage(tabId, { type: 'BRIDGE_CONTENT', command: 'status' }, { documentId: entry.documentId }) as Reply<{ enabled: boolean }>;
      if (!reply?.ok || !reply.data.enabled) throw new Error('Document runtime is gone.');
    } catch {
      await interruptTab(tabId, 'Full navigation/reload interrupted this session. Enable the new page again.', entry.documentId);
    }
  })();
});
chrome.tabs.onRemoved.addListener(tabId => { void interruptTab(tabId, 'The tab was closed.'); });
