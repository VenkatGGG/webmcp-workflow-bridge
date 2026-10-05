import type { BridgeState, Reply, UiMessage } from '../types';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function field(label: string, control: HTMLElement, hint = ''): HTMLLabelElement {
  const wrapper = el('label', '', 'field');
  wrapper.append(el('span', label), control);
  if (hint) wrapper.append(el('small', hint));
  return wrapper;
}
export function notice(message: string, error = false): void {
  const target = document.getElementById('feedback')!;
  target.textContent = message;
  target.className = error ? 'notice error' : 'notice success';
  target.hidden = false;
  target.setAttribute('role', error ? 'alert' : 'status');
}
export function button(label: string, action: () => Promise<unknown> | void, secondary = false): HTMLButtonElement {
  const result = el('button', label, secondary ? 'secondary' : '');
  result.type = 'button';
  result.addEventListener('click', async () => {
    result.disabled = true;
    try { await action(); } catch (error) { notice(error instanceof Error ? error.message : String(error), true); }
    finally { result.disabled = false; }
  });
  return result;
}
export async function runtime<T = unknown>(message: UiMessage): Promise<T> {
  const reply = await chrome.runtime.sendMessage(message) as Reply<T> | undefined;
  if (!reply) throw new Error('The extension did not respond. Reopen the studio and try again.');
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}
export function watchState(render: (state: BridgeState) => Promise<void> | void): () => Promise<void> {
  let revision = 0;
  const reload = async () => {
    const current = ++revision;
    try { const state = await runtime<BridgeState>({ type: 'GET_STATE' }); if (current === revision) await render(state); }
    catch (error) { notice(error instanceof Error ? error.message : String(error), true); }
  };
  chrome.storage.onChanged.addListener((_changes, area) => { if (area === 'local') void reload(); });
  void reload();
  return reload;
}
export function empty(title: string, detail: string): HTMLElement {
  const box = el('div', '', 'empty'); box.append(el('h3', title), el('p', detail)); return box;
}
export function time(at: number): string { return new Date(at).toLocaleString(); }
