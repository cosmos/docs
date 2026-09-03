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
