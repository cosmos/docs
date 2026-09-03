# Design: generated and verified API reference

Status: approved 2026-09-03. Items 1 to 8 in scope, item 9 deferred.

This document records why the tooling in this directory is shaped the way it is,
and what changes were agreed to harden it. `CLAUDE.md` in this directory
describes how to run it. Read this one when changing it.

## The invariant everything follows from

> Fill an example from what the page says, never from the source of truth the
> page is explaining.

A verifier that reads the proto descriptor to decide what a field should contain
can pass while the page tells a reader to write a value the chain rejects. That
is not hypothetical: it happened, and the page shipped a `cosmos.Dec` encoding
that failed on chain while the descriptor-driven check stayed green.

So both on-chain runners read the rendered page: the field table, the type links
into the Types section, the enum values, the stated encodings. Only genuinely
reader-owned values (an address, an amount, a moniker) come from outside, via
`READER_SUPPLIED` in `pagefill.py`.

Three consequences fall out of that sentence, and they explain most of the code:

- A field the page cannot explain is a finding, not a skip. The reader is stuck
  at exactly that point, so the test is stuck too.
- The manifests hold only what cannot be derived. Anything derivable is derived,
  so an upstream addition is exercised with no edit.
- Tests are not written per method. Both runners enumerate from the pages, so
  the add, remove, and change cases need no test authoring at all.

## Cadence

Docs versions freeze at release, every few months. `next` is the working draft;
at freeze it becomes the new `latest` under the new version, and the previous
`latest` is archived. Published `latest` does not change between releases.

Two things follow.

Regenerating `latest` between releases is wrong, because it rewrites frozen
published pages from a branch that has moved. Only the release process may
change it.

There is no scheduled automation. A cron cheap enough to run weekly can only
report that upstream moved, which carries no decision, and a run informative
enough to act on requires building a chain and executing 171 items, which is
only actionable at release time. Early warning is available on demand instead,
through `release-check --dry-run`, with an optional pre-flight a week before a
planned freeze. `workflow_dispatch` stays so a run can be triggered from the
Actions tab without local dependencies.

## Changes in scope

### 1. Ref override, so a version documents the version it claims

`resolveRef` hardcodes `next` to `main` and `latest` to the release branch
derived from `versions.json`. Under the freeze model this publishes the wrong
content:

1. `next` is generated from `main`.
2. Upstream tags v0.54.0.
3. The freeze promotes `next` to `latest`, stamped v0.54.
4. The published v0.54 reference documents `main`, which is v0.55 development.

Neither existing command can produce v0.54 content. `--version next` resolves to
`main`; `--version latest` derives its ref from `versions.json`, which still
reads v0.53 until the freeze runs.

Add `--ref <git-ref>` overriding the resolved ref for one run. The release
procedure regenerates `next` from the release branch before freezing.

Acceptance: `--ref release/v0.54.x --version next` writes pages whose
`openapi.yaml` header records a SHA on that branch, and a unit test asserts
`--ref` wins over the derived value.

### 2. Parse-completeness guard

`query-onchain.py` computes its own denominator from the parse:

```python
for target, block in pagefill.queries_on(page):
    commands[target] = (page, block)
...
total = len(commands)
```

`queries_on` skips any section whose command block does not match the `GRPCURL`
regex. Nothing asserts the total. A render change that alters the command block
therefore drops that method from the test set, prints a smaller total, and exits
0: untested and green, the one outcome this project exists to prevent.

Both runners gain a guard: the set parsed from the pages must equal the set the
descriptor declares. A shortfall fails and names the missing methods.

This is the same shape as the three generator guards, and exists for the same
reason: a list that had already gone stale once.

Acceptance: mutating a rendered command block in a fixture makes the guard fail
and name that method.

### 3. Delete `smoke.py`

`query-onchain` runs all 123 of the same commands with a better filler, so the
15 curated cases are subsumed. Two things are not, and move into
`query-onchain`:

- crossing address spaces is rejected
- `Msg` is not served on port 9090

Both are negative assertions, which would silently start passing if the chain
changed, so they are worth keeping.

### 4. One manifest schema

`query-coverage.toml` and `tx-coverage.toml` have different shapes, and
`tx-coverage.toml` carries a placeholder `[queries]` table added only to satisfy
a parser. Unify onto one schema keyed by fully qualified method or message name,
with `expect`, `note`, and optional `requires`.

`expect` keeps a per-runner vocabulary, because the two runners assert different
things. Queries use `unfillable` and `known-failure`. Transactions use `success`,
`unauthorized`, `state-error`, and `skip`. The shared part is the file shape and
the diffing behaviour, not the value set, and each runner rejects a value outside
its own vocabulary rather than ignoring it.

Both runners diff their manifest against the pages every run and report orphans,
so a removed method leaves a visible trace. `skip` entries are still probed, and
an unexpected success is reported, so a stale entry cannot quietly understate
what works. That mechanism has already caught five entries being too
pessimistic. Both properties survive the unification.

### 5. Findings as data

Each runner writes one findings file with a stable schema, and the terminal
summary is rendered from it:

```json
{
  "version": "next",
  "ref": "release/v0.54.x",
  "sha": "2086680...",
  "runner": "query-onchain",
  "totals": { "pass": 80, "environmental": 25, "known": 18, "findings": 1 },
  "findings": [
    {
      "page": "bank.mdx",
      "anchor": "#balance",
      "method": "cosmos.bank.v1beta1.Query/Balance",
      "claim": "address is the address to query balances for. Encoded as cosmos.AddressString.",
      "sent": { "address": "cosmos1...", "denom": "stake" },
      "response": "rpc error: code = InvalidArgument ...",
      "verdict": "page-defect",
      "manifest_entry": null
    }
  ]
}
```

`verdict` is one of `page-defect`, `unfillable`, `environmental`, `known`,
`unclassified`. The file is a run artifact and is never committed. This is the
contract a later agent-driven repair step would consume, which is why it is
worth fixing now rather than retrofitting into five scripts.

### 6. Classification as data, failing loud

`MALFORMED` and `ENVIRONMENTAL` in `query-onchain.py` are substring lists tuned
against one chain's error text, and an unmatched error currently falls through to
a guess. Move both lists into the manifest as data, and classify an unrecognized
error as `unclassified`, which is a finding.

An SDK release that rewords an error should produce a visible unclassified
finding, not a silently rebucketed pass.

### 7. `release-check`

One command wrapping the full gate:

```bash
npm run release-check -- --version next --ref release/v0.54.x
npm run release-check -- --version next --dry-run
```

It regenerates, runs the unit tests and `verify-examples`, builds simapp at the
resolved SHA, runs `conformance`, `query-onchain`, and `tx-onchain`, and exits
non-zero with a findings file if any page publishes something the chain rejects.

`--dry-run` regenerates into a temporary directory and diffs against what is
committed, touching nothing under `sdk/`.

Run a few times a year with a person watching, so simapp build time and
occasional flakiness are acceptable and no non-blocking hedge is needed.

The workflow loses its `schedule:` block and keeps `workflow_dispatch`.

### 8. Documentation moves

The release procedure moves from the root `CLAUDE.md` (lines 129 to 210, about a
third of a file loaded into every session) into
`.claude/skills/release-version/SKILL.md`, which loads only when someone is
doing a release. There is precedent: that section already delegates step 2 to
`.claude/skills/update-stale-refs/SKILL.md`.

The skill carries the ordered checklist, the reason step 2 comes before the
freeze, the new `release-check` gate, and the optional pre-flight.

Rules stay in `CLAUDE.md`: writing style, `docs.json` invariants, the
do-not-edit-archived-directories rule, internal link format. Those apply to every
session. Only the procedure moves.

This directory's `CLAUDE.md` also has a stale claim. Its testing philosophy
section says exhaustive live execution is deliberately not attempted, which the
two runners disproved.

### The transferable rules

Recorded so a second product does not have to rediscover them. The pattern moves;
the Cosmos-specific code does not.

1. Generate from a machine-readable source, never by hand.
2. Guard the hand-written remainder for completeness against that source.
3. Test by executing what the docs publish, filled only from what they state.
4. Keep a manifest of exceptions, diffed both ways, so output is deltas rather
   than the same list every run.

Three seams mark where a second product would cut: where facts come from (the
descriptor), what the page claims (`pagefill`), and how a claim is executed
(grpcurl against simapp). They are named but not abstracted, because no second
product is scheduled and an abstraction designed against one example is usually
wrong where it matters.

## Deferred

### 9. Machine-readable claims sidecar

The generator would emit `<module>.claims.json` beside each page recording the
same claims it renders, and `pagefill.py` would load it instead of parsing MDX
with twelve regexes. That removes a real design smell: what a page claims is
currently encoded twice, in two languages, with the Python side a lossy inverse
of the JavaScript renderer.

Two conditions on ever building it.

The sidecar must not become the source of truth. It records what the generator
intended to say; the invariant requires testing what the page actually says. A
rendering bug that drops a note while the sidecar retains it would pass. So it
ships with a consistency check asserting every claim string appears verbatim in
the rendered `.mdx`, which is also robust to the layout changes that make regexes
fragile.

Equivalence must be proved, not argued. Dump `fill()` output for all 171 items
before and after, and diff. Chain results are the wrong comparison, being noisy
with sequence timing and chain state.

Deferred because change 2 closes the dangerous failure mode for ten lines, which
leaves the sidecar buying quieter failure rather than more correctness. Build it
when a render change actually trips the completeness guard, or when a second
product needs the same parse. By then the evidence names the fragile parse
instead of a guess.

## Risks

The release-day discovery risk is accepted. With no scheduled run, a few months
of upstream drift surfaces at once during a release. It is bounded because
everything derivable is derived, so the residue is manifest lines or a note on
one of the three hand-written pages, not a rewrite. The optional pre-flight
removes the surprise for anyone who wants to spend ten minutes a week early.

Simapp is a build dependency of the gate. If building it at an arbitrary ref
proves unreliable, the on-chain runners stop gating and the offline checks carry
the release alone, which is a real reduction in what is verified.
