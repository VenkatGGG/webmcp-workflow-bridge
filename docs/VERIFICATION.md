# Manual Chrome verification — October 4, 2026

Environment: Chrome 154.0.8037.95; official Model Context Tool Inspector 1.9.18; local Harbor demo at http://127.0.0.1:4174. Native WebMCP testing was already enabled. The local Workflow Bridge extension was installed with user authorization.

| Check | Observed result |
| --- | --- |
| Native discovery | Inspector listed bridge_probe, bridge_describe, bridge_status and the compiled workflow. |
| Native callback | bridge_probe returned receipt f92bb5de-0fec-4e73-a636-7ef03d00ec0c, also displayed by our popup/studio. |
| Event teaching | Six recorded actions: search input, resource link, Create Snapshot, retention input, Review Snapshot, Confirm Snapshot. No screen recording. |
| Compilation | Saved workflow_take_a_snapshot_45b16bfe with resource:string and retention_days:number. |
| Approval gate | Native invocation returned needs_user and proposal ddab486d-64ba-4574-a3c3-db087fc69615; no replay began until Studio approval. An earlier inspector placeholder proposal was rejected without running. |
| Changed inputs | Taught OrdersDB / 30; replayed PaymentsDB / 14 through the native proposal. Completed 6/6. Harbor receipt snap-944c6d49 showed PaymentsDB with 14-day retention. |
| Alternate layout | Studio proposal 2e387d55-5f46-462c-b90e-907d594badba replayed AnalyticsDB / 7. Completed 6/6; receipt snap-2d4def7f showed 7-day retention. |
| Ambiguous target | Proposal 3bed2b33-5d85-46ea-85e3-ef81f0b4fcab stopped after 2/6: Target is ambiguous; more than one control matches. Neither Create Snapshot button was clicked; AnalyticsDB retained two manual snapshots. |
| Full reload | Studio changed to 0 enabled pages; runtime did not silently resume. Re-enabling restored saved native tools. |
| Build | npm run build passed after the navigation fix: TypeScript plus four original bundles, zero third-party runtime modules. |

## Bug fixed during verification

The previous background handler treated every Chrome loading status as full navigation. Chrome reported loading during the demo’s History API transitions, causing recording to stop. The fix checks the original document-scoped runtime when loading completes and also revokes the session on pagehide. Both same-document continuity and full-reload revocation were observed in Chrome after the fix.

## Limits of this evidence

This is manual browser verification of this local demo, not an automated suite or general third-party-site certification. No unit tests were added or run. The inspector called native WebMCP handlers; built-in Gemini in Chrome was not invoked. A user-supplied Gemini credential was subsequently configured in the official inspector; it was not written to this repository. Neither provider discovery nor inspector success proves built-in Gemini compatibility. No claim is made about real infrastructure snapshots, cross-document replay, fuzzy label repair, cross-origin frames or arbitrary UI support.

The demo is left enabled at /resources, with duplicate/layout toggles off and the saved workflow available. Simulated snapshots created during verification remain visible.

## Inspector Gemini client follow-up

The user authorized configuring their Gemini credential in the official inspector. Its Send control became available. A prompt requested the saved workflow for OrdersDB with 21-day retention and instructed the model to stop at the approval gate. The selected Gemini 3.6 Flash model returned HTTP 503 UNAVAILABLE, reporting high demand, before an observed tool call. One retry was submitted; no successful model response or new workflow proposal was observed before ending verification. This is a provider-availability limitation, not evidence of successful model-driven execution. The previously verified manual native tool invocation remains valid. No credential is included in source or this report.

## Subsequent Gemini retry

The inspector still offered models only through Gemini 3.6 Flash, with no 3.8 Flash option. A new 3.6 Flash request visibly called workflow_take_a_snapshot_45b16bfe with resource OrdersDB and retention_days 21, then bridge_status. The workflow call correctly refused a duplicate because proposal 006d9f3e-00b5-4069-8d1f-e655d0c7c4c5 was already pending from an earlier attempt. That pending demo proposal was rejected without execution. A fresh request then returned HTTP 429 quota exceeded. Model selection and correct tool arguments are observed; a newly approved model-driven end-to-end run was not completed in this retry.

## Successful alternate-model run

The Inspector's Gemini 3.1 Flash-Lite chat called the native `workflow_take_a_snapshot_45b16bfe` tool with `resource: "OrdersDB"` and `retention_days: 21`. The tool returned `needs_user` with proposal `a9ee0314-bc12-43b8-aed6-a33dade1d3da`. The Studio displayed the exact inputs and six actions. After approval, it reported `complete`, `6 / 6 actions`, and `Replay finished; observed UI checks passed.` The Harbor demo showed `Snapshot created for OrdersDB`, 21-day retention, and receipt `snap-6078465d`. The Inspector model selector showed Gemini 3.1 Flash-Lite selected. This verifies a model-driven run through the Inspector's Gemini client; Chrome's built-in Gemini agent remains unverified.
