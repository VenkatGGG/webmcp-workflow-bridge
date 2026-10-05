# Workflow Bridge — hackathon MVP

An original, minimal Chrome extension that captures UI events, compiles reviewed demonstrations into reusable workflows, and registers tools through native WebMCP when available. Gemini remains the agent.

**No screen recording, screenshots, raw keystroke logs, application API calls or third-party runtime dependencies.** TypeScript, esbuild and Chrome type definitions are development dependencies only.

## Current status

The extension, workflow studio and demo console are implemented. TypeScript and the packaged build pass. No unit tests were added or run, as requested. Chrome replay and a model-driven invocation through the official Inspector's Gemini chat were verified. Invocation by Chrome's built-in Gemini agent has not been verified.

This is a narrow hackathon implementation, not a production release or universal website adapter. The new project is independent of `../curis`.

## Build and load

```sh
cd /Users/sri/Documents/ChatGPT/webmcp-workflow-bridge
npm install
npm run build
npm run demo
```

1. In Chrome, open `chrome://extensions`.
2. Turn on **Developer mode** and choose **Load unpacked**.
3. Select `/Users/sri/Documents/ChatGPT/webmcp-workflow-bridge/dist`.
4. Pin **Workflow Bridge** in Chrome's Extensions menu.
5. Visit [the demo console](http://127.0.0.1:4174/overview).

After changing source code, rebuild and click **Reload** on the extension card. Reload the demo page and enable it again. The server binds to your machine only; its snapshots are simulated local data.

## One complete demonstration

### Teach

1. In the demo, click **Resources**. Start from `/resources` with an empty search field.
2. Open Workflow Bridge's toolbar popup → **Enable this tab** → **Teach task**.
3. Close the popup. Enter `PaymentsDB` into **Search resources**.
4. Click the **PaymentsDB** result, then **Create Snapshot**.
5. Explicitly edit **Retention days** to `7`. If it already says 7, select the value and retype it so there is a field-edit event.
6. Click **Review Snapshot**, then **Confirm Snapshot**. A local demo receipt appears.
7. Open the popup → **Finish teaching** → **Open studio**.

Only meaningful interactions and small before/after DOM summaries are captured. The popup is outside the recorded website.

### Compile

1. Review the captured actions in the studio.
2. For the search edit, enable **Make this value an input**, name it `resource`, and keep type `string`.
3. For the retention edit, enable the same option, name it `retention_days`, and choose type `number`.
4. Name the workflow **Take a snapshot** and click **Compile & save workflow**.
5. A success message identifies the saved tool. Any compilation problem is displayed inline.

The graph is deliberately simple: an ordered path of observed states and actions. The compiler binds reviewed inputs into field values, target names and UI checks. It also supports observed exact or lowercase URL segments. It cannot infer unrelated opaque resource IDs.

### Replay with different inputs

1. Return to the **original demo tab** and click its **Resources** navigation link. Use the page link rather than reloading or typing a URL; full navigation ends the enabled session.
2. In the studio, select the saved workflow and that enabled tab.
3. Set `resource` to `OrdersDB` and `retention_days` to `14`.
4. Choose **Review run proposal**, read the exact inputs/actions, then **Run approved**.
5. Watch progress. Switch to the demo tab to inspect the receipt; avoid clicking or typing into the page during replay because direct user input stops it.

Use **Stop run** to interrupt further actions. Completed actions are not undone. If a run fails after submission, inspect the page before making another request; the extension never automatically retries the action.

For a second demo, turn on **Alternate layout** before replay. Labels stay the same while controls move. Turn on **Duplicate snapshot button** to demonstrate an ambiguity stop. Keep these toggles outside the teaching trace.

## Native Gemini / WebMCP

The content script uses the browser's actual `document.modelContext.registerTool` API. There is no polyfill, custom chatbot or Gemini API key.

When native registration succeeds, the extension publishes:

- `bridge_probe`: a harmless callback that returns and stores a fresh diagnostic receipt.
- `bridge_describe`: a bounded description of supported visible controls; input values are omitted.
- `bridge_status`: the run status for this tab.
- One named tool for each saved workflow on the current origin.

Ask native Gemini to invoke `bridge_probe` and return its receipt. A matching receipt establishes a callback happened; it does not independently authenticate the caller. A real Gemini invocation must be observed before claiming that integration works.

Saved workflow calls create a **pending proposal**. Review and approve it in the extension studio. Gemini can query `bridge_status` afterward. Tools cannot approve themselves, and argument changes require a new proposal.

If native registration is unavailable, event teaching, compilation and explicitly approved replay from the studio remain usable as separate capabilities. That does **not** establish native Gemini compatibility. Browser support may require an eligible build, a development flag or origin-trial configuration. This MVP does not enroll or inject trial tokens. See [Chrome's current WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp).

### Optional Model Context Tool Inspector

The user approved using the official [Model Context Tool Inspector](https://chromewebstore.google.com/detail/webmcp-model-context-tool/gbpdfapgefenggkahomfgkhfehlcenpd) as a development/demo tool. It is a separately installed extension; none of its code is bundled in Workflow Bridge.

Once the inspector and native WebMCP are enabled in a permitted browser environment:

1. Enable Workflow Bridge on the demo page and check that native tools registered.
2. Open the inspector on that same page and look for `bridge_probe`, `bridge_describe`, `bridge_status` and any saved workflow tools.
3. Manually invoke `bridge_probe` with `{}`. Compare its returned receipt ID with the ID displayed by Workflow Bridge.
4. Invoke the saved workflow with its exact parameter names, for example `{ "resource": "OrdersDB", "retention_days": 14 }`.
5. Confirm that the result requests human review and no replay starts before approval. Approve in Workflow Bridge's studio, then inspect the UI receipt and `bridge_status`.

This verifies the native tool provider and replay path through an inspector. An inspector's model chat is a separate client; success there must not be described as verified built-in Gemini-in-Chrome integration. Chrome's [official inspector guidance](https://developer.chrome.com/docs/ai/webmcp#imitate-agent-chat-with-the-inspector-extension) makes that distinction. Inspector installation grants and local feature configuration remain user-controlled.

## Supported scope and limits

- One recording and one active/pending run at a time; up to 60 actions and 20 stored workflows.
- Native labeled links, buttons, text-like inputs, selects, checkboxes and forms in the top-level document.
- Same-document application routes. Reload/full navigation closes the session; enable the page again. Cross-page resume is deliberately absent.
- Exact semantic targets and observed checks. No fuzzy AI repair, branching, arbitrary JavaScript, canvas automation, closed shadow DOM or cross-origin frames.
- Query strings and URL fragments are not used as route identity. Applications depending on them need additional support.
- Password, OTP, payment and other recognized sensitive controls are excluded. This is heuristic filtering, not a guarantee that every kind of personal data can be recognized. Review captured information before saving/exporting.
- Slow or changed UI may fail a bounded check. A completed replay means its recorded observable checks passed; it does not prove backend transaction semantics.
- Per-tab origin scope; no robust account/tenant isolation or enterprise policy layer in this MVP. Use a demo/test account for initial evaluation.
- Local extension storage persists workflows. Data returned to a native agent is subject to that provider's processing policies.
- Delete saved workflows or discard the current trace in the studio. Removing the extension removes its local storage.

## Verified demo

On October 4, 2026, Chrome 154 with the official Model Context Tool Inspector completed the teach → compile → native tool proposal → approval → six-action replay flow. The Inspector's Gemini 3.1 Flash-Lite chat also called the saved tool with new inputs; after approval, six UI actions completed and the demo showed the expected snapshot. Alternate layout passed; duplicate buttons stopped replay, and full reload revoked the page session. Built-in Gemini invocation is not verified. See [verification evidence](docs/VERIFICATION.md).

## Files and checks

`src/content.ts`, `src/dom.ts` and `src/provider.ts` provide the isolated page runtime. `src/background.ts` owns storage, proposals and approval. `src/workflow.ts` compiles and binds workflow data. `src/ui/` contains the popup/studio. `demo/` is an ordinary site with no recorder hooks or WebMCP tools of its own.

```sh
npm run build                     # TypeScript check + unpacked extension
node --check demo/app.js          # Demo JavaScript syntax
node --check scripts/serve-demo.mjs
```

The build inspects bundled module inputs and fails if any runtime source comes from `node_modules`. `dist/build-info.json` lists output assets and the empty runtime dependency inventory. The manifest requests only `activeTab`, `scripting` and `storage`.

- [Hackathon implementation plan](docs/superpowers/plans/2026-10-04-hackathon-mvp.md)
- [Implementation progress and verification](docs/IMPLEMENTATION_LOG.md)
- [Longer-term architecture](docs/MASTER_PLAN.md)
- [Platform research](docs/RESEARCH.md)

No automated test suite has been created. The source is published to a private GitHub repository for this hackathon project.
