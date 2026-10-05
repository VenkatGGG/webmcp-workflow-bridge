# Decisions and acceptance gates

The gates below describe the original longer-term design. The current [hackathon plan](superpowers/plans/2026-10-04-hackathon-mvp.md) narrows implementation to a minimal extension, one same-document workflow at a time and build/manual checks without unit tests. Native Gemini consumption remains unverified; see [implementation progress](IMPLEMENTATION_LOG.md).

## Confirmed by the user

- Build for third-party websites through a browser extension; site-owner JavaScript changes are not the V1 approach.
- Use the existing browser-native agent, specifically Gemini in Chrome as the first target.
- Store learned transitions and allow users to save workflows.
- Capture structured UI events and relevant DOM state only. No screen recording, screenshots, video, pixel analysis or screen-capture permissions in the extension.
- Zero third-party runtime dependencies. Build/test tooling is allowed.
- Use a new repository; preserve the previous project.

## Recommended design decisions

- Chrome desktop, one approved HTTPS origin and one active tab per workflow initially.
- Observe ordinary DOM controls; expose reviewed capabilities and current-state actions.
- Native WebMCP only for the actual agent-facing route. Missing support is reported as unsupported, never hidden behind a polyfill/custom chat.
- Prefer isolated-world registration if the exact browser/agent combination supports it; use minimal MAIN-world registration only when measured compatibility requires it.
- Preserve UI-only application execution from the original idea: no endpoint discovery, network replay, framework-private stores, or direct business APIs.
- Store an observed, guarded state graph; save a versioned parameterized path/subgraph as a workflow.
- Extension popup/options page owns review/approval. No second chat UI and no requirement to displace Gemini's panel.
- Run authorization is separate from document execution leases. Calls outside an exact grant or explicitly configured bounded standing policy create pending proposals; navigation cannot self-renew authority.
- Workflows use a restricted typed binding/predicate language. Parameters propagate into target identity and completion checks; first-demonstration observations require review before becoming executable assertions.
- Commands have identities and lease generations. Worker recovery reconciles surviving executors, and Stop remains pending until further dispatch is fenced or the document is gone.
- Start with search, navigation, structured reads and draft preparation. Enable one reversible committed operation only after approval/recovery gates pass.
- Original TypeScript/JavaScript, browser APIs, Web Components/HTML/CSS and SVG. No React, state-machine, automation, schema, graph, storage, or MCP runtime packages.
- No product code has yet been implemented. These recommendations remain a plan, not measured results.

## Gates

| Gate | Evidence required | If it fails |
|---|---|---|
| G0 Native compatibility | Real native-Gemini invocation of an original extension-registered tool; no-inspector positive control; missing-support negative control; tested trial/flag/channel matrix | Record platform blocker. Do not market a replacement agent as the requested result. |
| G1 Bounded activation | Origin grant/revoke, document identity, extension privilege boundary, no secret capture | Stop before exposing capabilities. |
| G2 Useful actions | Verified DOM actions across semantic fixtures and two independent permitted third-party sites | Publish a narrower supported subset or fix adapters. |
| G3 Learning and saving | Observed graph, typed bindings, visible review, versioned JSON export/import; success evidence not inferred from click | Keep trace as a draft; no executable workflow. |
| G4 Replay and recovery | Held-out inputs/UI variations, navigation checkpoints, concurrent invocation rejection, uncertain-write handling | Pause/mark unknown; do not retry mutations. |
| G5 Pilot readiness | Frozen scenario suite, real-browser/native-agent results, artifact dependency audit, privacy checks and recovery drills | Do not call the extension production-ready. |

The browser agent can use its own UI automation outside our tools. Our policy governs our executor, not all Gemini behavior. Expanding that authority would require an independently designed browser/enterprise control layer.
