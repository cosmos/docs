# API Reference Hardening Implementation Plan

> ## Executed and complete. Do not run this plan.
>
> All eight tasks in this plan were implemented and landed on 2026-09-03. The
> code they describe already exists in this directory. The file is kept as a
> record of how the work was sequenced and why each task was ordered where it
> was, not as work remaining.
>
> The unchecked `- [ ]` boxes below are the plan as it was written before
> execution, left unticked on purpose so the record reads as the original
> document rather than a retrofitted checklist. They are not a to-do list.
>
> Re-executing any step would be wrong, and two kinds of step would be actively
> destructive:
>
> - The `git commit` invocations are historical. The human partner made every
>   commit for this work; the plan's commit steps were superseded and were never
>   run as written.
> - `git rm smoke.py` and the other file removals already happened. Running them
>   again operates on a tree that no longer matches the one the plan assumed.
>
> For what the system does now and why, read `DESIGN.md`, which is the
> authority. For how to run it, read `CLAUDE.md` in this directory.

> **For agentic workers (historical, superseded by the completion notice above):** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the generated SDK API reference provably correct for the version it claims, and make its test suite fail loudly rather than silently shrink.

**Architecture:** The generator emits a name-only inventory alongside the pages; both on-chain runners assert their page parse covers that inventory, load one unified manifest schema, and write structured findings. A single `release-check` command builds a chain and runs the whole gate, replacing all scheduled automation.

**Tech Stack:** Node 20 (`node --test`), Python 3.12 (`unittest`, `tomllib`), `buf`, `grpcurl`, `simd` built from `cosmos-sdk`.

**Spec:** `scripts/api-reference/DESIGN.md`

## Global Constraints

- Never edit archived version directories (`sdk/v0.53/` and similar).
- No em-dashes in any documentation content. No bold or italic in documentation content. These apply to `sdk/**` pages, not to this plan or to `DESIGN.md`.
- Internal doc links use absolute Mintlify paths without `.mdx` (`/sdk/next/api-reference/grpc/bank`).
- `sync` requires `GITHUB_TOKEN` in practice; unauthenticated runs fail silently partway.
- Generated files are overwritten wholesale: `sdk/<version>/api-reference/grpc/*.mdx`, `rest/openapi.yaml`, and the API Reference tab in `docs.json`. Never hand-edit them.
- The three hand-written pages are never touched by the generator: `api-reference/index.mdx`, `api-reference/grpc/index.mdx`, `api-reference/transactions.mdx`.
- The load-bearing invariant: a runner fills an example from what the page states, never from the proto descriptor. Names of things that should exist may come from the descriptor; values, encodings, and forms may not.
- Python tests run with `python3 -m unittest discover -s test -p 'test_*.py'` from `scripts/api-reference/`.
- Node tests run with `npm test` from `scripts/api-reference/`.

## Spec coverage

Task numbering differs from `DESIGN.md` item numbering, deliberately: tasks are ordered so each leaves the suite green.

| Spec item | Task |
| --- | --- |
| 1, ref override | Task 1 |
| 2, parse-completeness guard | Task 2 |
| 3, delete `smoke.py` | Task 6 |
| 4, one manifest schema | Task 3 |
| 5, findings as data | Task 5 |
| 6, classification as data | Task 4 |
| 7, `release-check` | Task 7 |
| 8, documentation moves | Task 8 |
| 9, sidecar | deferred, see the end of this plan |

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `lib/refs.js` | Resolve a version plus optional `--ref` override to `{repository, ref, displayVersion}`. Argument parsing. |
| `lib/inventory.js` | Build the name-only inventory (query methods, transaction messages) from a parsed descriptor. |
| `manifest.py` | Load and validate the unified manifest schema. Shared by both runners. |
| `findings.py` | Build and write the findings JSON document. Shared by both runners. |
| `chain.py` | Build simd at a SHA, init a chain, start it, wait for a block, tear it down. |
| `release-check.py` | Orchestrate the full gate. Supports `--dry-run`. |
| `test/test_manifest.py` | Manifest loading, validation, and orphan diffing. |
| `test/test_findings.py` | Findings document shape, golden-file. |
| `test/test_pagefill.py` | Completeness guard and classification. |
| `.claude/skills/release-version/SKILL.md` | The release procedure, moved out of the root `CLAUDE.md`. |

**Modified:**

| Path | Change |
| --- | --- |
| `sync-sdk-api-reference.js` | Import from `lib/refs.js`, guard `main()` behind an entry-point check, write `inventory.json`. |
| `query-onchain.py` | Completeness guard, unified manifest, findings output, data-driven classification, absorb two negative assertions and two REST checks from `smoke.py`. |
| `tx-onchain.py` | Completeness guard, unified manifest, findings output. |
| `query-coverage.toml`, `tx-coverage.toml` | Migrate to the unified schema. |
| `package.json` | Add `test-py` and `release-check`; drop `smoke`. |
| `.github/workflows/sync-sdk-api-reference.yml` | Delete `schedule:`, keep `workflow_dispatch`. |
| `CLAUDE.md` (root) | Release procedure becomes a pointer to the skill. |
| `scripts/api-reference/CLAUDE.md` | Correct the stale testing philosophy section; document new commands. |
| `.gitignore` | Ignore `scripts/api-reference/.schemathesis/` and `.hypothesis/`. |

**Deleted:** `smoke.py`, and the three tracked files under `scripts/api-reference/.schemathesis/`.

---

## Task 1: Ref override

The freeze publishes `main`-generated content under a release version number, and no existing command can produce the right content. `resolveRef` and `parseArgs` live inside a script whose `main()` runs at module scope, so importing them to test them would execute a full generation run. Extract first, then add the override.

**Files:**
- Create: `lib/refs.js`
- Create: `test/test_refs.test.js`
- Modify: `sync-sdk-api-reference.js:60-90` (remove `parseArgs` and `resolveRef`), `:180` (call site), end of file (entry-point guard)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `parseArgs(argv) -> {version, modules, ref}` and `resolveRef(version, {ref}) -> {repository, ref, displayVersion}`, both exported from `lib/refs.js`. Task 2 imports neither; Task 7 shells out to the CLI rather than importing.

- [ ] **Step 1: Write the failing test**

Create `test/test_refs.test.js`:

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, resolveRef } from '../lib/refs.js';

describe('parseArgs', () => {
  test('accepts a ref override', () => {
    const args = parseArgs(['--version', 'next', '--ref', 'release/v0.54.x']);
    assert.equal(args.version, 'next');
    assert.equal(args.ref, 'release/v0.54.x');
  });

  test('leaves ref null when not given', () => {
    assert.equal(parseArgs(['--version', 'latest']).ref, null);
  });

  test('rejects a version that is not next or latest', () => {
    assert.throws(() => parseArgs(['--version', 'v0.53']), /must be next or latest/);
  });
});

describe('resolveRef', () => {
  test('next resolves to main by default', () => {
    assert.equal(resolveRef('next', {}).ref, 'main');
  });

  test('latest resolves to the release branch from versions.json', () => {
    assert.match(resolveRef('latest', {}).ref, /^release\/v\d+\.\d+\.x$/);
  });

  test('an override wins over the derived ref for either version', () => {
    assert.equal(resolveRef('next', { ref: 'release/v0.54.x' }).ref, 'release/v0.54.x');
    assert.equal(resolveRef('latest', { ref: 'v0.54.0' }).ref, 'v0.54.0');
  });

  test('an override does not change the version stamp on the pages', () => {
    const derived = resolveRef('next', {});
    const overridden = resolveRef('next', { ref: 'release/v0.54.x' });
    assert.equal(overridden.displayVersion, derived.displayVersion);
  });
});
```

The last test matters: the ref decides which upstream content is read, and `versions.json` decides what version the pages claim to be. Coupling them would reintroduce the bug from the other direction.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, `Cannot find module '../lib/refs.js'`

- [ ] **Step 3: Create `lib/refs.js`**

Move the two functions out of `sync-sdk-api-reference.js` verbatim, then add the override. The whole file:

```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const PRODUCT = 'sdk';

export function parseArgs(argv) {
  const args = { version: null, modules: null, ref: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--version') args.version = argv[i + 1];
    if (argv[i] === '--ref') args.ref = argv[i + 1];
    if (argv[i] === '--modules') args.modules = argv[i + 1].split(',').map((m) => m.trim());
  }
  if (!['next', 'latest'].includes(args.version)) {
    throw new Error('--version must be next or latest');
  }
  return args;
}

/**
 * next documents unreleased main. latest documents the released branch, whose
 * name follows from versions.json rather than being written down here, so a
 * freeze to v0.56 carries the generator with it.
 *
 * An explicit ref overrides that resolution and nothing else. The release
 * procedure needs to generate next's pages from the release branch before a
 * freeze, while the pages still carry next's version stamp, so the ref and the
 * displayed version are deliberately independent.
 */
export function resolveRef(version, { ref = null } = {}) {
  const versions = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'versions.json'), 'utf8'));
  const product = versions.products[PRODUCT];
  if (!product) throw new Error(`versions.json has no ${PRODUCT} product`);

  const displayVersion = product.latestDisplayVersion;
  const match = displayVersion.match(/^v(\d+)\.(\d+)/);
  if (!match) throw new Error(`cannot parse latestDisplayVersion ${displayVersion}`);

  const derived = version === 'next' ? 'main' : `release/v${match[1]}.${match[2]}.x`;

  return {
    repository: product.repository,
    ref: ref ?? derived,
    displayVersion: version === 'next' ? `${displayVersion} (unreleased)` : displayVersion,
  };
}
```

Note `REPO_ROOT` climbs three levels from `lib/`, not two as in the script.

- [ ] **Step 4: Wire it into the script**

In `sync-sdk-api-reference.js`, delete the local `parseArgs` and `resolveRef`, add the import, and pass the override:

```javascript
import { parseArgs, resolveRef } from './lib/refs.js';
```

```javascript
  const args = parseArgs(process.argv.slice(2));
  const { repository, ref, displayVersion } = resolveRef(args.version, { ref: args.ref });
```

Replace the bare `main()` call at the end of the file with an entry-point guard, so the module can be imported by tests without generating anything:

```javascript
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
}
```

Add `import { fileURLToPath } from 'url';` if it is not already imported.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 40 existing tests plus 7 new ones.

- [ ] **Step 6: Verify the CLI still works end to end**

Run: `GITHUB_TOKEN=$(gh auth token) node sync-sdk-api-reference.js --version next --modules bank`
Expected: rewrites `sdk/next/api-reference/grpc/bank.mdx`; `git diff --stat` shows either no change or only the SHA line moving.

Run: `GITHUB_TOKEN=$(gh auth token) node sync-sdk-api-reference.js --version next --ref release/v0.53.x --modules bank`
Expected: the `openapi.yaml` header records a SHA on `release/v0.53.x`, and the page's version stamp is unchanged.

Then: `git checkout sdk/next/api-reference` to discard the probe.

- [ ] **Step 7: Commit**

```bash
git add lib/refs.js test/test_refs.test.js sync-sdk-api-reference.js
git commit -m "feat(api-reference): add --ref override so a version documents the version it claims"
```

---

## Task 2: Inventory and the completeness guard

`query-onchain.py` computes its denominator from its own parse, and `queries_on` silently skips a section whose `grpcurl` block does not match. A render change therefore drops a method from the test set and the run still exits 0.

The guard compares the page parse against a name-only inventory the generator emits. Names of things that should exist may come from the descriptor without violating the invariant; what a field should contain still comes only from the page.

**Files:**
- Create: `lib/inventory.js`, `test/test_pagefill.py`
- Modify: `sync-sdk-api-reference.js` (write the inventory), `test/generator.test.js` (inventory test), `pagefill.py` (guard), `query-onchain.py:100-110`, `tx-onchain.py:160-170`, `package.json`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `buildInventory(modules) -> {queries: string[], messages: string[]}` from `lib/inventory.js`, both arrays sorted.
  - `sdk/<version>/api-reference/inventory.json`, committed, shape `{"queries": [...], "messages": [...]}`.
  - `pagefill.assert_complete(version, parsed, kind) -> None`, raising `pagefill.Incomplete` with a message naming every missing entry. `kind` is `"queries"` or `"messages"`; `parsed` is any iterable of names.

- [ ] **Step 1: Write the failing generator test**

Append to `test/generator.test.js`:

```javascript
import { buildInventory } from '../lib/inventory.js';

describe('inventory', () => {
  test('lists every query method and transaction message, sorted', () => {
    const { modules } = parseDescriptor(descriptor([...baseDescriptor(), govModule()]));
    const inventory = buildInventory(modules);

    assert.ok(inventory.queries.includes('cosmos.gov.v1.Query/Proposal'));
    assert.ok(inventory.messages.includes('cosmos.gov.v1.MsgSubmitProposal'));
    assert.deepEqual(inventory.queries, [...inventory.queries].sort());
    assert.deepEqual(inventory.messages, [...inventory.messages].sort());
  });

  test('a method added upstream appears without any other edit', () => {
    const withExtra = parseDescriptor(descriptor([...baseDescriptor(), govModule()]));
    const before = buildInventory(withExtra.modules).queries.length;

    const service = withExtra.modules
      .find((m) => m.name === 'gov').services
      .find((s) => s.fullName === 'cosmos.gov.v1.Query');
    service.methods.push({ name: 'Brand New', inputType: 'x', outputType: 'y' });

    assert.equal(buildInventory(withExtra.modules).queries.length, before + 1);
  });
});
```

Adjust the fixture method name and the `Query` service `fullName` to whatever `govModule()` in `test/fixtures.js` actually produces; read it before writing the assertion rather than guessing.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, `Cannot find module '../lib/inventory.js'`

- [ ] **Step 3: Create `lib/inventory.js`**

```javascript
/**
 * The names of everything the reference is expected to document, derived from
 * the descriptor.
 *
 * This is names only, deliberately. The on-chain runners fill values from what
 * a page states, never from the descriptor, because a filler that reads the
 * descriptor can pass while the page is wrong. Asking the descriptor which
 * methods should exist does not weaken that: it is the question of coverage,
 * not the question of what a field contains.
 */
export function buildInventory(modules) {
  const queries = [];
  const messages = [];

  for (const module of modules) {
    for (const service of module.services) {
      for (const method of service.methods) {
        if (service.kind === 'query') queries.push(`${service.fullName}/${method.name}`);
        if (service.kind === 'msg') messages.push(method.inputType.replace(/^\./, ''));
      }
    }
  }

  return { queries: [...new Set(queries)].sort(), messages: [...new Set(messages)].sort() };
}
```

Check `lib/descriptor.js:112` `serviceKind` for the exact strings it assigns, and use those rather than `'query'` and `'msg'` if they differ.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Emit the inventory from the generator**

In `sync-sdk-api-reference.js`, after the module pages are rendered:

```javascript
  const inventory = buildInventory(selected);
  writeFile(
    path.join(outputRoot, 'inventory.json'),
    `${JSON.stringify(inventory, null, 2)}\n`,
  );
  console.log(`  ${inventory.queries.length} query methods, ${inventory.messages.length} messages`);
```

Committed on purpose: the sync PR then shows added and removed methods as a readable diff, and the guard runs without a regeneration.

- [ ] **Step 6: Write the failing guard test**

Create `test/test_pagefill.py`:

```python
"""Tests for the shared page filler and its guards."""

import json
import tempfile
import unittest
from pathlib import Path

import pagefill


class CompletenessGuard(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        directory = self.root / "sdk" / "next" / "api-reference"
        directory.mkdir(parents=True)
        (directory / "inventory.json").write_text(json.dumps({
            "queries": ["cosmos.bank.v1beta1.Query/Balance",
                        "cosmos.bank.v1beta1.Query/AllBalances"],
            "messages": ["cosmos.bank.v1beta1.MsgSend"],
        }))
        self._saved = pagefill.REPO_ROOT
        pagefill.REPO_ROOT = self.root

    def tearDown(self):
        pagefill.REPO_ROOT = self._saved

    def test_passes_when_the_parse_covers_the_inventory(self):
        pagefill.assert_complete("next", [
            "cosmos.bank.v1beta1.Query/Balance",
            "cosmos.bank.v1beta1.Query/AllBalances",
        ], "queries")

    def test_fails_and_names_a_method_the_parse_missed(self):
        with self.assertRaises(pagefill.Incomplete) as caught:
            pagefill.assert_complete("next", ["cosmos.bank.v1beta1.Query/Balance"], "queries")
        self.assertIn("AllBalances", str(caught.exception))

    def test_an_extra_parsed_name_is_not_a_failure(self):
        pagefill.assert_complete("next", [
            "cosmos.bank.v1beta1.Query/Balance",
            "cosmos.bank.v1beta1.Query/AllBalances",
            "cosmos.bank.v1beta1.Query/SomethingElse",
        ], "queries")

    def test_a_missing_inventory_is_a_failure_not_a_pass(self):
        (self.root / "sdk" / "next" / "api-reference" / "inventory.json").unlink()
        with self.assertRaises(pagefill.Incomplete):
            pagefill.assert_complete("next", [], "queries")


if __name__ == "__main__":
    unittest.main()
```

The last two cases are the ones that matter. An extra parsed name is legitimate, since a page may document something the descriptor does not list as a service method. A missing inventory must fail: a guard that quietly passes when its reference data is absent is worse than no guard.

- [ ] **Step 7: Run to verify it fails**

Run: `python3 -m unittest discover -s test -p 'test_*.py' -v`
Expected: FAIL, `module 'pagefill' has no attribute 'assert_complete'`

- [ ] **Step 8: Implement the guard**

Add to `pagefill.py`:

```python
class Incomplete(Exception):
    """The page parse did not cover everything the generator says it documents."""


def assert_complete(version: str, parsed, kind: str) -> None:
    """Every name the generator recorded must appear in the parse.

    The runners derive their own totals from what they parsed, so a regex that
    stops matching would shrink the test set and still exit 0. This turns that
    into a loud failure naming the exact methods.
    """
    path = REPO_ROOT / "sdk" / version / "api-reference" / "inventory.json"
    if not path.exists():
        raise Incomplete(
            f"{path} is missing; regenerate with `npm run sync -- --version {version}`"
        )

    expected = set(json.loads(path.read_text())[kind])
    missing = sorted(expected - set(parsed))
    if missing:
        raise Incomplete(
            f"the page parse found {len(set(parsed))} of {len(expected)} {kind}; "
            f"{len(missing)} missing, so a regex in pagefill.py has stopped matching:\n"
            + "\n".join(f"  {name}" for name in missing)
        )
```

- [ ] **Step 9: Run to verify it passes**

Run: `python3 -m unittest discover -s test -p 'test_*.py' -v`
Expected: PASS, 4 tests

- [ ] **Step 10: Call the guard from both runners**

In `query-onchain.py`, immediately after the `commands` dict is built:

```python
    try:
        pagefill.assert_complete(args.version, commands, "queries")
    except pagefill.Incomplete as reason:
        print(f"\n{reason}", file=sys.stderr)
        return 1
```

In `tx-onchain.py`, immediately after the `pages` dict is built:

```python
    try:
        pagefill.assert_complete(args.version, pages, "messages")
    except pagefill.Incomplete as reason:
        print(f"\n{reason}", file=sys.stderr)
        return 1
```

- [ ] **Step 11: Add the Python test script**

In `package.json`, add to `scripts`:

```json
    "test-py": "python3 -m unittest discover -s test -p 'test_*.py'",
```

- [ ] **Step 12: Prove the guard fires against the real pages**

Regenerate so `inventory.json` exists, then break a rendered command block by hand and confirm the guard catches it:

```bash
GITHUB_TOKEN=$(gh auth token) npm run sync -- --version next
python3 - <<'EOF'
from pathlib import Path
p = Path('../../sdk/next/api-reference/grpc/bank.mdx')
p.write_text(p.read_text().replace('grpcurl -plaintext -d', 'grpcurl  -plaintext  -d', 1))
EOF
python3 query-onchain.py --version next || echo "guard fired as intended"
git checkout ../../sdk/next/api-reference
```

Expected: the guard names the `bank` method whose block was mangled, and exits non-zero without needing a chain. This is the step that proves the task; do not skip it because the unit tests pass.

- [ ] **Step 13: Commit**

```bash
git add lib/inventory.js pagefill.py query-onchain.py tx-onchain.py test/ package.json ../../sdk/*/api-reference/inventory.json
git commit -m "feat(api-reference): fail loudly when the page parse misses a documented method"
```

---

## Task 3: One manifest schema

Two manifests with different shapes, and `tx-coverage.toml:126` carries `[queries]  # placeholder table so the runner's parser stays happy`. The tx manifest also has a separate `[unfillable]` table expressing exactly what the query manifest expresses as `expect = "unfillable"`, so unification removes a concept rather than just aligning two files.

**Files:**
- Create: `manifest.py`, `test/test_manifest.py`
- Modify: `query-coverage.toml`, `tx-coverage.toml`, `query-onchain.py:93-99`, `tx-onchain.py:121-133`

**Interfaces:**
- Consumes: nothing.
- Produces: `manifest.load(path, vocabulary, default=None) -> dict[str, dict]` and `manifest.orphans(entries, documented) -> list[str]` from `manifest.py`. `manifest.QUERY_VOCABULARY` is `{"unfillable", "known-failure"}`; `manifest.TX_VOCABULARY` is `{"success", "unauthorized", "state-error", "skip", "unfillable"}`. Task 4 adds `manifest.load_errors` and `manifest.classify`.

Two facts about the existing data shape, checked rather than assumed, that the schema must accommodate. Of 26 `[messages]` entries, 20 have no `expect` and rely on `tx-onchain.py:194` defaulting it to `success`, so `load` takes a `default`. Five have no `note` because their only content is a `requires` ordering, which is self-explanatory rather than an exception, so a `note` is required only when an entry claims something beyond ordering.

- [ ] **Step 1: Write the failing test**

Create `test/test_manifest.py`:

```python
"""Tests for the unified coverage manifest."""

import tempfile
import unittest
from pathlib import Path

import manifest


def write(text: str) -> Path:
    path = Path(tempfile.mkdtemp()) / "coverage.toml"
    path.write_text(text)
    return path


class Load(unittest.TestCase):
    def test_applies_the_default_expect_when_an_entry_omits_it(self):
        path = write('''
[cases."cosmos.authz.v1beta1.MsgExec"]
note = "needs a grant first"
requires = ["cosmos.authz.v1beta1.MsgGrant"]
''')
        entries = manifest.load(path, manifest.TX_VOCABULARY, default="success")
        self.assertEqual(entries["cosmos.authz.v1beta1.MsgExec"]["expect"], "success")

    def test_an_ordering_only_entry_needs_no_note(self):
        path = write('''
[cases."cosmos.gov.v1.MsgVote"]
requires = ["cosmos.gov.v1.MsgSubmitProposal"]
''')
        manifest.load(path, manifest.TX_VOCABULARY, default="success")

    def test_reads_cases_keyed_by_qualified_name(self):
        path = write("""
[cases."cosmos.bank.v1beta1.Query/Balance"]
expect = "unfillable"
note = "no stated form for denom"
""")
        entries = manifest.load(path, manifest.QUERY_VOCABULARY)
        self.assertEqual(entries["cosmos.bank.v1beta1.Query/Balance"]["expect"], "unfillable")
        self.assertEqual(entries["cosmos.bank.v1beta1.Query/Balance"]["note"], "no stated form for denom")

    def test_carries_requires_and_signer_through(self):
        path = write("""
[cases."cosmos.authz.v1beta1.MsgExec"]
expect = "success"
note = "needs a grant first"
requires = ["cosmos.authz.v1beta1.MsgGrant"]
signer = "second"
""")
        entry = manifest.load(path, manifest.TX_VOCABULARY)["cosmos.authz.v1beta1.MsgExec"]
        self.assertEqual(entry["requires"], ["cosmos.authz.v1beta1.MsgGrant"])
        self.assertEqual(entry["signer"], "second")

    def test_rejects_an_expect_value_outside_the_vocabulary(self):
        path = write("""
[cases."cosmos.bank.v1beta1.Query/Balance"]
expect = "state-error"
note = "wrong vocabulary for a query"
""")
        with self.assertRaises(manifest.Invalid) as caught:
            manifest.load(path, manifest.QUERY_VOCABULARY)
        self.assertIn("state-error", str(caught.exception))

    def test_requires_a_note_when_an_entry_claims_more_than_ordering(self):
        path = write("""
[cases."cosmos.bank.v1beta1.Query/Balance"]
expect = "unfillable"
""")
        with self.assertRaises(manifest.Invalid):
            manifest.load(path, manifest.QUERY_VOCABULARY)

    def test_rejects_a_legacy_table_rather_than_ignoring_it(self):
        path = write("""
[queries."cosmos.bank.v1beta1.Query/Balance"]
expect = "unfillable"
note = "old shape"
""")
        with self.assertRaises(manifest.Invalid) as caught:
            manifest.load(path, manifest.QUERY_VOCABULARY)
        self.assertIn("cases", str(caught.exception))


class Orphans(unittest.TestCase):
    def test_reports_an_entry_with_nothing_documented(self):
        self.assertEqual(
            manifest.orphans({"a": {}, "b": {}}, {"a"}),
            ["b"],
        )

    def test_is_quiet_when_every_entry_matches(self):
        self.assertEqual(manifest.orphans({"a": {}}, {"a", "b"}), [])


if __name__ == "__main__":
    unittest.main()
```

Two of these encode judgment worth keeping. A missing `note` is rejected because an exception without a stated reason is indistinguishable from an oversight, and the whole point of the manifest is that it states rather than hides. A legacy `[queries]` or `[messages]` table is rejected rather than ignored, because a silently ignored manifest means every exception is suddenly treated as a finding, or worse, every finding as an exception.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test-py`
Expected: FAIL, `No module named 'manifest'`

- [ ] **Step 3: Implement `manifest.py`**

```python
"""The coverage manifest: what the runners cannot derive.

One schema for both runners. Every entry is a statement that something cannot
work as written, with a reason, so a run's output is what changed rather than
the same list every time. Where a reason is fixable it should be fixed instead
of recorded here.
"""

import tomllib
from pathlib import Path

QUERY_VOCABULARY = {"unfillable", "known-failure"}
TX_VOCABULARY = {"success", "unauthorized", "state-error", "skip", "unfillable"}

LEGACY_TABLES = ("queries", "messages", "unfillable")


class Invalid(Exception):
    """The manifest does not match the schema."""


def load(path: Path, vocabulary: set, default: str | None = None) -> dict:
    if not Path(path).exists():
        raise Invalid(f"{path} does not exist")

    document = tomllib.loads(Path(path).read_text())

    for table in LEGACY_TABLES:
        if table in document:
            raise Invalid(
                f"{path} has a legacy [{table}] table; entries belong under [cases.\"name\"]"
            )

    entries = document.get("cases", {})
    for name, entry in entries.items():
        entry.setdefault("expect", default)
        if entry["expect"] not in vocabulary:
            raise Invalid(
                f"{path}: {name} has expect = {entry['expect']!r}, "
                f"which is not one of {sorted(vocabulary)}"
            )
        # An entry whose only content is a prerequisite states an ordering, not
        # an exception, so it needs no reason. Anything else does: an exception
        # without a stated reason cannot be told apart from an oversight.
        claims_more = set(entry) - {"expect", "requires", "signer"} or entry["expect"] != default
        if claims_more and not entry.get("note"):
            raise Invalid(f"{path}: {name} has no note, so its reason is not stated")

    return entries


def orphans(entries: dict, documented) -> list:
    """Manifest entries naming something the pages no longer document."""
    return sorted(set(entries) - set(documented))
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test-py`
Expected: PASS, 11 tests

- [ ] **Step 5: Migrate `query-coverage.toml`**

Rename every `[queries."X"]` table to `[cases."X"]`, keeping all comments and notes exactly as they are:

```bash
python3 - <<'EOF'
from pathlib import Path
p = Path('query-coverage.toml')
p.write_text(p.read_text().replace('[queries."', '[cases."'))
EOF
```

- [ ] **Step 6: Migrate `tx-coverage.toml`**

Three changes: `[messages."X"]` becomes `[cases."X"]`; each `[unfillable."X"]` becomes a `[cases."X"]` entry with `expect = "unfillable"`, merged into an existing entry for that name if one is already present; and the placeholder `[queries]` table at line 126 is deleted.

Seven names appear in both tables: `cosmos.authz.v1beta1.MsgRevoke`, `cosmos.evidence.v1beta1.MsgSubmitEvidence`, `cosmos.gov.v1.MsgExecLegacyContent`, `cosmos.staking.v1beta1.MsgCreateValidator`, `cosmos.staking.v1beta1.MsgRotateConsPubKey`, `cosmos.vesting.v1beta1.MsgCreatePeriodicVestingAccount`, `cosmos.vesting.v1beta1.MsgCreatePermanentLockedAccount`. For each, keep the `requires`, combine the two notes into one sentence, and set `expect = "unfillable"`, since a case that cannot be filled never reaches the point where its outcome matters. The remaining two `[unfillable]` names (`cosmos.authz.v1beta1.MsgGrant`, `cosmos.gov.v1.MsgSubmitProposal`) have no `[messages]` entry and become new `[cases]` entries.

Do this by hand, not with a script. The notes carry reasoning that a mechanical merge would mangle, and there are only nine to touch.

- [ ] **Step 7: Point both runners at the new loader**

In `query-onchain.py`, replace the inline `tomllib` block:

```python
    try:
        entries = manifest.load(HERE / "query-coverage.toml", manifest.QUERY_VOCABULARY)
    except manifest.Invalid as reason:
        print(reason, file=sys.stderr)
        return 1
```

In `tx-onchain.py`, delete `load_manifest` and `load_unfillable` and replace both call sites with:

```python
    try:
        entries = manifest.load(HERE / "tx-coverage.toml", manifest.TX_VOCABULARY,
                                default="success")
    except manifest.Invalid as reason:
        print(reason, file=sys.stderr)
        return 1
```

The `known_gaps` lookups in `tx-onchain.py` become `entries.get(name, {}).get("expect") == "unfillable"`. Add `import manifest` to both, and replace both orphan blocks with `manifest.orphans(entries, pages)`.

- [ ] **Step 8: Verify the manifests still load and the counts hold**

Run: `npm run test-py && python3 -c "
import manifest
q = manifest.load('query-coverage.toml', manifest.QUERY_VOCABULARY)
t = manifest.load('tx-coverage.toml', manifest.TX_VOCABULARY)
print(len(q), 'query entries;', len(t), 'tx entries')
"`
Expected: PASS, and `18 query entries; 28 tx entries`. The tx figure is 26 messages plus 9 unfillable minus the 7 names in both. If it is not 28, an entry was dropped or double-counted in the merge. Pass `default="success"` for the tx file.

- [ ] **Step 9: Commit**

```bash
git add manifest.py test/test_manifest.py query-coverage.toml tx-coverage.toml query-onchain.py tx-onchain.py
git commit -m "refactor(api-reference): one manifest schema for both runners"
```

---

## Task 4: Classification as data, failing loud

`MALFORMED` and `ENVIRONMENTAL` are substring lists in `query-onchain.py:36-49`, tuned against one chain's error text, and an unmatched error falls through to a guess. An SDK release that rewords an error should be visible, not silently rebucketed.

**Files:**
- Modify: `manifest.py`, `query-coverage.toml`, `query-onchain.py:36-49` and the verdict branch at `:135-155`, `test/test_manifest.py`

**Interfaces:**
- Consumes: `manifest.load` from Task 3.
- Produces: `manifest.load_errors(path) -> {"malformed": [...], "environmental": [...]}` and `manifest.classify(output, errors) -> str` returning `"malformed"`, `"environmental"`, or `"unclassified"`.

- [ ] **Step 1: Write the failing test**

Append to `test/test_manifest.py`:

```python
class Classify(unittest.TestCase):
    ERRORS = {"malformed": ["invalid character", "unknown field"],
              "environmental": ["not found", "no delegation"]}

    def test_a_malformed_error_is_a_documentation_defect(self):
        self.assertEqual(
            manifest.classify("rpc error: invalid character 'x'", self.ERRORS),
            "malformed",
        )

    def test_an_environmental_error_is_not(self):
        self.assertEqual(manifest.classify("validator not found", self.ERRORS), "environmental")

    def test_malformed_wins_when_both_match(self):
        self.assertEqual(
            manifest.classify("unknown field, and not found", self.ERRORS),
            "malformed",
        )

    def test_an_unrecognised_error_is_unclassified_rather_than_guessed(self):
        self.assertEqual(
            manifest.classify("something upstream reworded", self.ERRORS),
            "unclassified",
        )

    def test_matching_ignores_case(self):
        self.assertEqual(manifest.classify("INVALID CHARACTER", self.ERRORS), "malformed")
```

`test_malformed_wins_when_both_match` preserves the existing precedence: the current code checks `MALFORMED` first and requires its absence before accepting an environmental match. Losing that would turn real defects into skips.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test-py`
Expected: FAIL, `module 'manifest' has no attribute 'classify'`

- [ ] **Step 3: Implement**

Add to `manifest.py`:

```python
def load_errors(path: Path) -> dict:
    """Error substrings that decide whether a failure is the page's fault.

    Data rather than code, because they are tuned to one chain's wording and
    will drift when the SDK rewords an error.
    """
    document = tomllib.loads(Path(path).read_text())
    errors = document.get("errors", {})
    for key in ("malformed", "environmental"):
        if not errors.get(key):
            raise Invalid(f"{path} has no [errors] {key} list")
    return errors


def classify(output: str, errors: dict) -> str:
    """Whether a failing command failed on its own arguments.

    An error matching nothing is unclassified, not assumed benign. A release
    that rewords an error should be visible rather than silently rebucketed.
    """
    low = output.lower()
    if any(m in low for m in errors["malformed"]):
        return "malformed"
    if any(m in low for m in errors["environmental"]):
        return "environmental"
    return "unclassified"
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test-py`
Expected: PASS, 16 tests

- [ ] **Step 5: Move the lists into the manifest**

Add to the top of `query-coverage.toml`, above the `[cases...]` tables, copying all 19 malformed and 7 environmental substrings verbatim from `query-onchain.py:36-49`:

```toml
# Error substrings that decide whether a failing command failed on its own
# arguments. Tuned to one chain's wording, so they live here rather than in
# code: an SDK release that rewords an error should be a manifest edit with a
# visible diff, not a silent reclassification.
#
# An error matching neither list is reported as unclassified, which is a
# finding. Add it to whichever list is correct once you have read it.

[errors]
malformed = [
  "invalid character", "illegal base64", "unknown field", "invalid value for enum",
  "hrp does not match", "cannot unmarshal", "invalid validator status",
  "expecting number", "bad input", "unable to resolve type", "no such method",
  "decoding bech32 failed", "empty address", "unknown params type",
  "invalid evidence hash", "disfix json wrapper", "unsupported abci query path",
  "wanted tag", "is not allowed",
]
environmental = [
  "not expose service", "not found", "doesn't exist", "no delegation",
  "client metadata for denom", "identifier not available", "not available",
]
```

- [ ] **Step 6: Use it in the runner**

Delete the `MALFORMED` and `ENVIRONMENTAL` module constants. Load the lists beside the manifest, and rewrite the verdict branch:

```python
    errors = manifest.load_errors(HERE / "query-coverage.toml")
```

```python
        verdict = manifest.classify(output, errors)

        if result.returncode == 0 and verdict != "malformed":
            counts["pass"] += 1
            print(f"  PASS    {target:52} ok")
        elif verdict == "environmental":
            counts["environmental"] += 1
            print(f"  SKIP    {target:52} chain state or module not registered")
        elif entry.get("expect") == "known-failure":
            counts["known"] += 1
            print(f"  KNOWN   {target:52} {entry.get('note', '')[:56]}")
        else:
            findings.append((page["name"], target, output.splitlines()[-1][:150], verdict))
            label = "UNCLASS" if verdict == "unclassified" else "FAIL"
            print(f"  {label:7} {target:52} {output.splitlines()[-1][:56]}")
```

Note the first branch keeps the existing behaviour that a zero exit code with a malformed-looking error is still a defect.

- [ ] **Step 7: Verify against the real manifest**

Run: `npm run test-py && python3 -c "
import manifest
e = manifest.load_errors('query-coverage.toml')
print(len(e['malformed']), 'malformed;', len(e['environmental']), 'environmental')
print(manifest.classify('rpc error: code = InvalidArgument desc = decoding bech32 failed', e))
print(manifest.classify('a wording nobody has seen', e))
"`
Expected: `19 malformed; 7 environmental`, then `malformed`, then `unclassified`.

- [ ] **Step 8: Commit**

```bash
git add manifest.py query-coverage.toml query-onchain.py test/test_manifest.py
git commit -m "feat(api-reference): classify chain errors from data, and report unknown ones"
```

---

## Task 5: Findings as data

Both runners print prose. A later agent-driven repair step needs structure, and retrofitting it into five scripts is worse than doing it once now.

**Files:**
- Create: `findings.py`, `test/test_findings.py`, `test/golden/query-findings.json`
- Modify: `query-onchain.py`, `tx-onchain.py`, `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `findings.Finding(page, anchor, method, claim, sent, response, verdict, manifest_entry)`, a dataclass.
  - `findings.document(version, ref, sha, runner, totals, items) -> dict`.
  - `findings.write(path, document) -> None`.
  - `findings.render(document) -> str`, the terminal summary.
  - Valid verdicts: `findings.VERDICTS = ("page-defect", "unfillable", "environmental", "known", "unclassified")`.
  - `pagefill.generated_from(version) -> (repository, sha)`, used here and again by Task 7.

- [ ] **Step 1: Write the failing test**

Create `test/test_findings.py`:

```python
"""Tests for the findings document."""

import json
import tempfile
import unittest
from pathlib import Path

import findings


def one(**overrides) -> findings.Finding:
    defaults = dict(
        page="bank.mdx",
        anchor="#balance",
        method="cosmos.bank.v1beta1.Query/Balance",
        claim="Encoded as cosmos.AddressString.",
        sent={"address": "cosmos1abc", "denom": "stake"},
        response="rpc error: code = InvalidArgument",
        verdict="page-defect",
        manifest_entry=None,
    )
    return findings.Finding(**{**defaults, **overrides})


class Document(unittest.TestCase):
    def test_carries_the_run_identity_so_a_finding_can_be_reproduced(self):
        document = findings.document("next", "release/v0.54.x", "2086680", "query-onchain",
                                     {"pass": 80}, [one()])
        self.assertEqual(document["version"], "next")
        self.assertEqual(document["ref"], "release/v0.54.x")
        self.assertEqual(document["sha"], "2086680")
        self.assertEqual(document["runner"], "query-onchain")

    def test_totals_count_the_findings_it_actually_carries(self):
        document = findings.document("next", "main", "abc", "query-onchain",
                                     {"pass": 80}, [one(), one(method="x")])
        self.assertEqual(document["totals"]["findings"], 2)

    def test_rejects_a_verdict_outside_the_schema(self):
        with self.assertRaises(ValueError):
            findings.document("next", "main", "abc", "query-onchain", {}, [one(verdict="bad")])

    def test_round_trips_through_json(self):
        document = findings.document("next", "main", "abc", "query-onchain", {}, [one()])
        path = Path(tempfile.mkdtemp()) / "findings.json"
        findings.write(path, document)
        self.assertEqual(json.loads(path.read_text()), document)

    def test_matches_the_golden_document(self):
        document = findings.document("next", "release/v0.54.x", "2086680", "query-onchain",
                                     {"pass": 80, "environmental": 25, "known": 18}, [one()])
        golden = json.loads((Path(__file__).parent / "golden" / "query-findings.json").read_text())
        self.assertEqual(document, golden)


class Render(unittest.TestCase):
    def test_names_the_page_and_anchor_a_reader_would_land_on(self):
        text = findings.render(findings.document("next", "main", "abc", "query-onchain",
                                                 {"pass": 1}, [one()]))
        self.assertIn("bank.mdx#balance", text)

    def test_says_so_plainly_when_there_is_nothing_to_report(self):
        text = findings.render(findings.document("next", "main", "abc", "query-onchain",
                                                 {"pass": 123}, []))
        self.assertIn("no findings", text)
```

The golden test is what makes the schema a contract: a field renamed or dropped fails here rather than surfacing later as a broken consumer.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test-py`
Expected: FAIL, `No module named 'findings'`

- [ ] **Step 3: Implement `findings.py`**

```python
"""The structured result of a runner.

One document per run, with the terminal summary rendered from it rather than
printed alongside it, so what a person reads and what a later repair step
consumes cannot disagree.

The document is a run artifact. It is never committed: it describes one chain
at one moment, and a committed copy would go stale silently.
"""

import json
from dataclasses import dataclass, asdict
from pathlib import Path

VERDICTS = ("page-defect", "unfillable", "environmental", "known", "unclassified")


@dataclass
class Finding:
    page: str
    anchor: str
    method: str
    claim: str
    sent: dict | None
    response: str
    verdict: str
    manifest_entry: str | None


def document(version: str, ref: str, sha: str, runner: str, totals: dict, items) -> dict:
    items = list(items)
    for item in items:
        if item.verdict not in VERDICTS:
            raise ValueError(f"{item.verdict!r} is not one of {VERDICTS}")

    return {
        "version": version,
        "ref": ref,
        "sha": sha,
        "runner": runner,
        "totals": {**totals, "findings": len(items)},
        "findings": [asdict(item) for item in items],
    }


def write(path, document: dict) -> None:
    Path(path).write_text(f"{json.dumps(document, indent=2, sort_keys=False)}\n")


def render(document: dict) -> str:
    totals = ", ".join(f"{value} {key}" for key, value in document["totals"].items() if value)
    lines = [f"{document['runner']} on {document['version']} at {document['sha'][:12]}: {totals}"]

    if not document["findings"]:
        lines.append("no findings")
        return "\n".join(lines)

    for item in document["findings"]:
        lines.append(f"\n  {item['page']}{item['anchor']}  {item['method']}")
        lines.append(f"    verdict  {item['verdict']}")
        if item["claim"]:
            lines.append(f"    page says  {item['claim']}")
        if item["sent"] is not None:
            lines.append(f"    sent  {json.dumps(item['sent'])}")
        lines.append(f"    chain said  {item['response']}")

    return "\n".join(lines)
```

- [ ] **Step 4: Write the golden file**

Create `test/golden/query-findings.json` by running the generator function once and saving its output, then read it and confirm by eye that every field is one a repair step would need:

```bash
mkdir -p test/golden
python3 - <<'EOF'
import json, sys
sys.path.insert(0, '.')
import findings
document = findings.document("next", "release/v0.54.x", "2086680", "query-onchain",
    {"pass": 80, "environmental": 25, "known": 18},
    [findings.Finding(
        page="bank.mdx", anchor="#balance",
        method="cosmos.bank.v1beta1.Query/Balance",
        claim="Encoded as cosmos.AddressString.",
        sent={"address": "cosmos1abc", "denom": "stake"},
        response="rpc error: code = InvalidArgument",
        verdict="page-defect", manifest_entry=None)])
findings.write("test/golden/query-findings.json", document)
EOF
cat test/golden/query-findings.json
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test-py`
Expected: PASS, 23 tests

- [ ] **Step 6: Wire both runners to emit it**

Both runners gain `--findings <path>`, defaulting to `findings-<runner>.json` in the working directory. Where each currently appends a tuple to `findings`, append a `findings.Finding` instead, mapping:

- a `pagefill.Unfillable` with no manifest entry to `verdict="unfillable"`, `sent=None`, `response=str(reason)`
- a classified `malformed` or a tx outcome that missed its `expect` to `verdict="page-defect"`
- an unrecognised error to `verdict="unclassified"`
- `claim` to the field note the filler was acting on, or `""` where the failure is not attributable to one field
- `anchor` to `"#" + method_name.lower()` for queries and `"#" + message_name.split(".")[-1].lower().removeprefix("msg")` for messages, matching how the generator slugs its headings; confirm against a rendered page before trusting either

Replace the three prose print blocks at the end of each `main()` with:

```python
    repository, sha = pagefill.generated_from(args.version)
    document = findings.document(args.version, repository, sha, "query-onchain", counts, items)
    findings.write(args.findings, document)
    print(findings.render(document))
    return 1 if document["totals"]["findings"] else 0
```

`ref` and `sha` are read from the generated spec rather than passed on the command line, so a findings file cannot claim a run it did not do. Add to `pagefill.py`:

```python
GENERATED_FROM = re.compile(r"Generated from (?P<repository>[\w./-]+) at commit (?P<sha>[0-9a-f]{40})")


def generated_from(version: str) -> tuple[str, str]:
    """Which upstream commit these pages were generated from.

    Recorded in the spec's own description by the generator, so a check cannot
    disagree with the artifact about what it is checking.
    """
    path = REPO_ROOT / "sdk" / version / "api-reference" / "rest" / "openapi.yaml"
    found = GENERATED_FROM.search(path.read_text())
    if not found:
        raise Incomplete(f"{path} does not record the commit it was generated from")
    return found.group("repository"), found.group("sha")
```

Add a test for it in `test/test_pagefill.py`, asserting it returns the SHA from a written fixture and raises `Incomplete` when the line is absent.

- [ ] **Step 7: Ignore the artifacts**

Append to `.gitignore`:

```
# API reference run artifacts
scripts/api-reference/findings-*.json
scripts/api-reference/.schemathesis/
scripts/api-reference/.hypothesis/
```

Then remove the three crash-cache files committed by accident in `be4aaf74`:

```bash
git rm -r --cached scripts/api-reference/.schemathesis
```

- [ ] **Step 8: Commit**

```bash
git add findings.py test/test_findings.py test/golden query-onchain.py tx-onchain.py pagefill.py ../../.gitignore
git commit -m "feat(api-reference): emit structured findings, and stop tracking run artifacts"
```

---

## Task 6: Fold `smoke.py` into `query-onchain.py`

`query-onchain` runs all 123 of the same commands with a better filler, so the 15 curated cases are subsumed. Four checks are not: two negative assertions and two REST reads.

**Files:**
- Modify: `query-onchain.py`, `package.json`, `scripts/api-reference/CLAUDE.md`
- Delete: `smoke.py`

**Interfaces:**
- Consumes: `findings.Finding` from Task 5.
- Produces: `assertions(grpc, rest, values) -> list[Finding]` inside `query-onchain.py`, run after the enumerated commands.

There is no offline test for this task, and that is deliberate. A negative assertion's entire content is what a real chain does when sent something the page says is invalid; mocking the chain would assert only that the mock was configured. Step 4 is the verification, and it is not optional.

- [ ] **Step 1: Read the four cases being kept**

From `smoke.py:120-143`:

- crossed address spaces are rejected: `cosmos.staking.v1beta1.Query/Validator` with `validator_addr` set to an account address, expecting an error
- `Msg` is not served on 9090: `cosmos.bank.v1beta1.Msg/Send` with `{}`, expecting an error
- decimal encoding over REST: `GET {rest}/cosmos/mint/v1beta1/params`
- REST path parameter: `GET {rest}/cosmos/bank/v1beta1/balances/{address}`

- [ ] **Step 2: Add them to `query-onchain.py`**

```python
def assertions(grpc: str, rest: str, values: dict) -> list:
    """Claims the enumerated commands cannot express.

    Two are negative: they pass by failing. They are worth keeping precisely
    because they would start passing silently if the chain changed, which no
    positive assertion would notice.
    """
    items = []

    def expect_error(name, args, claim):
        result = subprocess.run(["grpcurl", "-plaintext", *args], capture_output=True,
                                text=True, timeout=60)
        if result.returncode == 0:
            items.append(findings.Finding(
                page="grpc/index.mdx", anchor="", method=name, claim=claim,
                sent=None, response="succeeded, but the page says it cannot",
                verdict="page-defect", manifest_entry=None))

    expect_error(
        "cosmos.staking.v1beta1.Query/Validator",
        ["-d", json.dumps({"validator_addr": values["cosmos.AddressString"]}), grpc,
         "cosmos.staking.v1beta1.Query/Validator"],
        "an account address is rejected where a validator operator address belongs",
    )
    expect_error(
        "cosmos.bank.v1beta1.Msg/Send",
        ["-d", "{}", grpc, "cosmos.bank.v1beta1.Msg/Send"],
        "Msg is not served on the gRPC query port",
    )

    for path, claim in (
        ("/cosmos/mint/v1beta1/params", "a decimal is always a decimal string over REST"),
        (f"/cosmos/bank/v1beta1/balances/{values['cosmos.AddressString']}",
         "a REST path parameter takes a bech32 address"),
    ):
        try:
            with urllib.request.urlopen(f"{rest}{path}", timeout=20) as response:
                json.load(response)
        except Exception as error:  # noqa: BLE001
            items.append(findings.Finding(
                page="index.mdx", anchor="", method=f"GET {path}", claim=claim,
                sent=None, response=str(error), verdict="page-defect", manifest_entry=None))

    return items
```

Call it after the enumerated loop and extend `items` with the result.

- [ ] **Step 3: Delete `smoke.py` and its script**

```bash
git rm smoke.py
```

Remove the `"smoke"` line from `package.json` and the `npm run smoke` row from `scripts/api-reference/CLAUDE.md`.

- [ ] **Step 4: Verify against a chain**

With a local simapp running:

Run: `python3 query-onchain.py --version next`
Expected: the four assertions run, the summary reports 123 enumerated queries plus the four, and the findings count matches what `smoke.py` and `query-onchain.py` reported separately before the fold. Then confirm the negative assertions can fail: point `--grpc` at a chain with `Msg` exposed, or temporarily invert one assertion, and check it is reported.

- [ ] **Step 5: Commit**

```bash
git add query-onchain.py package.json CLAUDE.md
git rm smoke.py
git commit -m "refactor(api-reference): fold smoke into query-onchain, keeping its negative assertions"
```

---

## Task 7: The chain harness and `release-check`

The gate has to be one command, or it will not be run. This is the largest task, and the only one that needs a Go toolchain.

**Files:**
- Create: `chain.py`, `release-check.py`
- Modify: `package.json`, `.github/workflows/sync-sdk-api-reference.yml`

**Interfaces:**
- Consumes: everything above.
- Produces: `chain.running(repository, sha, workdir)`, a context manager yielding `{simd, home, chain_id, node, rest, grpc, key, second_key}`, and `release-check.py` as a CLI.

- [ ] **Step 1: Write `chain.py`**

```python
"""Build simapp at a commit and run it, so a check runs against the documented code.

Version skew produces false failures that cost more to discount than the build
costs to run: the public Hub runs v0.53.4 against pages documenting v0.55.
"""

import json
import os
import shutil
import signal
import subprocess
import time
import urllib.request
from contextlib import contextmanager
from pathlib import Path

CHAIN_ID = "docs-check"
KEY, SECOND_KEY = "docs-primary", "docs-second"


def _run(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, text=True, **kwargs)


def build(repository: str, sha: str, workdir: Path) -> Path:
    """Clone at a SHA and build simd. Returns the binary path."""
    source = workdir / "cosmos-sdk"
    if not source.exists():
        _run(["git", "clone", "--filter=blob:none", f"https://github.com/{repository}.git",
              str(source)])
    _run(["git", "-C", str(source), "fetch", "origin", sha])
    _run(["git", "-C", str(source), "checkout", sha])

    simapp = source / "simapp"
    _run(["go", "build", "-o", str(workdir / "simd"), "./simd"], cwd=str(simapp))
    return workdir / "simd"


def init(simd: Path, home: Path) -> None:
    if home.exists():
        shutil.rmtree(home)
    common = ["--home", str(home), "--keyring-backend", "test"]

    _run([str(simd), "init", "docs", "--chain-id", CHAIN_ID, "--home", str(home)])
    for name in (KEY, SECOND_KEY):
        _run([str(simd), "keys", "add", name, *common])

    genesis = home / "config" / "genesis.json"
    document = json.loads(genesis.read_text())
    denom = document["app_state"]["staking"]["params"]["bond_denom"]

    for name in (KEY, SECOND_KEY):
        address = _run([str(simd), "keys", "show", name, "-a", *common]).stdout.strip()
        _run([str(simd), "genesis", "add-genesis-account", address,
              f"100000000000{denom}", "--home", str(home), "--keyring-backend", "test"])

    _run([str(simd), "genesis", "gentx", KEY, f"70000000000{denom}",
          "--chain-id", CHAIN_ID, *common])
    _run([str(simd), "genesis", "collect-gentxs", "--home", str(home)])

    app = home / "config" / "app.toml"
    text = app.read_text()
    # The runners need both the REST gateway and the gRPC server, and neither is
    # on by default. The reference documents these exact switches.
    text = text.replace("enable = false", "enable = true")
    app.write_text(text)


def wait_for_block(rest: str, timeout: int = 90) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(
                f"{rest}/cosmos/base/tendermint/v1beta1/blocks/latest", timeout=5
            ) as response:
                if int(json.load(response)["block"]["header"]["height"]) >= 1:
                    return
        except Exception:  # noqa: BLE001
            time.sleep(1)
    raise RuntimeError(f"no block within {timeout}s; check the node log")


@contextmanager
def running(repository: str, sha: str, workdir: Path):
    workdir.mkdir(parents=True, exist_ok=True)
    simd = build(repository, sha, workdir)
    home = workdir / "home"
    init(simd, home)

    log = open(workdir / "node.log", "w")
    process = subprocess.Popen(
        [str(simd), "start", "--home", str(home), "--api.enable", "--grpc.enable"],
        stdout=log, stderr=subprocess.STDOUT, preexec_fn=os.setsid,
    )
    try:
        wait_for_block("http://localhost:1317")
        yield {
            "simd": str(simd), "home": str(home), "chain_id": CHAIN_ID,
            "node": "tcp://localhost:26657", "rest": "http://localhost:1317",
            "grpc": "localhost:9090", "key": KEY, "second_key": SECOND_KEY,
        }
    finally:
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        process.wait(timeout=30)
        log.close()
```

The `app.toml` edit is blunt and will need checking against the SDK version in hand. Read the file after `init` and confirm the API and gRPC sections are the ones that flipped, rather than trusting the replace.

- [ ] **Step 2: Verify the harness alone, before wiring anything to it**

```bash
python3 - <<'EOF'
from pathlib import Path
import chain, urllib.request, json
sha = "2086680ff8b08fd269ee653e087ea577bab79534"
with chain.running("cosmos/cosmos-sdk", sha, Path("/tmp/docs-chain")) as c:
    with urllib.request.urlopen(f"{c['rest']}/cosmos/staking/v1beta1/params") as r:
        print(json.load(r)["params"]["bond_denom"])
EOF
```

Expected: prints `stake`, and the process is gone afterwards (`pgrep simd` finds nothing). If the build fails, the SDK version's `simapp` layout differs; adjust the build path and note it in `CLAUDE.md`. Do not proceed to Step 3 until this prints a denom and exits cleanly, because every later failure would otherwise be ambiguous between the harness and the checks.

- [ ] **Step 3: Write `release-check.py`**

```python
#!/usr/bin/env python3
"""The release gate: regenerate, verify offline, then execute every documented
call against a chain built from the same commit.

Run before a freeze. This is the only thing that proves the pages a reader will
copy actually work, so a freeze should not proceed while it is failing.

    python3 release-check.py --version next --ref release/v0.54.x
    python3 release-check.py --version next --dry-run
"""

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import chain
import pagefill

HERE = Path(__file__).resolve().parent


def step(name: str, args: list, **kwargs) -> bool:
    print(f"\n=== {name}")
    result = subprocess.run(args, cwd=str(HERE), **kwargs)
    ok = result.returncode == 0
    print(f"=== {name}: {'ok' if ok else 'FAILED'}")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="next", choices=["next", "latest"])
    parser.add_argument("--ref", default=None,
                        help="upstream ref to generate from; the release branch before a freeze")
    parser.add_argument("--dry-run", action="store_true",
                        help="regenerate into a temporary tree and report the diff, changing nothing")
    parser.add_argument("--workdir", default="/tmp/docs-release-check")
    args = parser.parse_args()

    sync = ["node", "sync-sdk-api-reference.js", "--version", args.version]
    if args.ref:
        sync += ["--ref", args.ref]

    if args.dry_run:
        # Generate against a copy so the working tree is untouched, then show
        # what a real run would change.
        scratch = Path(tempfile.mkdtemp())
        shutil.copytree(HERE.parent.parent / "sdk" / args.version,
                        scratch / "sdk" / args.version)
        if not step("regenerate (dry run)", sync):
            return 1
        subprocess.run(["git", "--no-pager", "diff", "--stat",
                        f"--", f"sdk/{args.version}/api-reference"],
                       cwd=str(HERE.parent.parent))
        subprocess.run(["git", "checkout", f"sdk/{args.version}/api-reference"],
                       cwd=str(HERE.parent.parent))
        print("\nDry run: working tree restored. Findings above are what a real run would change.")
        return 0

    if not step("regenerate", sync):
        return 1

    offline = [
        ("unit tests", ["npm", "test"]),
        ("example encoding", ["python3", "verify-transaction-examples.py"]),
    ]
    for name, command in offline:
        if not step(name, command):
            return 1

    repository, sha = pagefill.generated_from(args.version)
    print(f"\nBuilding a chain at {repository}@{sha[:12]}")

    with chain.running(repository, sha, Path(args.workdir)) as node:
        onchain = [
            ("REST conformance", ["python3", "conformance.py", "--rest", node["rest"]]),
            ("documented queries", ["python3", "query-onchain.py", "--version", args.version,
                                    "--grpc", node["grpc"], "--rest", node["rest"]]),
            ("documented transactions", ["python3", "tx-onchain.py", "--version", args.version,
                                         "--simd", node["simd"], "--home", node["home"],
                                         "--chain-id", node["chain_id"], "--node", node["node"],
                                         "--rest", node["rest"], "--key", node["key"],
                                         "--second-key", node["second_key"]]),
        ]
        failed = [name for name, command in onchain if not step(name, command)]

    if failed:
        print(f"\n{len(failed)} check(s) failed: {', '.join(failed)}")
        print("Findings are in findings-*.json. Do not freeze until these are resolved or recorded.")
        return 1

    print("\nAll checks passed. Safe to freeze.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

Add `generated_from(version) -> (repository, sha)` to `pagefill.py`, reading the `Generated from <repo> at commit <sha>` line from `sdk/<version>/api-reference/rest/openapi.yaml`. Task 5 needs the same helper, so implement it there and reuse it here.

- [ ] **Step 4: Add the scripts**

In `package.json`:

```json
    "release-check": "python3 release-check.py",
```

- [ ] **Step 5: Verify both modes**

Run: `npm run release-check -- --version next --dry-run`
Expected: prints a diff stat, restores the tree, exits 0. Confirm with `git status` that nothing under `sdk/` is modified.

Run: `GITHUB_TOKEN=$(gh auth token) npm run release-check -- --version next`
Expected: every step reports ok, and the final line is `All checks passed. Safe to freeze.` A failing on-chain step is acceptable on the first run if it reproduces a known gap already recorded in a manifest; anything else is a real finding to fix before the task is done.

- [ ] **Step 6: Strip the schedule from the workflow**

In `.github/workflows/sync-sdk-api-reference.yml`, delete the `schedule:` block and its cron, keeping `workflow_dispatch` and its `version` input. Replace the header comment's claim about weekly regeneration:

```yaml
# Regenerates the SDK API reference on demand.
#
# There is no schedule. Docs versions freeze at release, published `latest` does
# not change between releases, and the release process is the gate: see
# .claude/skills/release-version/SKILL.md and scripts/api-reference/DESIGN.md.
#
# A guard failure is routed to an issue rather than left as a red run nobody
# watches. Those guards fire when a fact that cannot be derived from the protos
# needs writing by hand, and they name the exact item.
```

Add `--version` handling for `next` only by default, since regenerating `latest` outside a release rewrites frozen pages.

- [ ] **Step 7: Commit**

```bash
git add chain.py release-check.py package.json pagefill.py ../../.github/workflows/sync-sdk-api-reference.yml
git commit -m "feat(api-reference): one release gate that builds a chain and runs every documented call"
```

---

## Task 8: Documentation

**Files:**
- Create: `.claude/skills/release-version/SKILL.md`
- Modify: `CLAUDE.md` (root, lines 129-210), `scripts/api-reference/CLAUDE.md`, `scripts/api-reference/DESIGN.md`, `work-log/sdk-api-reference.md`

- [ ] **Step 1: Write the release skill**

Create `.claude/skills/release-version/SKILL.md` with front matter:

```markdown
---
name: release-version
description: Use when releasing a new docs version for a product, freezing next to latest, or running the versioning scripts. Covers the ordered pre-freeze checks, the freeze itself, and the docs.json edits it does not do for you.
---
```

The body moves the procedure from the root `CLAUDE.md:129-210` verbatim, with three changes:

1. Step 2b becomes the `release-check` gate, run with `--ref` pointing at the release branch, and states that a freeze does not proceed while it fails.
2. A new optional pre-flight at the top: `npm run release-check -- --version next --dry-run`, a week before a planned freeze, so drift is not discovered on release day.
3. A note that `--ref` is required for a pre-freeze regeneration, because `next` otherwise resolves to `main` and the freeze would publish development content under the release's version number.

Keep the existing ordering rationale verbatim, especially "Do this before freezing, not after."

- [ ] **Step 2: Shrink the root `CLAUDE.md`**

Replace lines 129-210 with:

```markdown
## Releasing a New Version

The procedure lives in [`.claude/skills/release-version/SKILL.md`](.claude/skills/release-version/SKILL.md). It covers the ordered pre-freeze checks, the freeze, and the `docs.json` edits the script does not make for you.

Two things worth knowing without opening it: version-pinned content is fixed in `next/` before the freeze rather than in `latest/` after, and the SDK API reference has a blocking gate (`scripts/api-reference` `npm run release-check`) that executes every documented query and transaction against a chain built from the release commit.
```

Verify nothing else in the repo linked to the removed anchors:

```bash
grep -rn "releasing-a-new-version\|#2b-regenerate" --include='*.md' --include='*.mdx' . | grep -v node_modules
```

- [ ] **Step 3: Correct `scripts/api-reference/CLAUDE.md`**

Rewrite the commands block to list `test-py`, `query-onchain`, `tx-onchain`, and `release-check`, and drop `smoke`. Then replace the stale first paragraph of the testing philosophy section, which currently reads that exhaustive live execution is deliberately not attempted:

```markdown
## Testing philosophy

Every defect found in this reference was a class rather than an instance, because a generator makes the same mistake on every page. So the unit tests assert classes rather than instances.

Live execution is exhaustive: `query-onchain` runs all 123 documented queries and `tx-onchain` all 48 transaction messages, filled from what each page states. A command that cannot be used as written fails there, and the exceptions that genuinely cannot work are recorded in the manifests with a reason.

The limit worth knowing: no automated check distinguishes a wrong documented value from missing chain state. A commission rate documented in the wrong encoding fails with a business error, indistinguishable from a chain that has no validator. That judgment needs a person, or an agent reading the findings file, and is worth re-running when the SDK version changes.
```

- [ ] **Step 4: Record what changed in `DESIGN.md`**

Add to item 4 that the tx manifest's separate `[unfillable]` table folded into `expect = "unfillable"`, so unification removed a concept rather than aligning two shapes. Add to item 2 that the inventory is names only, and why that does not violate the invariant.

- [ ] **Step 5: Log it**

Append to `work-log/sdk-api-reference.md` under a dated heading: the eight changes, one line each, and the `--ref` bug in one sentence since it is the reader-facing one.

- [ ] **Step 6: Full verification**

```bash
npm test && npm run test-py && npx --yes mint broken-links
```

Expected: all pass. Then `npm run release-check -- --version next --dry-run` once more, and confirm `git status` shows only the intended files.

- [ ] **Step 7: Commit**

```bash
git add ../../.claude/skills/release-version/SKILL.md ../../CLAUDE.md CLAUDE.md DESIGN.md ../../work-log/sdk-api-reference.md
git commit -m "docs(api-reference): move the release procedure into a skill and correct the testing notes"
```

---

## Deferred

Item 9 of `DESIGN.md`, the machine-readable claims sidecar, is not in this plan. Task 2 closes the failure mode that justified it for ten lines, so the sidecar now buys quieter failure rather than more correctness. Build it when a render change actually trips the completeness guard, or when a second product needs the same parse.
