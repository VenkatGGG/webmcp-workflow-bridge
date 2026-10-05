import { button, el, runtime, time, watchState } from './common';

const reload = watchState(async state => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const enabled = state.enabled.find(item => item.tabId === tab?.id);
  const target = document.getElementById('popup-content')!;
  target.replaceChildren();
  const summary = el('section', '', 'card');
  summary.append(el('span', enabled ? 'ENABLED ON THIS TAB' : 'START WITH THIS TAB', 'eyebrow'), el('h2', tab?.title || 'Current page'));
  summary.append(el('p', enabled?.origin || 'Enable a supported website, then demonstrate a task.', 'muted'));
  const enable = button(enabled ? 'Disable this tab' : 'Enable this tab', async () => {
    if (tab?.id === undefined) throw new Error('No active browser tab is available.');
    await runtime({ type: enabled ? 'DISABLE_TAB' : 'ENABLE_TAB', tabId: tab.id });
    await reload();
  }, Boolean(enabled));
  enable.disabled = tab?.id === undefined;
  summary.append(enable);
  const recording = state.trace?.recording;
  const teach = button(recording ? 'Finish teaching' : 'Teach task', async () => {
    if (recording) await runtime({ type: 'FINISH_RECORDING' });
    else if (tab?.id !== undefined) await runtime({ type: 'START_RECORDING', tabId: tab.id });
    await reload();
  });
  teach.disabled = !recording && !enabled;
  summary.append(teach);
  if (state.trace) summary.append(el('p', `${recording ? 'Teaching' : 'Ready to review'} · ${state.trace.actions.length} actions · ${state.trace.origin}`, 'small'));
  if (state.trace?.warning) summary.append(el('p', state.trace.warning, 'notice error'));
  const native = el('section', '', 'capability');
  native.append(el('h3', 'Native WebMCP'), el('p', enabled ? (enabled.nativeAvailable ? 'Native tools registered on this page' : 'Native tools unavailable on this page') : 'Enable this tab to check availability.'));
  const receipt = enabled && state.receipts.filter(item => item.origin === enabled.origin).sort((a, b) => b.at - a.at)[0];
  native.append(el('p', receipt ? `Diagnostic receipt: ${time(receipt.at)}` : 'No diagnostic invocation receipt for this page.', 'small'));
  if (receipt) native.append(el('code', receipt.id));
  native.append(el('p', 'API availability or a receipt does not prove Gemini compatibility.', 'small muted'));
  target.append(summary, native);
  const run = state.run;
  if (run && (run.status === 'pending' || run.status === 'running')) {
    const activity = el('section', '', 'card');
    activity.append(el('span', run.status === 'pending' ? 'APPROVAL NEEDED' : 'RUNNING', 'eyebrow'), el('h3', run.workflow.name), el('p', run.origin, 'small muted'));
    if (run.status === 'pending') activity.append(el('p', 'A workflow was requested. Review its inputs and actions before approval.', 'small'), button('Review requested workflow in studio', () => chrome.runtime.openOptionsPage()));
    else activity.append(el('p', `${run.stepIndex} / ${run.workflow.steps.length} actions · ${run.message}`, 'small'), button('Stop run', async () => { await runtime({ type: 'STOP_RUN', runId: run.id }); await reload(); }, true));
    target.append(activity);
  }
  target.append(button(`Open studio · ${state.workflows.length} saved`, () => chrome.runtime.openOptionsPage(), true));
});
