# hub-v29

Moves the Hub `next` docs from gaia v28.3.1 to v29.0.1, the release mainnet runs since upgrade `v29.0.0` applied at height 33618500 on 2026-10-28 (proposal 1059). Claims were rerun on a local v29.0.1 devnet, against the v29.0.1 release assets, and with read-only queries to mainnet and the provider testnet.

## 2026-11-08

- Versions page: new component table for v29.0.1 (Cosmos SDK v0.53.8, CometBFT v0.38.25, cometbft-db v1.0.4, ibc-go v10.7.0, wasmd v0.60.9, Go 1.26.10), the upgrade paragraph, the testnet on v29.1.0-rc0, and the facts that changed: `x/params` removed, 21 old proposals that cannot be decoded on v29.0.x, the multisig gas limit, and the `v29_0_0` upgrade handler.
- Installation and reproducible builds: v29 ships bare binaries, not tarballs, and its `SHA256SUMS` file still lists the old archive paths, so `sha256sum --check --ignore-missing` verifies nothing. Replaced the steps with a check of the downloaded binary against the hash in that file, and documented the `v29.0.1+dirty` version string on the release binary and image (same file, commit 48c981b3).
- Governance: the full proposal list and `--proposal-status` filters fail on mainnet v29.0.x with `no concrete type registered for type URL /cosmos.params.v1beta1.ParameterChangeProposal`. Replaced the deposit and voting listings with `--page-reverse --page-limit 20` plus a jq status filter, and added a note.
- CLI output: proposal messages print as `{type, value}`, so the jq paths in the param-change, software-upgrade and community-pool-spend pages now read `.value`.
- Param change: legacy `ParameterChangeProposal` is rejected (`unable to resolve type URL`), `submit-legacy-proposal` has no `param-change` type, and `gaiad query params` is gone. `MsgUpdateParams` through governance is the only route, rerun end to end on the devnet.
- Multisig: `--gas auto` fails for a multisig sender with `bit array size is incorrect, expecting: 2`. Documented a fixed `--gas 200000` (a two-member multisig send used 128195).
- Modules: removed the params row, added `x/params` to the removed-modules list, and added it to the removed-features note on What is gaia.
- Fixed `gaiad --ledger` to `gaiad keys add <name> --ledger` on the delegators page, and `--page-limit` on the IBC client states example.
- Version swaps from v28.3.1 to v29.0.1 across 30 pages where the claim was rerun on v29.0.1. Left v28.3.1 where the text is historical (upgrade examples, history rows, an observation made on v28.3.1). HubVerified stamps changed only on pages that were fully rerun.
- `scripts/hub/release-check.py` (from the hub-upgrade-bot branch) passes on these pages against v29.0.1 and v29.1.0-rc0: 638 commands, with only the deliberate removed-command mentions allowed.
