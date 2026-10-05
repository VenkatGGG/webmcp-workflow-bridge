# Event-to-tool hackathon implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. The user explicitly requests implementation now and no unit tests; build checks and a short manual demo replace the earlier production testing plan.

**Goal:** Load an original Chrome extension, teach a UI task through events, save a parameterized workflow, and offer it through native WebMCP with visible approval and UI replay.

**Architecture:** One Manifest V3 extension with an isolated content script, a small service worker and a popup/studio. Store bounded JSON in chrome.storage.local. The content script captures events and performs replay; the worker stores workflows and pending native-tool requests. A dependency-free demo site exercises the same DOM path as any supported third-party site.

**Tech stack:** TypeScript and esbuild for development; native JavaScript/DOM/Chrome APIs at runtime. No runtime dependencies, server AI, framework, database service, screen capture, copied project code, or automated test suite.

**Spec:** This plan narrows [MASTER_PLAN.md](../../MASTER_PLAN.md) for the user's hackathon instruction. The earlier enterprise roadmap is background, not a requirement to implement now.

**Implementation status:** All five source chunks are implemented and the build passes. Checked boxes track delivered code/documentation, not live browser or Gemini verification; those manual checks remain pending. See [verification log](../../IMPLEMENTATION_LOG.md).

## Boundaries

- One active recording and one replay at a time, bound to one tab/origin.
- Native labeled inputs/selects/checkboxes, links, buttons, forms and same-document SPA routes.
- Full navigation/reload interrupts replay with a clear message; do not build cross-document continuation or retry writes.
- Capture events plus bounded DOM facts; never screenshots, video, raw keystrokes, passwords, OTPs or whole DOM dumps.
- The user demonstrates a task manually first. Bootstrap arbitrary agent actuation, automatic semantic repair, branching graphs, cloud sync and origin-trial enrollment UI are deferred.
- Native WebMCP publishes a harmless diagnostic tool, a page description, run status and saved workflow tools. Missing native support stays visible. No custom chat or polyfill substitutes for native Gemini.
- Native workflow calls create proposals; only extension UI can approve execution. UI replay validates inputs, current origin and unique targets.
- An original diagnostic page is useful without native Gemini, but it is not proof that Gemini consumes the tools.
- No unit tests or CI machinery. Run TypeScript and the production build; inspect the package. Browser checks only where access is permitted.

## Files and interfaces

- `src/types.ts`: shared state, action, workflow, run and message contracts.
- `src/workflow.ts`: original trace compiler, parameter binding and workflow validation.
- `src/background.ts`: activation, recording storage, workflow CRUD, run proposals and approval.
- `src/content.ts`, `src/dom.ts`: event capture, semantic targets, observed state and bounded replay.
- `src/provider.ts`: native WebMCP registration with capability/receipt diagnostics.
- `src/ui/popup.ts`, `src/ui/studio.ts`, `src/ui/styles.css`: task controls and editable workflow review/graph.
- `extension/`: manifest and HTML entry points.
- `scripts/build.mjs`: bundle only original runtime code and copy static assets.
- `scripts/serve-demo.mjs`, `demo/`: a small original admin console with same-document pages.

Cross-module functions: `compileTrace(trace, name, bindings) -> Workflow`, `resolveValue(value, inputs)`, `bindText(text, inputs)`, `validateInputs(workflow, inputs)`; runtime message unions live in types.ts. UI uses `chrome.runtime.sendMessage` through a helper that displays errors. Content code exports `handleContentCommand(message)` behavior through its listener. No module loads private application APIs.

## Review focus

1. A compile button must always show a result or error; recording flushes pending edits before finishing.
2. A changed resource input must change the target and expected-result binding too.
3. Duplicate targets and sensitive fields must stop replay.
4. Native calls cannot approve themselves; approved arguments cannot change underneath a run.
5. Reload, lost content runtime and cancellation must never automatically retry a possibly completed action.

## Chunk 1 — Loadable extension and native capability probe

- [x] Create build configuration, manifest, original shared types and popup shell.
- [x] Add Enable here/Disable and browser-supplied tab/origin checks.
- [x] Register an original native probe, report `document.modelContext` availability and keep invocation receipts.
- [x] Build with `npm run build`; inspect packaged permissions and runtime dependencies.

**Done when:** `dist/` is a loadable unpacked extension and missing native support is an explicit state. Actual Gemini invocation remains a manual compatibility gate, not a claim inferred from compilation.

## Chunk 2 — Teach with structured events

- [x] Capture meaningful clicks, coalesced field edits, selects/checkboxes and form submissions.
- [x] Record semantic targets, sanitized paths, small before/after state summaries and candidate checks.
- [x] Exclude sensitive fields; cap trace size; support Start, Finish and Discard.
- [x] Display captured actions and surface errors instead of silently failing.

**Done when:** a taught task is stored as readable JSON actions, with no image capture and no raw keystroke stream.

## Chunk 3 — Compile and review

- [x] Suggest parameter names from fields; let the user choose which values are parameters.
- [x] Compile parameters into input values, matching target labels and observed result text.
- [x] Save a named workflow; render a simple sequential state graph and ordered steps.
- [x] Provide JSON export and deletion. Do not build import, graph editing or version migration now.

**Done when:** Compile creates a visible saved tool or actionable error. Examples and parameters remain editable before saving.

## Chunk 4 — Replay and WebMCP workflow tools

- [x] Resolve current controls by supported role/name/context; require a unique actionable match.
- [x] Execute through DOM interactions, check field values and observed state, and use bounded waits.
- [x] Show progress, Stop, error and final evidence; do not claim backend transaction guarantees.
- [x] Publish saved workflow tools and status; native calls create a pending proposal for extension-owned approval.
- [x] Interrupt on page reload/navigation or missing runtime; no automatic write retry.

**Done when:** the user can run a saved workflow with new values from the extension UI; native Gemini compatibility is reported separately.

## Chunk 5 — Demo, build and handoff

- [x] Build an original multi-page-style console: resources → search → details → snapshot dialog → confirmation.
- [x] Offer resource/retention choices and cosmetic layout changes; ambiguous targets can demonstrate a clear stop.
- [x] Finish typecheck/build, inspect package, and review source. Independent review is useful when available; an unavailable reviewer must be reported without blocking this small hackathon delivery.
- [x] Write exact Load unpacked and demo instructions, supported limitations and manual checks.

**Manual demonstration:** teach a snapshot for PaymentsDB/7 days, compile `take_snapshot`, replay for OrdersDB/14 days, inspect the event graph, try a duplicate-target stop, inspect WebMCP availability and the native receipt probe where supported.

**Release claim:** hackathon MVP with build evidence. No production-readiness claim, unit tests or invented native-Gemini verification.
