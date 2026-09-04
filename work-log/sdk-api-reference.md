# sdk-api-reference

A generated API reference for the Cosmos SDK: gRPC query services, transaction messages, and the REST gateway routes. Generated from `cosmos-sdk` protos and upstream's gateway spec at a pinned commit, for both `latest` and `next`.

Branch was originally named `rpc-endpoints`. Renamed, because it does not ship a CometBFT RPC method reference and the old name promised one.

## 2026-09-02 (new section: generator, pages, and live verification)

### What exists now

`scripts/api-reference/sync-sdk-api-reference.js` plus `lib/{descriptor,render,openapi,checks}.js`, roughly 1,000 lines. One run produces, per version:

- `sdk/<version>/api-reference/grpc/<module>.mdx`, 21 pages, from a `buf build` descriptor
- `sdk/<version>/api-reference/rest/openapi.yaml`, from upstream's gateway Swagger converted to OpenAPI 3.0
- the `API Reference` tab in `docs.json`, rewritten in place

Three pages are hand-written: `api-reference/index.mdx` (interaction surfaces, ports, `app.toml` flags), `api-reference/grpc/index.mdx` (reflection recipes, scalar encodings), and `api-reference/transactions.mdx` (build, sign, broadcast).

Nothing is a hand-maintained list. The repository and released version come from `versions.json`; the module set, service set, ordering, headings, anchors, sidebar labels and nav entries all fall out of the descriptor. Generation is deterministic: two runs at one SHA produce byte-identical output, which is what makes a weekly diff meaningful.

### Queries and transaction messages are presented differently, on purpose

`baseapp/grpcrouter.go` registers `Query` services into the router that port 9090 serves. `baseapp/msg_service_router.go` registers `Msg` services into a router consulted only during transaction delivery. A `Msg` method is not reachable on 9090, so it gets a type URL, a signer, an Amino name and a transaction JSON body, and deliberately no `grpcurl` example.

### Live testing found twelve defects that reading could not

Four agents exercised the pages against Cosmos Hub and against a local simapp built at the documented commit, restricted to reading only the rendered pages. Before: 5 of 25 gRPC methods callable from the page alone. After: 15 of 19, and 27 of 30 REST operations.

Seven defects were in generated content, so each was wrong on every page at once:

| Defect | Effect |
| --- | --- |
| enums rendered `{}` | vote transactions rejected; `VOTE_OPTION_YES` appeared nowhere in the reference |
| `Any` rendered `{typeUrl, value}` | every governance proposal rejected |
| `Duration` rendered `{seconds, nanos}` | `MsgUpdateParams` rejected |
| `bytes` rendered `<bytes>` | `illegal base64 data`, on `AllBalances`, in 13 of 22 pages |
| camelCase response schemas | 2,008 properties disagreed with every real response |
| `uint64` as a number, and `0` for ids and heights | examples that error on paste |
| deprecated field beside its replacement | silently queried account 0 |

Five were prose. `cosmos.Dec` was undefined, so `DelegationRewards` returning `5915273237378841699511248` reads as 5.9 quintillion rather than 5.9 ATOM. `bytes` encoding was unstated, and passing hex does not error, it base64-decodes and yields a valid-looking wrong address. The transactions page named the chain ID, account number and sequence as required without saying where to get them; used a bech32 address where `--gas auto` needs a keyring key; and recommended `--gas-adjustment 1.3`, which produces `code: 11` out of gas on a plain `MsgSend`.

`cosmos.Dec` took three attempts. It has three wire forms on gRPC, distinguished per field by `gogoproto.customtype` and the proto type, and the REST gateway renders all three as a plain decimal string. The same field returns `"50000000000000000"` over gRPC and `"0.050000000000000000"` over REST.

### Upstream defects worked around

Upstream's generated `swagger.yaml` is not tested by anything in `cosmos-sdk`: no test file references it. Consequently:

- two `gov` routes share the `operationId` `GovV1Proposal`, which would silently collapse two Mintlify pages into one. Operation IDs are now derived from the descriptor
- two `auth` routes differ only by path parameter name, which OpenAPI forbids in one document. One is dropped, loudly
- `summary` fields carry entire multi-paragraph proto comments, and Mintlify builds filenames from them. The longest overran the filesystem limit and crashed the build with `ENAMETOOLONG`
- annotations write `{account_id}` where the generated spec writes `{accountId}`, so the join normalizes to the JSON name

These are worth reporting upstream. The duplicate `operationId` breaks anyone generating a client from that spec.

### Guards over the parts that cannot be derived

Some facts live outside the protos: what `cosmos.Dec` means, how a well-known type is represented in JSON, what a transaction envelope carries. Those stay hand-written, and their completeness is enforced. Generation fails, naming the missing item, when a scalar annotation appears with no definition on the gRPC page, when a specification-defined JSON type has no representation in the renderer, or when a `cosmos.tx.v1beta1` envelope field goes unmentioned on the transactions page.

Each guard was added because the corresponding list had already gone stale. `cosmos.ConsensusAddressString` was undefined an hour after the scalar table was written, and v0.55 added `unordered`, `timeout_timestamp` and `tip` to the envelope without the page noticing.

Generated pages are also pruned: a module removed upstream has its page deleted, so output can shrink as well as grow.

### Tests

`scripts/api-reference/test/`, 39 tests, no network, 77ms. Synthetic descriptors rather than captured fixtures, so a test can describe upstream changes that have not happened: a module removed, a method added, a proto version appearing beside an old one. Every encoding defect above is a regression test.

### Known gaps

- REST schemas now set `additionalProperties: false` (182 strict, 50 exempt for carrying an `Any`), which makes conformance testing meaningful. `required` cannot be derived, because proto3 omits defaults
- 9 of 48 transaction examples carry an `Any` placeholder that is not a real message
- `staking`'s `status` request field is a plain `string` upstream, so it does not auto-link to the `BondStatus` enum documented on the same page
- `AccountAddressByID` documents a parameter that returns a wrong address with a 200; the parameter that works, `account_id`, is undocumented upstream
- no path parameter carries an `example`, so the REST playground cannot be fired without the reader supplying a value

## 2026-09-02 (verification: three runners, and the defects they found)

### What now checks the reference

| Command | Proves | Needs |
| --- | --- | --- |
| `npm test` | 40 unit tests, every defect class plus module add and remove | nothing |
| `npm run verify-examples` | 274 payloads parse; 43 of 48 through the SDK's own codec | buf, optionally simd |
| `npm run conformance` | 106 of 108 REST responses match the published schemas | a chain |
| `npm run smoke` | 15 representative commands actually run | a chain |

Verification runs against a local simapp built at the documented commit, so a failure is a real defect rather than version skew. The public Hub runs v0.53.4 against pages documenting v0.55, which produced false failures worth discounting in earlier rounds.

### cosmos.Dec took four attempts and is the lesson of the project

The annotation names one convention and the wire carries four, split across two axes. Proven on simapp at the documented version:

| Path | `"0.05"` | `"50000000000000000"` |
| --- | --- | --- |
| `simd tx encode` | is 0.05 | rejected as over 100% |
| `POST /cosmos/tx/v1beta1/encode` | decodes to `0.050000000000000000` | decodes to `50000000000000000.0…` |
| gRPC `TxEncode` | rejected | round-trips, means 0.05 |

The same string means different numbers depending on which codec reads it, so no per-field sentence can be correct. Field notes now carry the read form, which varies by field, and the write form is stated where the reader acts: the transaction-messages preamble names transaction JSON, the query preamble names protobuf JSON.

Each earlier attempt was wrong in a different direction, and each was caught only by executing against a chain. Reading the protos could not have found any of them.

### Further generator defects, all found by execution

`oneof` fields rendered every member set at once, which the parser rejects outright. An epoch-zero `Timestamp` placeholder looked like a real value and produced `expiration must be after the current block time`. Deprecated enum values were offered as examples, so `BroadcastTx` suggested the removed `BROADCAST_MODE_BLOCK`. Eight messages were unbuildable because `Any` fields showed a fake type URL and the concrete options appeared nowhere; those are now derived from `accepts_interface` and `implements_interface`. A claim that two messages could not be Amino-signed was disproved on chain and removed.

### Schema corrections were landing in the wrong place

`additionalProperties: false` had been applied to the 242 component schemas, but upstream inlines response schemas per operation and almost nothing references components, so a validator never saw the constraint. Walking each operation's own response against its message raised conformance from 78 passing to 106. Four operations use a `$ref` and were skipped silently until the corrections learned to follow references.

The gateway also emits `null` where proto3 has no null, for unset message fields and empty `bytes`, so 948 properties are marked nullable per field rather than blanket.

### Upstream drift is now caught without a chain

Generation compares each response schema against its own message and reports fields the protos define and the spec omits. Two are outstanding, both v0.55 additions upstream never picked up:

```
/cosmos/staking/v1beta1/params.params.key_rotation_fee
/cosmos/auth/v1beta1/params.params.sig_verify_cost_mldsa65
```

Both confirmed present in real responses. Reported as a warning, since upstream lagging its own protos is normal and should not block a docs build. Worth reporting upstream: anyone generating a client from that spec is missing the same two fields.

### Automation, and its ceiling

A weekly workflow regenerates both versions, verifies, and opens a PR summarising added and removed methods. A guard failure opens an issue rather than reddening a cron nobody watches.

What no check can do is distinguish a wrong documented value from missing chain state. The `cosmos.Dec` defect returned a business error, indistinguishable from a chain with no validator configured. That judgment needs a person, and is worth repeating when the SDK version changes.

## 2026-09-03

Committed as `be4aaf74`: 76 files, the generator and its checks, 21 gRPC pages and an OpenAPI spec for each of `latest` and `next`, plus the API Reference tab in `docs.json`.

- Added two page-driven on-chain runners, `query-onchain.py` (123 queries) and `tx-onchain.py` (48 messages), sharing `pagefill.py`. They supersede the earlier approach: placeholders are filled from what the page states, following its field tables and type links, never from the proto descriptor. A filler that reads the descriptor can pass while the page tells a reader to write a value the chain rejects, which is what happened with `cosmos.Dec`.
- Added `query-coverage.toml` and `tx-coverage.toml`, holding only what cannot be derived: preconditions, which key signs, and the gaps where a page genuinely cannot help. Diffed against the pages every run, so a removed method surfaces as an orphan, and `skip` entries are still probed so a stale entry cannot understate what works. That mechanism caught five entries being too pessimistic.
- Corrected `cosmos.Dec` a fifth time, reversing the previous fix. In transaction JSON every `Dec` is a decimal string whatever its proto type; base64 is only a read form over gRPC. Proven directly: `bytes`-Dec as decimal accepted, as base64 rejected with `failed to set decimal string with base 10`. The generated example was also emitting `""` for those fields, which a reader copying verbatim would hit as `decimal string cannot be empty`.
- Fixed `staking.Validators.status`, where the `BondStatus` values sat on the page unconnected to the field. Exactly one field in the SDK matches the rule, so it names a real relationship rather than a guess.
- Amino name now shown on all 48 transaction messages rather than only where it deviates, described in terms of hardware wallets rather than a specific vendor.
- Added the weekly workflow, `.claude/launch.json`, and a step 2b in the root `CLAUDE.md` regenerating the API reference before a freeze. Both the schedule and that step's contents are revised by the design below.
- Three Schemathesis crash-cache files under `scripts/api-reference/.schemathesis/` were committed by accident. They are run artifacts and should be removed and gitignored.
- Added `scripts/api-reference/DESIGN.md`, recording the invariant the tooling follows and the eight agreed hardening changes. Chief among them: `sync` has no `--ref` override, so a freeze publishes `main`-generated content under the new release's version number, and the on-chain runners derive their own denominator from the page parse, so a render change can silently drop a method from the test set and still exit 0.
- Design decision recorded: no scheduled regeneration. Docs versions freeze at release, `latest` must not change between releases, and the release process itself is the gate.

### The release gate is one command

`release-check.py` runs the whole thing: regenerate, unit tests in both languages, example encoding, then conformance, every documented query and every documented message against a chain built from the commit the pages themselves record. `chain.py` does the building, in a working directory of its own, and tears the node down on failure as well as success.

The chain deliberately avoids every default port (RPC 26667, REST 1318, gRPC 9091, P2P 26666, pprof 6061). The obvious reason is that a developer chain on the same machine would block it from binding. The reason that matters is the other one: if the harness fails to start and the runners still find a chain on the defaults, the gate reports somebody else's chain state as the documentation's and passes.

Two portability defects in the transaction runner only became visible once the gate owned the chain:

- The fee denom was hardcoded to `ustake` while the runner already discovers the chain's bond denom for message amounts. On a chain whose stake token is named anything else, all 37 messages failed the ante handler with `insufficient funds`, which reads as 37 documentation defects and is none.
- Two coverage entries named `dave`, a key out of one machine's keyring, as the validator operator's signer. They now name the role, `validator`, which `tx-onchain.py` resolves from `--validator-key`.

With both fixed the transaction runner reports 37 success, 9 known gaps, 1 skip and one finding.

The workflow lost its schedule. It keeps `workflow_dispatch`, and now defaults to `next` alone, because `latest` is frozen between releases and regenerating it outside one rewrites published pages.

### The two drifted response fields are now repaired, not reported

`findSchemaDrift` already knew that `sig_verify_cost_mldsa65` and `key_rotation_fee` are defined in the protos and absent from upstream's swagger. The generator reported them and then published a schema it knew was incomplete, marked it `additionalProperties: false`, and conformance duly failed on a real response. Two-sided: the gate could never go green, and anyone generating a client from the spec was missing both fields.

`correctResponseSchemas` now adds a descriptor-known field that upstream omits, in the same pass that marks schemas strict and nullable, building the schema from the field's proto type. It only ever runs where upstream declared no property at all, so it cannot change how an operation upstream did describe is represented. The drift report stays, because upstream lagging its own protos is still worth knowing and still worth raising there, but it now names what was repaired. A second drift pass after the repair throws if anything is left, so the two can never disagree again.

Both versions regenerated. The whole change to `latest` is those two fields.

### The gate goes green

`release-check` now ends with `All checks passed. Safe to freeze.` Conformance passes 3023 of 3023 generated cases, `query-onchain` reports 84 pass and no findings, `tx-onchain` 38 success and no findings.

`signer = "validator"` is verified rather than assumed: the runner compares the validator key's `--bech val` address against the operator address the chain reports and refuses to broadcast on a mismatch. The earlier fallback to `--from` would have signed the two validator-only entries with an arbitrary account and recorded a page defect that is not one, which is the same class of noise as the fee denom.

`MsgUnjail` no longer claims `state-error`. Under `--broadcast-mode sync` the runner reads CheckTx's code, so a message that clears the ante handler and then fails in execution reports 0, and the whole `state-error` class is unassertable until the runner reads the delivered code back by transaction hash. The vocabulary comment now says so, and the entry asserts the outcome the runner can actually see.

### The repair is pinned by tests, and a map is an object

The synthesizer had no unit coverage: nothing under `test/` imported `correctResponseSchemas` or `findSchemaDrift`, so the suite passing said nothing about it and its only verification was one conformance run. `test/schema-repair.test.js` now covers each scalar class, an enum and its default, a nested message, repetition, maps, the well-known types, an Any, and every path where the synthesizer declines to describe something, plus the repair end to end on a miniature spec.

Writing them found the bug they were asked for. A `map<k,v>` is `LABEL_REPEATED` in the descriptor, so a map field was being wrapped in an array of the synthetic `{key, value}` entries that JSON renders as a plain object. It synthesizes as `{type: "object", additionalProperties: <value>}` now. Latent, since no map field drifts today.

A field the synthesizer cannot fully describe, a message absent from the descriptor or an unrecognised scalar, becomes an open object or a string. Conformance then accepts that subtree unconditionally and the post-repair drift check reports nothing, because the property does exist. It cannot mis-describe a response but it can under-describe one, so the repair now names what it declined and the generator warns. There are none today.

`tx-onchain.py` no longer crashes when an entry recorded `unfillable` becomes fillable, which is upstream supplying the example a page was missing and precisely the drift the manifest exists to surface. It was reaching `counts[expect] += ok` with a key the counter never had. It is reported as a stale manifest entry now, and not broadcast: what is wrong is the recorded expectation, not the page.

### Hardening, and moving the release procedure into a skill

- Added `--ref` to the generator, so a pre-freeze regeneration can be pointed at the release branch instead of always resolving `next` to `main`; without it, a freeze publishes development content under the new release's version number, which is the bug this closes.
- Added a names-only `inventory.json` beside the generated pages and a completeness guard in both on-chain runners, so a rendering change can no longer silently drop a method from the test set.
- Unified `query-coverage.toml` and `tx-coverage.toml` onto one manifest schema, `[cases."name"]`, with a per-runner `expect` vocabulary; `tx-coverage.toml`'s separate `[unfillable]` table folded into `expect = "unfillable"`.
- Moved error classification out of `query-onchain.py`'s code and into the manifest's `[errors]` table; an error the manifest does not recognize is now reported as `unclassified` rather than guessed.
- Added a findings file per run, with the terminal summary rendered from it. It is a run artifact and is never committed.
- Deleted `smoke.py`, folding its two negative assertions and two REST reads into `query-onchain.py`.
- Added `chain.py` and `release-check.py`: the release gate builds `simd` at the commit the pages record and runs everything against it, on non-default ports (RPC 26667, REST 1318, gRPC 9091) so it cannot collide with, or be mistaken for, a developer's own chain.
- The generator now repairs response schemas for fields the protos define and upstream's swagger omits, rather than warning and publishing a schema it knows is incomplete.
- Moved the release procedure out of the root `CLAUDE.md` (a third of a file loaded into every session, for something done three or four times a year) into `.claude/skills/release-version/SKILL.md`, which loads only when someone is doing a release. Corrected `scripts/api-reference/CLAUDE.md`'s command list and test counts (77 JS, 32 Python) and its testing-philosophy section, which had claimed exhaustive live execution was deliberately not attempted; it is now exactly what `query-onchain` and `tx-onchain` do. The weekly regeneration workflow lost its `schedule:` block, since docs versions freeze at release and a cron that can only report drift carries no decision.



## 2026-09-03 (review follow-ups)

- Transactions are now asserted on the delivered result rather than CheckTx. `--broadcast-mode sync` reports only the ante handler's verdict, so a message that paid its fee and carried a valid signature counted as a pass even when its module handler rejected it. The runner now reads the result back by transaction hash, which is the difference between the chain accepting an example and the example working. This supersedes the note above about `state-error` being unassertable: it is observable now, and `MsgUnjail` asserts it again.
- `skip` entries are probed. Both this file's manifest header and `DESIGN.md` promised that a skip is still attempted and an unexpected success reported, and the code returned before broadcasting. A documented mechanism that does not exist is worse than an absent one, because the manifest's value is that its claims are true.
- Pinned `peter-evans/create-pull-request` to a commit in the API reference workflow. That job holds contents and pull-request write, so a retargeted tag would run third-party code with them.
- Trimmed `api-reference/index.mdx` and `transactions.mdx` to interface facts and examples: 698 to 374 words and 1372 to 561. The troubleshooting layer was removed, including the gas-adjustment, account-number-zero, and protobuf-JSON-naming notes. They are recoverable from `cbcd8e63` if a troubleshooting page is ever wanted.
- Reviewed and rejected one automated finding: em dashes were reported in five added files, and there are none in any of them. The matches were CLI flags such as `--dry-run`.
- Reading the delivered result reclassified 27 of 48 transaction messages. Under CheckTx they reported success; on the delivered result, 12 are governance gated and rejected with `invalid authority`, and 15 fail in execution for want of chain state a fresh single-validator chain does not have. The gate now reports 11 success, 12 unauthorized, 15 state-error, 1 skip, 9 known gap.
- The governance classification is derived from the page, not enumerated. Each affected page already carries a generated note saying the signer is the governance module account, so the runner reads that and expects `unauthorized`. A message that becomes governance gated upstream classifies itself with no manifest edit.
- Four failures are documentation gaps rather than chain state, all upstream proto comment omissions worth raising against `cosmos-sdk`: `MsgVoteWeighted` in both gov versions requires option weights summing to 1.00, and `MsgGrantAllowance` and `MsgRevokeAllowance` require granter and grantee to differ. No field description states either constraint.
- Cut the per-page boilerplate from 402 words to 218, on 42 pages. The header carries provenance only; what a node actually serves is stated once beside the reflection command that answers it, rather than twice on every page. Two sentences were removed as wrong rather than long: the queries boilerplate asserted that a `cosmos.Dec` in a payload is the scaled integer string, which is the form it reads back in, not the form a reader writes, and contradicted both the field tables and `grpc/index.mdx`.
- Two phrases in the transactions boilerplate are load-bearing and carry comments in `lib/render.js` saying so. `pagefill.py` tests for the literal `decimal string such as "0.05"` to confirm the page states the Dec form, so rewording it makes every Dec field unfillable. The `bytes` clause covers the case that shipped wrong four times, where the write form and the read form differ.
- Dropped `app.mdx`. A module whose every method is deprecated is now excluded by the generator, which removed the page, its `docs.json` entry, and its inventory line without a blacklist. `upgrade.UpgradedConsensusState` stays with its warning: a deprecated method among live ones is worth identifying, a page that is nothing else is not. The filter requires at least one method, so a types-only module is not dropped on a vacuous truth.
- Simplified `grpc/index.mdx`, 126 lines to 97, and fixed a structural problem alongside it. Base64 rules, `pagination.next_key` encoding, denominations, `Any` discriminators and proto3 defaults were all sitting under a `cosmos.Dec` heading, where a reader looking for any of them would not find them. They now have their own section. Cut the protobuf primer, two of four reflection commands, the TLS example now carried by every module page's boilerplate, and one of two paragraphs making the same point about scaled decimals. The scalar table is unchanged: `checkScalarAnnotationsDocumented` fails the build if any of those five annotations lacks a definition on this page.
