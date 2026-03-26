# consolidation-final

## 2026-03-25

- Added key schemes table (secp256k1 / secp256r1 / tm-ed25519) to `sdk/next/advanced/bech32.mdx` — only place secp256r1 was documented
- Deleted `sdk/next/learn/beginner/accounts.mdx` — content fully covered by `concepts/accounts` and `advanced/bech32`; fixed 9 backlinks
- Moved `sdk/next/build/spec/addresses/bech32.mdx` to `sdk/next/advanced/bech32.mdx`, added new "Advanced" nav section after Tutorials; fixed 1 backlink
- Deleted 5 pages and removed from docs.json nav, fixed all backlinks:
  - `sdk/next/learn/advanced/baseapp.mdx` → links updated to `concepts/baseapp`
  - `sdk/next/learn/beginner/tx-lifecycle.mdx` → links updated to `concepts/lifecycle`
  - `sdk/next/learn/beginner/query-lifecycle.mdx` → links updated to `concepts/lifecycle`
  - `sdk/next/learn/beginner/app-anatomy.mdx` → links updated to `intro/sdk-app-architecture`
  - `sdk/next/learn/intro/sdk-design.mdx` → links updated to `intro/sdk-app-architecture`
- Deleted `sdk/next/learn/advanced/transactions.mdx` — content covered by `concepts/transactions`, `concepts/encoding` (sign modes), and `user/run-node/txs` (TxBuilder/broadcasting); fixed 9 backlinks
- Deleted `sdk/next/learn/advanced/config.mdx` — nearly empty; node config covered in `user/run-node/run-node`; updated tutorials.mdx card to point to `run-production`
- Deleted `sdk/next/learn/advanced/context.mdx` — fully covered by `concepts/context-gas-events`; fixed 8 backlinks
- Deleted 5 deprecated pages and fixed backlinks: `building-apps/app-go-di`, `building-apps/runtime`, `building-modules/depinject`, `building-modules/invariants`, `packages/depinject`
- Fixed stale `DeliverTx` references in `msg-services.mdx` and `telemetry.mdx` — replaced with `FinalizeBlock` (confirmed against cosmos-sdk source)
- Tightened `autocli.mdx`: removed duplicate gov example (~130 lines), fixed keyring interface path, fixed method_added_in description; verified all claims against cosmos-sdk source
- Deleted `sdk/next/learn/advanced/cli.mdx` — merged Configurations (PersistentPreRun, InterceptConfigs, custom logger) and Environment Variables sections into `autocli.mdx`; removed Note blocks and redundant intro from `autocli.mdx`; fixed backlinks in `module-manager.mdx`; removed from docs.json nav
- Deleted `sdk/next/build/building-modules/module-interfaces.mdx` — legacy Cobra CLI patterns; added "Hand-Written Commands" section to `autocli.mdx` covering when/how to use manual commands; fixed 6 backlinks in `cli.mdx`, `messages-and-queries.mdx`, `intro.mdx`; removed from docs.json nav
- Removed deprecated feature mentions across sdk/next: `app_di.go` → `app.go` in `prepare-proposal.mdx`, `process-proposal.mdx`, `simulation.mdx`; removed `RegisterInvariants` prose bullet points from `module-manager.mdx`; removed depinject mention from `autocli.mdx`

## 2026-03-26

- Verified and corrected `autocli.mdx` line-by-line against cosmos-sdk source and example chain: fixed grammar, `appOptions` → `autoCliOpts` in wiring example, `*autocliv1.RpcCommandOptions{` struct literal syntax (×2), `FlagsOptions` → `FlagOptions`, non-module commands description, hubl broken link, `NewAutoCLIKeyring` error return
- Replaced 3 outdated large code blocks in `autocli.mdx` with source links: gov `autocli.go`, auth `autocli.go`, cmtservice `autocli.go`; converted root command reference code block to prose link
- Rewrote Application Wiring section to match real pattern (`app.AutoCliOpts()` + `autoCliOpts.ClientCtx`) verified against example chain `root.go`; fixed non-module commands description to show both `Modules` and `ModuleOptions` approaches
- Verified and corrected `protobuf-annotations.mdx` line-by-line against cosmos-sdk source: fixed signer link (`v0.50` → `next`), replaced 4 reference-only code blocks with actual proto snippets + correct line numbers (ValidatorAddressString L87→L108, Dec L26→L17, Int L137→L127), fixed "Decimals" label → "Dec", fixed `method_added_in` example to show all three annotation types with correct version format (no "v" prefix), fixed amino Name example (`BaseAccount` → `MsgSend` to match bank tx.proto#L41), fixed Field_Name example (field number 1→3, value `public_key`→`creation_height`), fixed Dont_OmitEmpty reference (bank.proto#L56 → tx.proto#L48), fixed Encoding link (json_marshal.go#L65 → #L85); updated all commit-hash links to `release/v0.53.x` branch links
- Deleted `sdk/next/learn/advanced/encoding.mdx` — content fully covered by `concepts/encoding.mdx` (transaction encoding, interface encoding, sign modes, amino) and `build/building-modules/protobuf-annotations.mdx` (Gogoproto section); fixed 9 backlink occurrences across 7 files with anchor-aware redirects; removed from docs.json nav
