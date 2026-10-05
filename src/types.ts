export type Scalar = string | number | boolean;
export type Inputs = Record<string, Scalar>;
export interface Target { tag: string; role: string; name: string; context?: string; inputType?: string }
export interface PageState { path: string; headings: string[]; dialogs: string[]; notices: string[] }
export type ActionKind = 'click' | 'fill' | 'select' | 'check' | 'submit';
export interface CapturedAction { id: string; kind: ActionKind; target: Target; value?: Scalar; before: PageState; after?: PageState; at: number }
export interface Trace { id: string; tabId: number; origin: string; startPath: string; startedAt: number; recording: boolean; actions: CapturedAction[]; warning?: string }
export interface ParameterBinding { actionId: string; name: string; type: 'string' | 'number' | 'boolean'; example: Scalar }
export interface Parameter { name: string; type: 'string' | 'number' | 'boolean'; example: Scalar }
export interface ValueBinding { literal?: Scalar; parameter?: string }
export interface WorkflowStep { id: string; kind: ActionKind; target: Target; value?: ValueBinding; before: PageState; after?: PageState }
export interface Workflow { id: string; name: string; toolName: string; origin: string; startPath: string; parameters: Parameter[]; steps: WorkflowStep[]; createdAt: number }
export interface EnabledTab { tabId: number; origin: string; title: string; nativeAvailable: boolean; documentId?: string }
export type RunStatus = 'pending' | 'running' | 'complete' | 'failed' | 'stopped';
export interface Run { id: string; tabId: number; origin: string; workflow: Workflow; inputs: Inputs; status: RunStatus; stepIndex: number; message: string; requestedAt: number; startedAt?: number; finishedAt?: number }
export interface Receipt { id: string; at: number; origin: string }
export interface BridgeState { enabled: EnabledTab[]; trace: Trace | null; workflows: Workflow[]; run: Run | null; receipts: Receipt[] }
export type Reply<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

// Only extension-owned UI may issue management and approval commands.
export type UiMessage =
 | { type: 'GET_STATE' }
 | { type: 'ENABLE_TAB'; tabId: number }
 | { type: 'DISABLE_TAB'; tabId: number }
 | { type: 'START_RECORDING'; tabId: number }
 | { type: 'FINISH_RECORDING' }
 | { type: 'DISCARD_TRACE' }
 | { type: 'COMPILE'; name: string; bindings: ParameterBinding[] }
 | { type: 'DELETE_WORKFLOW'; workflowId: string }
 | { type: 'REQUEST_RUN'; tabId: number; workflowId: string; inputs: Inputs }
 | { type: 'APPROVE_RUN'; runId: string }
 | { type: 'STOP_RUN'; runId: string };
export type ContentMessage =
 | { type: 'CONTENT_READY'; nativeAvailable: boolean }
 | { type: 'PAGE_HIDDEN' }
 | { type: 'CAPTURE_ACTION'; traceId: string; action: CapturedAction }
 | { type: 'CAPTURE_AFTER'; traceId: string; actionId: string; after: PageState }
 | { type: 'CONTENT_WARNING'; traceId: string; warning: string }
 | { type: 'NATIVE_REQUEST_RUN'; workflowId: string; inputs: Inputs }
 | { type: 'NATIVE_STATUS' }
 | { type: 'PROBE_RECEIPT'; receipt: Receipt }
 | { type: 'RUN_PROGRESS'; runId: string; stepIndex: number; status: Exclude<RunStatus, 'pending'>; message: string };
export type ContentCommand =
 | { type: 'BRIDGE_CONTENT'; command: 'init'; workflows: Workflow[] }
 | { type: 'BRIDGE_CONTENT'; command: 'start'; traceId: string }
 | { type: 'BRIDGE_CONTENT'; command: 'finish' | 'disable' | 'stop' | 'status' }
 | { type: 'BRIDGE_CONTENT'; command: 'replay'; run: Run };
export const EMPTY_STATE: BridgeState = { enabled: [], trace: null, workflows: [], run: null, receipts: [] };
