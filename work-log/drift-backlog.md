# Upstream link backlog

Regenerated after the v0.55 / v0.40 ref sweep. Counts are for `latest/` only; `next/`
mirrors it. Produced by `scripts/versioning/check-github-refs.js` and
`scripts/versioning/verify-links-live.js`.

## Release surface is clean

Every `cosmos-sdk` and `cometbft` link in `latest/` and `next/` returns 200, and no line
anchor points past end of file. 450 of 459 unique URLs verified 200 directly; the other 9
were rate-limited rather than failing. Set `GITHUB_TOKEN` before running the live verifier
to avoid that, which raises the GitHub limit from 60 requests an hour to 5,000.

SDK: 237 links on `release/v0.55.x`. CometBFT: 105 on `v0.40.x`, with nothing flagged.

## Open: six dead third-party links

These are not cosmos or cometbft repos, so the tree-based checker never saw them; only the
live verifier catches this class. All sit in ADR pages, where the repository being cited has
since moved or restructured.

| page | dead URL |
| --- | --- |
| `sdk/latest/reference/architecture/adr-009-evidence-module.mdx:217` | `cosmos/ics/blob/master/ibc/1_IBC_ARCHITECTURE.md` |
| `sdk/latest/reference/architecture/adr-009-evidence-module.mdx:23` | `cosmos/ics/blob/master/ibc/2_IBC_ARCHITECTURE.md` |
| `sdk/latest/reference/architecture/adr-042-group-module.mdx:30` | `regen-network/regen-ledger/tree/master/proto/regen/group/v1alpha1` |
| `sdk/latest/reference/architecture/adr-042-group-module.mdx:30` | `regen-network/regen-ledger/tree/master/x/group` |
| `sdk/latest/reference/architecture/adr-042-group-module.mdx:34` | `regen-network/regen-ledger/tree/master/orm` |
| `sdk/latest/reference/architecture/adr-062-collections-state-layer.mdx:86` | `NibiruChain/nibiru/blob/master/x/perp/keeper/keeper.go#L31` |

## Open: 20 ADR and RFC links not made current

Architecture decision records legitimately cite code as it stood when the decision was taken,
so these are liveness-checked only and not bumped. All return 200. Listed so the state is
recorded rather than rediscovered.

| verdict | page | target |
| --- | --- | --- |
| `drift` | `architecture/adr-041-in-place-store-migrations.mdx:94` | `x/bank/legacy/v043/store.go#L41` @ `36f68eb9e041` |
| `drift` | `architecture/adr-050-sign-mode-textual.mdx:329` | `tx/textual/internal/testdata/e2e.json#L2` @ `094abcd39337` |
| `drift` | `architecture/adr-050-sign-mode-textual.mdx:330` | `tx/textual/internal/testdata/e2e.json#L71` @ `094abcd39337` |
| `drift` | `architecture/adr-059-test-scopes.mdx:40` | `x/auth/client/testutil/suite.go#L44` @ `0f7e56c6f910` |
| `drift` | `architecture/adr-059-test-scopes.mdx:101` | `x/evidence/testutil/app.yaml#L1` @ `2bec9d202191` |
| `drift` | `architecture/adr-059-test-scopes.mdx:102` | `x/evidence/keeper/infraction_test.go#L42` @ `2bec9d202191` |
| `drift` | `architecture/adr-059-test-scopes.mdx:106` | `tests/integration/bank/keeper/keeper_test.go#L129` @ `8c23f6f957d1` |
| `path-gone` | `architecture/adr-030-authz-module.mdx:30` | `x/group` @ `release/v0.5` |
| `path-gone` | `architecture/adr-038-state-listening.mdx:25` | `docs/building-modules/messages-and-queries.md` @ `release/v0.4` |
| `unassessed` | `architecture/adr-022-custom-panic-handling.mdx:18` | `baseapp/baseapp.go#L539` @ `bad4ca75f58b` |
| `unassessed` | `architecture/adr-027-deterministic-protobuf-serialization.mdx:36` | `proto/cosmos/tx/v1beta1/tx.proto#L30` @ `9e85e81e0e81` |
| `unassessed` | `architecture/adr-027-deterministic-protobuf-serialization.mdx:38` | `proto/cosmos/tx/v1beta1/tx.proto#L13` @ `9e85e81e0e81` |
| `unassessed` | `architecture/adr-047-extend-upgrade-plan.mdx:28` | `proto/cosmos/upgrade/v1beta1/upgrade.proto#L12` @ `v0.44.5` |
| `unassessed` | `architecture/adr-059-test-scopes.mdx:69` | `x/bank/keeper/keeper_test.go#L94` @ `2bec9d202191` |
| `unassessed` | `architecture/adr-059-test-scopes.mdx:89` | `testutil/sims/app_helpers.go#L95` @ `2bec9d202191` |
| `unassessed` | `architecture/adr-059-test-scopes.mdx:95` | `client/grpc_query_test.go#L111` @ `2bec9d202191` |
| `unassessed` | `architecture/adr-059-test-scopes.mdx:98` | `baseapp/grpcrouter_helpers.go#L31` @ `2bec9d202191` |
| `unassessed` | `architecture/adr-059-test-scopes.mdx:101` | `x/evidence/keeper/keeper_test.go#L101` @ `2bec9d202191` |
| `unassessed` | `architecture/adr-059-test-scopes.mdx:128` | `types/module/simulation.go#L31` @ `2bec9d202191` |
| `unassessed` | `rfc/rfc-001-tx-validation.mdx:14` | `types/tx_msg.go#L16` @ `16a5404f8e00` |

Two of those were 404 and were repointed at the newest ref where the path still exists,
`x/group` to `release/v0.53.x` and a building-modules doc to `release/v0.46.x`.

## Deliberate pins, not backlog

- `guides/upgrades/upgrade.mdx` cites `migrateBalanceKeys` at the `v0.54.0` tag. `x/bank/migrations/` does not exist at v0.55.x and the prose is past tense about a historical migration.
- Pages under `<product>/latest/upgrade/` and `<product>/latest/changelog/` keep their own version's refs. A v0.54 upgrade guide citing the v0.54 changelog is correct, and the checker now refuses to bump them.
- Three CometBFT QA pages cite the CHANGELOG of the exact alpha tag each campaign tested.
- One `main` URL in `modules/circuit/README.mdx` sits inside a verbatim copy of upstream source; rewriting it would falsify the excerpt.

## Not in scope: 34 dead links in archived directories

Almost all in `cometbft/v0.37/`, and of two kinds: paths under `tendermint/tendermint` that
stopped existing after the rename to CometBFT, and third-party ABCI implementations that have
since restructured. These pages carry `noindex`, so there is no search impact, and archived
directories are not edited. Recorded only because this sweep was the first thing to look.

## What no tooling catches

`npx mint broken-links` checks internal page paths only. It does not request external URLs and
does not validate heading anchors. `check-github-refs.js` infers liveness from the git tree, so
it only sees the two product repos and cannot tell that a `#Lnnn` anchor points past end of
file, because GitHub clamps rather than erroring. `verify-links-live.js` covers both gaps and
is the only check that sees third-party links.

