# Research ledger

Research date: October 4, 2026 (America/Los_Angeles). These are platform observations, not promises of compatibility on a particular account. We read official documentation and standards material; we did not install, fork, or copy the implementations referenced below.

## Verified facts and their design consequences

| Evidence | Finding | Consequence |
|---|---|---|
| [Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp), updated October 1, 2026 | Proposed browser capability, available through origin trial/local testing; the inspector's Gemini chat is explicitly separate from Gemini in Chrome. | Separate API availability from native-agent availability. No inspector-only success claim. |
| [Chrome I/O announcement](https://developer.chrome.com/blog/chrome-at-io26), May 19, 2026 | Announced future Gemini-in-Chrome support for WebMCP. Also describes saved Chrome Skills. | An announcement is not a verified rollout. Differentiate this product through verified UI execution and learned contracts, not merely reusable prompts. |
| [Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api), updated September 21, 2026 | Current documented surface is `document.modelContext`; tools have schemas and executable callbacks. Registration/cancellation/lifecycle behavior has changed between Chrome versions. Execution can return null on navigation. | Pin tested browser builds and isolate the WebMCP transport. Do not rely on an old document's promise surviving navigation. |
| [WebMCP specification](https://webmachinelearning.github.io/webmcp/), current live draft | Community Group report rather than a W3C Standard; defines page tools and browser/author-provided agents. | Treat API evolution as a product dependency, not a solved interoperability guarantee. |
| [WebMCP Chrome Status](https://chromestatus.com/feature/5117755740913664) / [official feature data](https://chromestatus.com/api/v0/features/5117755740913664) | Current feature data includes third-party origin-trial support. Trial dates/version bounds are moving. | Test third-party trial enrollment for our extension, not only a development flag. Recheck trial validity at release. |
| [Extension origin trials](https://developer.chrome.com/docs/extensions/how-to/web-platform/origin-trials) | A manifest token alone does not enable a web feature in content scripts; Chrome documents third-party matching and page token injection. Stable extension identity matters. | API access on unmodified sites has a supported experimental path, but must be validated for this feature/build. Never present a flag-only experiment as broad availability. |
| [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) | Content scripts can observe/manipulate DOM; isolated and MAIN worlds have different access and CSP characteristics. | Prefer isolated execution for extension-owned logic. A page-world fallback must be small and unprivileged. |
| [Chromium ModelContext implementation](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/renderer/core/script_tools/model_context.cc) | Current source handles tool callbacks in their script world, including isolated-world cases. This source may be newer than installed Chrome. | Do not assume MAIN-world injection is mandatory. Probe isolated registration/discovery first on the exact target build. |
| [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) | Temporary access follows explicit user activation and has navigation boundaries. | Start with current-tab activation and optional per-site persistence; do not request blanket access at install. |
| [Chrome extension security](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure) | Content-script messages need validation and privilege containment. | Page/bridge messages cannot create approvals, expand origins, or retrieve cross-site extension data. |
| [WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools) and [agent security](https://developer.chrome.com/docs/agents/security) | Tool descriptions/results may carry untrusted content; hints communicate risk. | Enforce scope and approval in code. Treat descriptions/results as data, and use risk annotations as additional signals. |
| [WebMCP best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices) | Tool clarity, useful state-specific availability, validation, and restrained catalogs matter. | Publish a small number of capabilities appropriate to the current state. |
| [Extension worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) | Workers can stop; globals are not durable execution state. | Use transactional persistent checkpoints and explicitly reconcile uncertain dispatches. |
| [Chrome webNavigation](https://developer.chrome.com/docs/extensions/reference/api/webNavigation) | Frames and documents have distinct identities; navigation/BFCache affect lifecycle signals. | Bind work to document generations and reconcile on navigation/restoration. |
| [MDN isTrusted](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted) and [user activation](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation) | Synthetic DOM actions cannot manufacture trusted user input or arbitrary user activation. | Hand over privileged pickers/security prompts and unsupported controls; no debugger escalation in V1. |
| [MDN shadowRoot](https://developer.mozilla.org/en-US/docs/Web/API/Element/shadowRoot) and [same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy) | Ordinary DOM access has closed-root and cross-origin boundaries. | Explicit coverage limits, not an “all UIs” claim. |
| [GoogleChromeLabs tool-overrides experiment](https://github.com/GoogleChromeLabs/webmcp-tool-overrides) | Public experiment supplies page tools through an extension and disclaims official support. | Feasibility inspiration only. No dependency, copied implementation, endorsement, or evidence of native Gemini compatibility. |
| [MV3 remote code guidance](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code) and [store data requirements](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) | Distribution review concerns packaged executable code and user-data handling. | Audit the final artifact, keep the interpreter packaged, and prepare accurate permission/privacy disclosures before release. An unpacked demo is not store approval. |

## What remains unproven

1. Whether the user's actual Gemini-in-Chrome build/account consumes our extension's native tools.
2. Whether isolated-world registration works for that combination; MAIN is a measured fallback, not the default assumption.
3. Whether the third-party origin-trial path works without development flags on the intended release channel and approved origins.
4. Whether native Gemini reliably rediscovers tools after navigation and distinguishes `started` from verified completion.
5. What the native product exposes about invocation/cancellation/source identity. No stable caller-attestation API is assumed.
6. Compatibility with any specific third-party application's custom controls, lifecycle, authentication or authorization.

No local browser experiment was run during planning. Previous browser access restrictions were not bypassed.

## Platform compatibility record to produce in Gate 0

Record date; OS; exact Chrome build/channel; native Gemini feature/account availability; testing flag state; origin-trial mechanism/expiry; extension ID/build; target origin; page policy; registration world; tool IDs; observed native invocation; result; reload/navigation outcomes; cancellation outcomes; and raw evidence paths. Test both positive and negative controls. Redact account identities and secrets.

An observed invocation is functional interoperability evidence. It is not cryptographic proof that every future call originates from Gemini, or permission for arbitrary privileged extension work.
