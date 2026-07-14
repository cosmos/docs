# security-release

## 2026-07-14

- Added sdk/next/keys/rotate-validator-key-poa (PoA rotation: keygen, submit, cutover timing, admin path), grounded in PR cosmos/cosmos-sdk#26590 (branch poa-rotation, enterprise/poa/docs/key-rotation.md); provisional until that PR merges
- Updated key-rotation's Staking and PoA chains section with the PoA differences (admin path; no fee, rate limit, rotation history, or delay) and linked the new page; registered the page in docs.json between rotate-validator-key and migrate-validator-ml-dsa
- Readability pass on sdk/next/keys/migrate-validator-ml-dsa (split overlong sentences, imperative verify step); no technical or structural changes
- Readability pass on sdk/next/keys/rotate-validator-key-poa (split overlong sentences in intro, step 3, and callouts; tightened wording); no technical or structural changes
- Resolved migrate-validator-ml-dsa's PoA link TODO now that rotate-validator-key-poa exists
- Briefly rewrote rotate-validator-key-poa's cutover to the staking-style second-node flow, then reverted to the module runbook's watch-then-swap after weighing the tradeoffs (second-node infra cost, enterprise change control, missed blocks near-free on PoA); open question with Matt whether to add the shadow flow as an alternative and whether PoA tracks liveness

## 2026-07-10

- Added a new Key Management group to the SDK next nav in docs.json, after Run a Node, with four new pages
- Added sdk/next/keys/: post-quantum-keys (key roles and algorithms survey, ML-DSA explanation), enable-ml-dsa-keys (genesis and governance paths; governance flow test-verified on a local simapp chain), key-rotation (concept page for consensus key rotation, ADR-016), rotate-validator-key (zero-downtime rotation procedure; test-verified on a local simapp chain)
- Pages for the rest of the ledger security release (PoA rotation, user accounts, remote signing) are outlined but pending code that lands with the release; links to them are omitted until the pages exist
- Added sdk/next/keys/migrate-validator-ml-dsa (thin how-to composing the enable and rotation pages); step 1 keygen command is an open TODO pending release tooling (comet gen-validator and init are ed25519-only in current checkouts), marked as an MDX comment in the page
