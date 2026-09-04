# scripts/api-reference

Generates the Cosmos SDK API reference: gRPC query services, transaction messages, and REST gateway routes, for `sdk/latest` and `sdk/next`.

## Commands

```bash
npm install                       # once, in this directory
npm run sync -- --version latest  # regenerate one version
npm test                          # 77 unit tests, no network, ~110ms
npm run test-py                   # 32 Python unit tests, no network
npm run verify-examples           # every JSON example parses against the protos
npm run conformance               # REST responses match published schemas (needs a chain)
npm run query-onchain             # all 123 documented queries actually run (needs a chain)
npm run tx-onchain                # all 48 documented transaction messages actually run (needs a chain)
npm run release-check             # the whole gate, on a chain it builds itself
```

`release-check` is the one command to run before a freeze. It regenerates, runs the
offline checks, builds `simd` from the exact commit the pages record, starts a chain
on its own ports, and runs every documented query and message against it. Needs Go,
Node, git and `schemathesis`; it says which are missing before it builds anything.
`--dry-run` copies the generated pages and `docs.json` aside, regenerates them in
place, reports what would change, then restores them from the copy. The tree ends
where it started, but it is rewritten while the run is in flight, so commit or
stash uncommitted generated work first. The run prints the scratch directory it
copied to, which is where the originals are if it is killed before restoring.

The harness chain runs on RPC 26667, REST 1318, gRPC 9091, P2P 26666 and pprof 6061,
none of them the default. A developer chain on the defaults is therefore neither
disturbed nor, far worse, mistaken for the chain under test when the harness fails
to start.

`sync` needs a `GITHUB_TOKEN` in practice. It resolves a branch to a commit SHA through the GitHub API, and unauthenticated requests are rate-limited to the point of failing silently mid-run.

## What is generated and what is not

Generated, and overwritten on every run:

```
sdk/<version>/api-reference/grpc/<module>.mdx    21 pages, from the proto descriptor
sdk/<version>/api-reference/rest/openapi.yaml    from upstream's gateway swagger
docs.json                                        the API Reference tab, rewritten in place
```

Hand-written, never touched by the generator:

```
sdk/<version>/api-reference/index.mdx            interaction surfaces, ports, app.toml
sdk/<version>/api-reference/grpc/index.mdx       reflection recipes, scalar encodings
sdk/<version>/api-reference/transactions.mdx     build, sign, broadcast
```

## Do not run sync-latest-to-next on generated files

`latest` and `next` are generated from different commits, so copying one over the other would publish `latest`'s content under `next`'s version stamp. Only the three hand-written pages are synced that way.

## Guards

Three facts cannot be derived from the protos, so they are written by hand and their completeness is enforced. Each guard fires because the corresponding list had already gone stale once.

| Guard | Fails when | Fix |
| --- | --- | --- |
| scalar annotations | a `cosmos_proto.scalar` annotation has no definition in `grpc/index.mdx` | add a row to the Scalar encodings table |
| well-known types | a type with a specification-defined JSON form has no entry in `WELL_KNOWN_JSON` | add its JSON representation to `lib/render.js` |
| transaction envelope | a `cosmos.tx.v1beta1` field is unmentioned in `transactions.mdx` | mention it |

A fourth condition is repaired rather than reported: response fields the protos define and upstream's spec omits. Upstream's swagger is generated separately from the protos and lags them, so this is expected, but publishing a schema known to be incomplete and then marking it strict fails conformance against a real response and short-changes anyone generating a client. The response-schema correction adds the field from the descriptor. The drift line still names what was repaired, currently two, both v0.55 additions, and a second pass after the repair fails the build if anything is left.

## Why some things are the way they are

**Operation IDs are derived, not taken from upstream.** Upstream assigns `GovV1Proposal` to two different gov routes. Mintlify builds page slugs from that field, so the collision would silently drop a page.

**Summaries are replaced with the method name.** Upstream puts entire multi-paragraph proto comments in `summary`, and Mintlify builds filenames from it. The longest overran the filesystem limit and crashed the build.

**Two `auth` routes are dropped.** They differ only in path parameter name, which OpenAPI forbids in one document. Both methods stay documented on the gRPC page.

**Response schemas are made strict and nullable.** Without `additionalProperties: false` nothing could fail a conformance run, because proto3 omits defaults so no field can be marked required. The gateway emits `null` for unset message fields and empty `bytes`, so those are marked nullable per field.

**Corrections follow `$ref`.** Four of the 108 operations reference a component instead of inlining their response. A correction that only walks inline schemas skips them silently.

**`buf convert` is not used for verification.** It drops unknown fields everywhere and exits 0, so a completely misspelled example passes. Python's `json_format` rejects them, including inside an `Any`, which matches what a node does.

## Testing philosophy

Every defect found in this reference was a class rather than an instance, because a generator makes the same mistake on every page. So the unit tests assert classes rather than instances.

Live execution is exhaustive: `query-onchain` runs all 123 documented queries and `tx-onchain` all 48 transaction messages, filled from what each page states. A command that cannot be used as written fails there, and the exceptions that genuinely cannot work are recorded in the manifests with a reason.

A transaction is asserted on the result the chain delivered, not on the broadcast's return. `--broadcast-mode sync` reports the ante handler's verdict, so a message that pays its fee and carries a valid signature reads as success even when its module handler rejects it. Reading the result back by transaction hash is what separates the chain accepting an example from the example working, and it moved 27 of 48 messages out of the success column when it was introduced.

The limit worth knowing: no automated check distinguishes a wrong documented value from missing chain state. A commission rate documented in the wrong encoding fails with a business error, indistinguishable from a chain that has no validator. That judgment needs a person, or an agent reading the findings file, and is worth re-running when the SDK version changes.
