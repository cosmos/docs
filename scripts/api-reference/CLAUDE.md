# scripts/api-reference

Generates the Cosmos SDK API reference: gRPC query services, transaction messages, and REST gateway routes, for `sdk/latest` and `sdk/next`.

## Commands

```bash
npm install                       # once, in this directory
npm run sync -- --version latest  # regenerate one version
npm test                          # 40 unit tests, no network, ~80ms
npm run verify-examples           # every JSON example parses against the protos
npm run conformance               # REST responses match published schemas (needs a chain)
npm run smoke                     # 15 representative commands actually run (needs a chain)
```

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

A fourth check warns rather than fails: response fields the protos define and upstream's spec omits. Upstream's swagger is generated separately from the protos and lags them, so this is expected and should not block a build. It currently reports two, both v0.55 additions.

## Why some things are the way they are

**Operation IDs are derived, not taken from upstream.** Upstream assigns `GovV1Proposal` to two different gov routes. Mintlify builds page slugs from that field, so the collision would silently drop a page.

**Summaries are replaced with the method name.** Upstream puts entire multi-paragraph proto comments in `summary`, and Mintlify builds filenames from it. The longest overran the filesystem limit and crashed the build.

**Two `auth` routes are dropped.** They differ only in path parameter name, which OpenAPI forbids in one document. Both methods stay documented on the gRPC page.

**Response schemas are made strict and nullable.** Without `additionalProperties: false` nothing could fail a conformance run, because proto3 omits defaults so no field can be marked required. The gateway emits `null` for unset message fields and empty `bytes`, so those are marked nullable per field.

**Corrections follow `$ref`.** Four of the 108 operations reference a component instead of inlining their response. A correction that only walks inline schemas skips them silently.

**`buf convert` is not used for verification.** It drops unknown fields everywhere and exits 0, so a completely misspelled example passes. Python's `json_format` rejects them, including inside an `Any`, which matches what a node does.

## Testing philosophy

Every defect found in this reference was a class rather than an instance, because a generator makes the same mistake on every page. So the unit tests assert classes, the smoke test samples shapes rather than endpoints, and exhaustive live execution is deliberately not attempted.

The limit worth knowing: no automated check distinguishes a wrong documented value from missing chain state. A commission rate documented in the wrong encoding fails with a business error, indistinguishable from a chain that simply has no validator. That judgment needs a person, or an agent reading the errors, and is worth re-running when the SDK version changes.
