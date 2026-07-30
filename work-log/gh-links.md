# release-versioning-v55

Doc updates for the Cosmos SDK v0.55 release cut. Upstream references verified against `cosmos-sdk@release/v0.55.x`.

## 2026-07-29 (GitHub ref audit: tooling, and a bug the tool caused)

Built `scripts/versioning/check-github-refs.js` plus `check-github-refs.test.js` (40 fixture tests) and `.claude/skills/update-stale-refs/`. Both documented in `scripts/versioning/CLAUDE.md`, and the release sequence in the root `CLAUDE.md` now calls the checker at step 2 instead of describing a manual grep.

Applied 386 rewrites across 106 files, then reverted 42 of them. The revert is the important part of this entry.

### The tool produced the bug it was built to prevent

Hunk-offset mapping assumes git's diff alignment is semantic. For a heavily rewritten file git aligns on textual similarity instead, so a line can sit outside every hunk while no longer meaning the same thing. Mapping `node/node.go` from v0.34.x to v0.40.x returned L684 and L730; the semantically correct lines were L699 and L764. L684 is an RPC listen-address check and L730 is a bare `return nil`, neither related to the prose. The links resolved, so nothing would have surfaced it.

Caught by the adjudicating subagent, which read the whole page as the skill requires and checked two links the checker had already auto-fixed rather than only the ones it flagged.

Fix: `minorGap()` plus `MAX_ANCHOR_GAP = 1`. Any anchored link whose ref gap exceeds one minor version is now flagged rather than rewritten, on the grounds that one version of drift is tractable and six is not. 42 rewrites were reverted under that rule: 22 SDK spanning v0.50.x to v0.55.x, 20 CometBFT spanning v0.34.x or v0.38.x to v0.40.x.

Also fixed three bugs found by reading before the tool ever ran: a pure-insertion hunk shifted a line it should not have; a bare URL ending a sentence pulled the trailing period into the path; and an unanchored link, being a string prefix of the anchored link to the same path, caused the short URL's rewrite to strand the long one's line number.

### Outcome

| | SDK | CometBFT |
| --- | --- | --- |
| now on the shipping ref | 192 | 156 |
| retained, flagged | 56 | 24 |

Retained refs and why they stay, so nobody re-investigates:

- 52 at `release/v0.50.x` on `modules/group/README.mdx`. `x/group` did not move to `./contrib` as the changelog implies; at v0.55.x it is at `enterprise/group/x/group/` under an evaluation-only licence rather than Apache 2.0. The page is a verbatim copy of the upstream README, and upstream itself still pins these to v0.50.x. Retargeting would point public module docs at restrictively licensed source and would diverge from the file it is synced from. Needs a maintainer decision, options recorded below.
- 4 at `release/v0.54.x`. One is `x/bank/migrations/v2/store.go#L55`, correctly pinned: the package is deleted at v0.55.x, the link resolves, and the prose calls it an example of a past migration. The other is `RELEASE_PROCESS.md`, which 404s today and needs a decision on where to point.
- 24 CometBFT anchored links spanning two or more minor versions, held back by the new gap guard pending hand verification.

The 48 `main` links carrying line anchors and the 22 pinned-ref drift cases are reported, not fixed, per the agreed scope. The `main` combination has no correct maintenance strategy: the ref moves continuously so the anchor is wrong within days and the link never breaks to say so.

### Group README observations, no edit made

`sdk/latest/modules/modules.mdx` misclassifies several modules after v0.55: Circuit and NFT are listed as SDK-maintained but moved to `contrib/x/`, `x/params` is listed as deprecated but is removed outright, and Group is listed as Supplementary though it is Enterprise. Reclassifying is editorial intent, so it was left alone. Separately, the 15 `go reference` fences on the group README render as empty code blocks: upstream uses a fence type that embeds the referenced source and the docs conversion dropped it, so the code was never rendered regardless of which ref the URL carried.

## 2026-07-29 (ref audit completed: hand verification of the gap-guarded anchors)

All 23 anchors held back by the gap guard were verified by hand against both refs, using the `update-stale-refs` skill via subagents. Result: 12 URL corrections applied, 11 deliberately retained, zero prose changes.

### CometBFT: fully current

All 180 version-tracking links now point at `v0.40.x`. Twelve were corrected by hand:

- `blocksync/pool.go#L168` to `#L232`. `IsCaughtUp` moved; L168 was `pool.sendError` inside `removeTimedoutPeers`, so this anchor had been wrong since before the freeze.
- `node/node.go#L563` to `node/setup.go#L459`. `createTransport` changed file; the three anchored lines are byte-identical.
- `node/node.go#L974` to `#L699` and `#L1023` to `#L764`, the two the mapper had got wrong.
- `node/node.go#L987` to `#L712`. Another pre-existing mis-anchor: the prose describes the `DialPeersAsync` call for persistent peers, but L987 at v0.34.x was the comment `// Start the transport.`, which is the subject of a different page. Repointed at the line the sentence actually describes.
- `rpc/core/net.go#L47` to `#L51` and `#L87` to `#L94`; `netaddress.go#L258` to `#L259`. Ordinary shifts, each confirmed by reading both files.
- `ed25519.go#L36`, `socket_server.go#L20`, `local_client.go#L13`, `Dockerfile#L11`: ref bumped, line number unchanged and confirmed identical at both refs.

Worth noting how few of these were simple drift. Of twelve, three were anchors that had been pointing at the wrong construct for years, and only one was a plain line shift. A ref sweep surfaces mis-anchoring as a side effect.

### SDK: 26 links deliberately left at release/v0.50.x

Verified, not bumped, for a reason that only became clear on inspection: the line numbers were already wrong at v0.50.x. They are inherited from v0.47-era files. `x/auth/tx/config.go#L22-L28` is exactly `NewTxConfig` at v0.47.x but a fragment of `type config struct` at v0.50.x, and `evidence.proto#L12-L32` addresses a line past the end of a 31-line file. Ten of the eleven ranges in the auth and evidence batch either straddle two declarations or truncate one.

Three further facts make bumping the wrong move:

- Upstream still pins these to `release/v0.50.x` with the same numbers, on both `release/v0.55.x` and `main`. These pages are conversions of upstream READMEs, so editing here forks them and a future content re-sync reverts it.
- Shifting the numbers literally would faithfully preserve a known-wrong snippet. Re-anchoring to the named construct gives the right code but is not a mechanical transform, so the checker can never reproduce it.
- Mintlify does not fetch these blocks. Upstream uses a fence type that embeds the referenced source; the docs conversion turned it into a code block containing a `// Reference: <url>` comment. So a wrong range costs click-through only and cannot make a rendered page wrong.

Correct ranges are recorded should anyone want them: `client/tx_config.go#L26-L36` and `#L38-L56`, `x/auth/tx/config.go#L67-L87`, `vesting.proto#L12-L39`, `#L41-L50`, `#L52-L60`, `#L62-L72`, `#L74-L83`, `#L85-L94`, `evidence.proto#L12-L31`, `x/evidence/keeper/infraction.go#L13-L155`.

The remaining 15 at v0.50.x are the `x/group` cluster, still pending the licensing decision recorded in the previous entry.

### Two accuracy problems found, no edit made

Both are spec-authoring questions rather than link fixes, and the skill's prohibition on adding prose applies.

- `cometbft/latest/spec/abci/Requirements-for-the-Application.mdx` claims a global lock means ABCI messages "are received in sequence, one at a time". At v0.40.x `local_client.go` has three lock-free paths: `CheckTx` skips the mutex under `IsLockFreeContext`, and `InsertTx` and `ReapTxs` are documented thread-safe and take no lock. Both are now part of the exported `Application` interface and the mempool connection, so the guarantee no longer holds across the whole ABCI surface. The page does not mention either method.
- `sdk/latest/modules/evidence/README.mdx:231` says evidence reaches the application as ABCI `Evidence` in `abci.RequestBeginBlock`. That type was removed in CometBFT 0.38 and SDK 0.50; it is `FinalizeBlock` now. Upstream text.

Also unrelated but adjacent: `cometbft/latest/docs/core/Using-CometBFT.mdx:529` uses `"cometbft/PubKeyEd25519"` where every other sample on the page, and the upstream constant the page links, use `"tendermint/PubKeyEd25519"`.

### Verification

`npx mint broken-links` clean. `latest`/`next` parity 0 unexplained diffs for both products. 40/40 fixture tests pass. No headings changed, so no anchor slugs are affected. Drift backlog written to `work-log/drift-backlog.md`.

## 2026-07-29 (ref audit: final state)

Reversed the earlier decision to leave the auth, vesting and evidence links at v0.50.x. The subagent had verified the correct v0.55.x ranges by reading both refs, so retaining a known-wrong anchor to preserve parity with an upstream file that is also wrong was the weaker choice. All 11 re-anchored to the named construct rather than shifted literally, since ten of the eleven original ranges either truncated a declaration or straddled two:

`client/tx_config.go#L26-L36` and `#L38-L56`, `x/auth/tx/config.go#L67-L87` (was pointing at a `type config struct` fragment, not `NewTxConfig`), `vesting.proto#L12-L39`, `#L41-L50`, `#L52-L60`, `#L62-L72`, `#L74-L83`, `#L85-L94`, `evidence.proto#L12-L31` (was addressing L32 of a 31-line file), `x/evidence/keeper/infraction.go#L13-L155`.

Consequence to be aware of: these three pages are conversions of upstream READMEs which still carry the old numbers on `main`, so a future content re-sync will revert this. The durable fix is a PR upstream against the reference fences.

Two other links resolved:

- `x/bank/migrations/v2/store.go#L55-L76` moved from `release/v0.54.x` to the `v0.54.0` tag. The package is deleted at v0.55.x and the prose presents it as an example of a past migration, so a pinned tag states that intent. A version-tracking ref on a branch that no longer contains the file only looked like drift.
- The dead `RELEASE_PROCESS.md` link now points at `/sdk/latest/release-family`, the docs' own canonical lifecycle page, which self-describes as the source of truth for support windows and retirement. Upstream deleted the file with no replacement, so pinning to v0.53.x would only defer the rot. Also drops a first-person "our" in passing.

### Final state

| | on shipping ref | retained |
| --- | --- | --- |
| SDK | 214 | 30 |
| CometBFT | 180 | 0 |

The 30 retained are 15 links, mirrored across `latest/` and `next/`, all on `sdk/modules/group/README.mdx`. They stay pending a decision that is not a documentation call: at v0.55.x `x/group` lives at `enterprise/group/x/group/` under an evaluation-only licence rather than Apache 2.0, so retargeting would point a public module page at restrictively licensed source. All 15 anchor relocations are verified and recorded should option B be chosen. Options are in the earlier entry.

Verified: `broken-links` clean, `latest`/`next` parity 0 for both products, 40/40 fixture tests, noindex invariants intact (0 in `latest/`, all in `next/`). No headings changed, so no anchor slugs are affected.

## 2026-07-29 (ref audit: closed out)

The last 15 `release/v0.50.x` links on `modules/group/README.mdx` are now pinned to the `v0.50.13` tag. This resolves the category without touching the licensing question.

The reasoning is the same as the `x/bank/migrations` link earlier in the sweep. A version-tracking branch ref implies the page follows that branch, so once the branch is superseded the link reads as drift. These are not drift, they are a deliberate citation: `x/group` as it shipped in the final SDK release that carried it under Apache 2.0. A pinned tag says that outright.

`x/group/types.go` and `proto/cosmos/group/v1/tx.proto` are byte-identical between `release/v0.50.x` and `v0.50.13` (same md5, same line counts, 629 and 394 lines), so every anchor is preserved exactly and no line number moved. Spot-checked one rendered link at 200.

This deliberately does not decide the licensing question, and leaves both remaining options open: retargeting to `enterprise/group/x/group/` at v0.55.x with the 15 verified relocations, or retiring the page in favour of the existing `sdk/latest/enterprise/group/` set. Either can be done later without redoing this work.

### Closing state

Zero superseded version-tracking refs in `sdk/{latest,next}` and `cometbft/{latest,next}`. 214 SDK links on `release/v0.55.x`, 180 CometBFT links on `v0.40.x`. Everything else is either a pinned historical citation or a `main` ref, both of which are categories the sweep does not bump.

Verified: `broken-links` clean, `latest`/`next` parity 0 for both products, 40/40 fixture tests, noindex invariants intact. Drift backlog at `work-log/drift-backlog.md`.

Still open and genuinely editorial, recorded so they are not rediscovered: the `x/group` page's future (retarget or retire), the ABCI concurrency claim that v0.40.x's three lock-free paths have made too strong, and `evidence/README.mdx:231` citing `abci.RequestBeginBlock`, removed in SDK 0.50.

## 2026-07-30 (line-anchor audit: x/staking, x/gov)

Repointed all 34 upstream GitHub links on `sdk/{latest,next}/modules/staking/README.mdx` and `sdk/{latest,next}/modules/gov/README.mdx` from `v0.47.0-rc1` to `release/v0.55.x`, re-deriving every line range from the proto files at the new ref rather than carrying the old numbers forward. Fifteen ranges moved, eight were unchanged by coincidence, and one already-v0.55.x range was tightened off a second declaration. Every range now spans one complete declaration (or the same declaration group the prose describes) including its doc comment, verified against the fetched files.

The 34 old ranges were, contrary to expectation, all clean at `v0.47.0-rc1`: each began at a doc-comment line and ended on a closing brace. The one exception was the `MsgBeginRedelegateResponse` link, which started one line early on a blank line. So the failure mode here was purely drift, not sloppy anchors.

Also bumped the gov ADR-037 link off `main` to `release/v0.55.x`, where `docs/architecture/adr-037-gov-split-vote.md` still resolves.

No prose was edited. Four accuracy defects were found and are recorded rather than fixed, three of them inherited from upstream and so at risk of being reverted by a content sync:

- `gov/README.mdx` claims gov parameters live in a `GlobalParams` KVStore. At v0.55.x they are a single `collections.Item[v1.Params]` under `ParamsKey` (prefix 48). Upstream says the same thing.
- `gov/README.mdx` documents `DepositParams`, `VotingParams`, and `TallyParams` as the live parameter set. All three carry `option deprecated = true` at v0.55.x and the module reads `Params`. Upstream unchanged.
- `gov/README.mdx` table of contents links `#software-upgrade`, a heading the page does not have. Dead in-page anchor, inherited from upstream.
- `staking/README.mdx` table of contents omits `MsgRotateConsPubKey`, a section this repo added locally. Upstream has neither, so a Contents sync would keep dropping it.

Separately, the `### HistoricalInfo` section of `staking/README.mdx` carries a 400-line inline copy of the whole `staking.proto` fenced as `go expandable`, where upstream references only `staking.proto#L17-L24`. The inlined copy is partly stale: `types.Dec` and `types.Int` custom types instead of `cosmossdk.io/math`, leftover `Since: cosmos-sdk 0.46` comments, and no `ConsKeyEvidenceExpiry`. That is a conversion defect, not a link, and is left for a decision on whether to trim it to the `HistoricalInfo` message.

Both `release/v0.55.x` upstream module READMEs still carry the original `v0.47.0-rc1` links with the original line numbers, so these corrections are local and a future upstream sync will reintroduce the stale refs.

## 2026-07-30 (line-anchor audit: x/authz, x/feegrant, x/group)

Repointed all 32 upstream GitHub links on `sdk/{latest,next}/modules/authz/README.mdx`, `.../feegrant/README.mdx`, and `.../group/README.mdx` to `release/v0.55.x`, re-deriving every line range from the files at the new ref. The authz and feegrant links were pinned to `v0.47.0-rc1`; the group links to tag `v0.50.13`.

`x/group` does not exist at `x/group/` on `release/v0.55.x`. The module lives at `enterprise/group/x/group/` with its protos at `enterprise/group/proto/`, so all 15 group links were repathed as well as rerefed, and switched from `/tree/` to `/blob/` so the line anchors resolve. That source carries `SPDX-License-Identifier: CosmosLabs-Evaluation-Only` under `enterprise/group/LICENSE`, not Apache 2.0, so the page now links readers at code they cannot use commercially. The page's existing Enterprise warning callout covers this, but the licence status of the linked source is not stated anywhere.

Three old ranges were defective rather than merely drifted: authz `MsgExec` (`tx.proto#L52-L63`) cut the message's closing brace; feegrant `BasicAllowance` (`feegrant.proto#L15-L28`) stopped inside the `spend_limit` field and omitted `expiration`; feegrant `MsgRevokeAllowance` (`tx.proto#L41-L54`) straddled `MsgGrantAllowanceResponse` and `MsgRevokeAllowance`. The group `DecisionPolicy` link (`x/group/types.go#L27-L45`) started mid-`DecisionPolicyResult` and truncated the `DecisionPolicy` interface the prose promises. All 14 group proto ranges were clean at `v0.50.13` and moved only by the enterprise relocation's 13-line licence header.

No prose was edited. Verified accurate at v0.55.x and left alone: the authz `BeginBlock` pruning cap of 200, the authz 20-gas grant-queue and 10-gas stake-authorization iteration costs, both authz state key prefixes, the feegrant `EndBlock` pruning and both queue prefixes, the feegrant 10-gas filtered-message cost, the authz CLI's `send|generic|delegate|unbond|redelegate` type list, and the group page's 14 Msg Service entries, two decision policies, and `EndBlock` tallying.

Accuracy defects found and recorded rather than fixed:

- `feegrant/README.mdx:83` says "There are two types of fee allowances present at the moment" above a list of three. `AllowedMsgAllowance` has its own section further down the same page.
- `feegrant/README.mdx:36` glosses `allowance` as `BasicAllowance` or `PeriodicAllowance`; the proto comment and the page's own section list include `AllowedMsgAllowance`.
- `feegrant/README.mdx` Messages section omits `Msg/PruneAllowances`, which the module exposes and whose event the page's own Events section already documents.
- `authz/README.mdx:282` describes `StakeAuthorization`'s `AuthorizationType` as delegate, undelegate, or redelegate. The enum has a fourth value, `AUTHORIZATION_TYPE_CANCEL_UNBONDING_DELEGATION`, which `Accept` and `normalizeAuthzType` both handle. The CLI does not expose it, so the CLI section is correct as written.
- `sdk/latest/modules/group/README.mdx` substantially duplicates `sdk/latest/enterprise/group/`: `architecture.mdx` repeats the same Group, Group Policy, Decision Policy, Proposal, and Pruning concepts, and `api.mdx` repeats the same 14 Msg Service entries, events, and REST endpoints. Left in place pending a decision on the page's future, already open in this log.

The authz and feegrant embedded `go expandable` code blocks are `v0.47.0-rc1`-era snapshots: CometBFT still imported as `tendermint/tendermint`, `sdkerrors.Wrapf` for wrapping, `SetTip`/`GetTip` on the tx wrapper where the shipping proto marks `Tip` deprecated, and a `StakeAuthorization.Accept` switch missing the `MsgCancelUnbondingDelegation` case. Conversion defects rather than links, left for the same decision as the staking `HistoricalInfo` block.

## 2026-07-30 (module and CometBFT page sweeps, by subagent)

2026-07-30

- Repointed every upstream GitHub reference on ten SDK module pages (`distribution`, `bank`, `circuit`, `nft`, `upgrade`, `crisis`, `mint`, `slashing`, `evidence`, `auth/auth`) from `v0.47.0-rc1` and `main` to `release/v0.55.x`, with each line range re-derived from the file at that ref. `circuit`, `crisis`, and `nft` protos now resolve under `contrib/proto/`, matching their move to `contrib/x/`. Sixteen of the twenty-two anchored ranges shifted, and four were already malformed at the old ref: the distribution `FeePool` range truncated the closing brace and dropped the doc comment, and all three `circuit` ranges straddled message boundaries, with one pointing past end of file. Normalized `tree/` to `blob/` on file links. Synced all ten pages to `next/`.
- Left the `adr-031` URL in the circuit page's `msg_service_router.go` excerpt at `blob/main`: it is verbatim upstream source, unchanged at the release ref.
- Repointed the remaining floating and commit-pinned upstream references on ten CometBFT pages to `v0.40.x`: the four links pinned to commit `af3bc47` in the Byzantine consensus algorithm and WAL specs now carry re-derived struct ranges (`Vote`, `Commit`, `ValidatorSet`, `autofile.Group`, all four of which had shifted), the `abci/server` example link moved off the dead `master` branch, and the RFC-100, light-client spec, and ADR-025 references moved off `main`. Prose on all ten pages checked against the code at that ref and found accurate. Synced to `next/`.
- Repointed nine SDK pages (`node/run-node`, `node/txs`, `learn/concepts/baseapp`, `learn/concepts/testing`, `release-family`, `tutorials`, `guides/abci/app-mempool`, `guides/reference/bech32`, `upgrade/v0.55-release`) from `main` to `release/v0.55.x`, adding the verified `BaseApp` struct range. Synced to `next/`, which also carried four `release/v0.54.x` links on the run-node and baseapp pages forward.
- Left two historical citations pinned: the CometBFT QA v0.37 and v0.38 pages cite the CHANGELOG of the exact alpha tag each campaign tested, and the upgrade guide's `migrateBalanceKeys` example is pinned to `v0.54.0` because `x/bank/migrations/` no longer exists upstream. Pinned the same QA v0.38 page's end-to-end framework link to `v0.38.0-alpha.2` rather than letting it float on `main`.
- Open: the upgrade guide's `Migrator` example is built on `x/bank/migrations/v2`, `v3`, and `v4`, none of which exist at `release/v0.55.x`; `x/staking` is the remaining module with a live `Migrator` and `migrations/v6`. Left for a maintainer decision. The two `changelog/release-notes` pages point at `blob/main/CHANGELOG.md`, which is generated by `manage-changelogs.js` and correct for "full release history".

## 2026-07-30

- Repointed every GitHub reference on the six Cosmos Enterprise pages (`sdk/latest/enterprise/overview`, `enterprise/group/overview`, `enterprise/poa/{overview,architecture,governance,distribution}`) from `main` and a pinned commit SHA to `release/v0.55.x`, and re-verified each line anchor against the code at that ref. 22 of the 23 anchored links had drifted, several landing in license headers or import blocks. Synced to `sdk/next/`.
- Adjudicated the prose behind those links against `release/v0.55.x`. Confirmed-false claims reported for maintainer review rather than applied: PoA validator creation is admin-only and carries an initial power (the pages describe it as permissionless and power-zero); the validators collection is an indexed map keyed by consensus address with operator and power secondary indexes (the pages describe a `(power, consensus_address)` composite primary key); the PoA module account is mandatory, since `EndBlocker` panics at block 1 when the ante handler fee recipient is not the PoA module (the pages describe it as recommended with a `fee_collector` fallback); and the tally constructor is `NewPOACalculateVoteResultsAndVotingPowerFn`, not `NewPoA...`.
- Left the vote-extension warning on `enterprise/poa/architecture` unverified. The claim is about a CometBFT interaction that the module source neither states nor contradicts.


## 2026-07-30 (ref sweep: outcome and what is deliberately not on the shipping ref)

Every GitHub link in `sdk/latest`, `sdk/next`, `cometbft/latest` and `cometbft/next` was tested. 160 links were corrected across six page clusters, each new target confirmed to return 200 with its line range re-derived from the file at the shipping ref, and every touched page synced to `next/`.

Final distribution in `latest/`: SDK 250 of 313 on `release/v0.55.x`, CometBFT 105 of 109 on `v0.40.x`. The remainder is deliberate:

- 60 in ADR and RFC pages. Per maintainer instruction these are liveness-checked only, not made current: an architecture decision record legitimately cites code as it stood when the decision was taken. All 60 return 200. Two that did not were repointed to the newest ref where the path still exists, `x/group` to `release/v0.53.x` and a building-modules doc to `release/v0.46.x`, the latter with its `#queries` anchor confirmed present.
- Two `changelog/release-notes.mdx` pages cite `main/CHANGELOG.md`. The sentence promises the full release history, which only `main` carries, and the URL is emitted by `manage-changelogs.js` rather than written on the page.
- Three CometBFT QA citations stay pinned to the alpha tag each campaign actually tested. Bumping them would make the sentences false. One companion link on the same page was moved off floating `main` onto the matching tag for the same reason.
- `guides/upgrades/upgrade.mdx` keeps `v0.54.0` for `migrateBalanceKeys`. `x/bank/migrations/` does not exist at v0.55.x, and the prose is already past tense about a historical migration.
- `modules/circuit/README.mdx` keeps a `main` URL that sits inside a verbatim copy of `baseapp/msg_service_router.go`. Rewriting it would falsify the code excerpt.

### What the sweep found beyond stale refs

Line drift was the smaller problem. Anchors that had been pointing at the wrong thing for years were the larger one:

- On the Enterprise PoA pages, 22 of 23 anchored links had the wrong line, several landing inside a licence header or an import block, even though `main` and `release/v0.55.x` are byte-identical for those files.
- Four ranges on the module pages were malformed at the ref they already carried: the distribution `FeePool` range truncated its closing brace, and all three `circuit` ranges straddled message boundaries, one running past end of file.
- `spec/abci/Client-and-server.mdx` pointed at `master`, a branch that no longer exists on `cometbft/cometbft`. It was a broken link, not a stale one.
- By contrast the large `v0.47.0-rc1` cluster on staking and gov was almost entirely well-formed, 34 of 35 ranges bounding their construct correctly. That cluster was pure version drift, which contradicted the expectation set by the earlier `v0.50.x` findings.

### Upstream sync exposure

The module reference pages under `sdk/latest/modules/` are conversions of upstream READMEs, and those READMEs still carry the original stale URLs byte-for-byte at `release/v0.55.x`. Corrections to staking, gov, authz, feegrant, group and the ten smaller module pages will be reverted by the next content sync unless the same fix lands upstream first.

Related: `sync-latest-to-next.js` copies these links verbatim, so `next/` now cites `release/v0.55.x` while documenting the unreleased version. Harmless while the two are close, and the next freeze re-bumps them, but it means `next/` does not point at the branch it describes.

### Prose defects found, reported and not applied

21 items. Most consequential are on `enterprise/poa/`, where the pages describe the module incorrectly rather than merely linking to the wrong line: validator creation is admin-only rather than permissionless and the admin sets initial power; the validators collection is an indexed map keyed by consensus address, not a `(power, consensus_address)` composite requiring re-keying; and the PoA module account is mandatory, because `EndBlocker` panics at block 1 when the ante handler's fee recipient is not the PoA module, where the page calls it recommended with a `fee_collector` fallback.

Also confirmed false against code: `x/gov` has no `GlobalParams` store, `x/crisis` and `x/mint` params are protobuf-encoded under prefix `0x01` rather than Amino under a `mint/params` key, and `x/feegrant` has three allowance types where the page says two.

Open editorial questions recorded separately: the upgrade guide's `Migrator` walkthrough is built on `x/bank/migrations/v2` through `v4`, none of which exist at v0.55.x, with `x/staking`'s `migrations/v6` the natural replacement; and `modules/group/README.mdx` duplicates `sdk/latest/enterprise/group/` at 2168 lines against 918.

## 2026-07-30

- Applied the approved PoA prose corrections from the ref sweep to `sdk/latest/enterprise/poa/` and synced to `next/`. Validator creation is now described as admin-only with the admin setting initial power; the validators collection is described as an indexed map keyed by consensus address with operator-address and power indexes, and the Collections Schema table rows for prefixes 1 to 3 were corrected to match `keys.go`; validator updates now say they take effect in the next block, which also removes a self-contradiction with the Gaining Consensus Power section.
- `distribution.mdx`: the PoA module account is documented as required rather than recommended, because `EndBlocker` panics at block 1 when the ante handler's fee recipient is not the PoA module. Removed the false `WithFeeRecipientModule` backwards-compatibility sentence and the `fee_collector` fallback claim.
- `governance.mdx`: corrected the tally function name to `NewPOACalculateVoteResultsAndVotingPowerFn`, the keeper method to `GetValidatorByOperatorAddress`, the error string casing to "active POA validator", and the `AfterProposalSubmission` hook parameter to `proposerAddr`.
- The Collections Schema table was deliberately left at prefixes 0 to 5; prefixes 6 to 8 (`queuedUpdates`, `validatorAllocatedFees`, `lastCommittedPower`) exist in `keys.go` but adding them was out of scope.
- Applied the approved SDK module prose corrections from the ref sweep and synced all nine files to `next/`. `gov/README.mdx`: removed the false `GlobalParams` KVStore sentence, collapsed the three deprecated `DepositParams`/`VotingParams`/`TallyParams` reference blocks into one `Params` block matching the single param set the module actually reads, retargeted the threshold prose from `TallyParams` to `Params`, dropped the Contents entry for a `Software Upgrade` heading that does not exist, and added a missing Contents entry for `Constitution`.
- `crisis/README.mdx` and `mint/README.mdx`: params are documented as protobuf-encoded under prefix `0x01` rather than Amino under a `mint/params` key. The mint page previously contradicted itself, since adjacent prose already gave the correct prefix.
- `feegrant/README.mdx`: three allowance types rather than two, and the `Grant` description no longer names only two of them.
- `staking/README.mdx`: added the missing `MsgRotateConsPubKey` Contents entry, which other pages already link to. `authz/README.mdx`: added the fourth `StakeAuthorization` type, cancelling an unbonding delegation. `distribution/README.mdx`: removed two "Response:" labels sitting above request messages. `slashing/README.mdx`: repointed a `/sdk/v0.47/build/` fee-distribution link at `latest/`.
- `node/run-node.mdx`: two reproduced `app.toml` comments realigned with `server/config/toml.go`, the `minimum-gas-prices` denom separator and the `max_txs` no-op mempool qualifier.
- Not applied: the proposed bump of the remaining non-ADR `main`/`master` links to `release/v0.55.x`. All five are `cometbft/cometbft` URLs, not Cosmos SDK ones, and CometBFT has no `release/v0.55.x` branch, so the bump would have replaced four working links with 404s. Left at `main`/`master`, which resolve.
- Left in place: the `load(GlobalParams, 'TallyingParam')` mention in the gov page's tally pseudocode. It is the last trace of the removed store and was outside the approved scope.
