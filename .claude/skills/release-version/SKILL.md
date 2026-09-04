---
name: release-version
description: Use when releasing a new docs version for a product, freezing next to latest, or running the versioning scripts. Covers the ordered pre-freeze checks, the freeze itself, and the docs.json edits it does not do for you.
---

# Releasing a New Version

When a product is ready to release, complete these steps in order.

### 0. Optional pre-flight (SDK, up to a week ahead)

Before committing to a freeze date, check how far the API reference has drifted from upstream without touching anything:

```bash
cd scripts/api-reference && npm run release-check -- --version next --dry-run
```

This copies the generated pages and `docs.json` aside, regenerates them in place, reports what would change, then restores them from the copy, so the working tree ends where it started. It is not read-only while it runs: commit or stash uncommitted work under `sdk/<version>/api-reference` or `docs.json` first, because a run killed outright leaves the only copy in the scratch directory it prints on startup. Run it a week or so before a planned freeze so drift is discovered while there is still time to investigate it, not on release day when the only options are to fix it under pressure or ship it anyway.

### 1. Update the Changelog

Update the changelog in `next/` first, so it carries over when the freeze copies `next/` to `latest/`. If the new version is still listed as `## Unreleased` in the upstream `CHANGELOG.md`, use `--unreleased-as` to label it correctly.

```bash
# If the version is released in CHANGELOG.md
cd scripts/versioning && npm run changelogs -- --product <product> --target next --source <tag> --current-only

# If the version is still listed as Unreleased in CHANGELOG.md
cd scripts/versioning && npm run changelogs -- --product <product> --target next --source <tag> --unreleased-as <version> --current-only
```

### 2. Update Version-Pinned Content in `next/`

Do this before freezing, not after. The freeze copies `next/` to `latest/`, so anything fixed in `next/` first lands in both directories in one pass. Fixing it afterwards means editing `latest/` and then syncing every file back to `next/`.

Two things are version-pinned and do not follow the freeze on their own:

**Version label in front matter (SDK only).** Five pages render the version under the page title via their `description`:

```bash
grep -rn 'description: "Version: v' sdk/next --include='*.mdx'
```

**GitHub links pinned to the previous release branch.** Pages link into the product repo at `release/v0.<N>.x` (SDK) or `v0.<N>.x` (CometBFT), and those refs keep pointing at the old version. Use the checker rather than a find-and-replace:

```bash
node scripts/versioning/check-github-refs.js --product <product> --targets next --json /tmp/flags.json
```

Review the report, then apply the safe rewrites with `--fix`. It bumps only what it can prove is safe and flags the rest.

Do not blind-replace these by hand. Pinned tags and commit SHAs are deliberate historical citations, and bumping a ref under a `#L` line anchor can leave the link working while pointing at unrelated code. See the GitHub link section in [`scripts/versioning/CLAUDE.md`](../../../scripts/versioning/CLAUDE.md) for the rules and the measured failure rates.

Hand the `--json` output to the [`update-stale-refs`](../update-stale-refs/SKILL.md) skill, which decides whether a flagged link means the page's prose needs a correction.

A stale ref is often a symptom rather than the problem. A link that 404s at its current ref usually means the prose describes something upstream deleted, so check what the page claims before repointing the URL.

### 2b. Regenerate and gate the API Reference (SDK only)

The SDK API reference is generated from upstream protos at a resolved commit. Regenerate before freezing rather than after, for the same reason as step 2: the freeze changes which ref `latest` points at, and fixing content in `next/` first lands it in both directories in one pass.

There is no scheduled regeneration any more, so this step is the only mechanism that keeps the reference current. If you remember a weekly workflow opening regeneration PRs, that is gone: docs versions freeze at release and published `latest` must not change between releases, and a cron cheap enough to run weekly can only report that upstream moved, which carries no decision attached. See [`scripts/api-reference/DESIGN.md`](../../../scripts/api-reference/DESIGN.md) for the fuller reasoning.

```bash
cd scripts/api-reference && npm run release-check -- --version next --ref release/v0.<N>.x
```

Pass `--ref` pointing at the release branch. Without it, `next` resolves to `main`, and a freeze taken from that regeneration publishes development content under the release's version number, which is the bug this gate exists to catch.

`release-check` regenerates, runs the offline checks, builds `simd` from the exact commit the pages record, starts a chain on its own ports, and runs every documented query and transaction message against it. This is a blocking gate: a freeze does not proceed while it fails. Needs Go, Node, git, `schemathesis`, and `GITHUB_TOKEN` in the environment (`export GITHUB_TOKEN=$(gh auth token)`); it says which are missing before it builds anything.

If generation fails, a guard has fired: a fact that cannot be derived from the protos needs writing by hand, and the error names the exact item. See [`scripts/api-reference/CLAUDE.md`](../../../scripts/api-reference/CLAUDE.md).

### 2c. Read the generated prose (SDK only)

The gate proves that what a page tells a reader to send is accepted by a chain. Nothing in it reads the page as English, so a field can carry a correct type, a working example, and a description that is a fragment, a typo, or advice contradicting the page above it.

Use the [`review-generated-prose`](../review-generated-prose/SKILL.md) skill on the regenerated pages. It is the last step before the freeze, because the freeze copies whatever is in `next/` into `latest/` and publishes it.

The one thing to know before starting: never edit a generated page. Every `.mdx` under `api-reference/grpc/` is overwritten on the next run, so a fix belongs either in `lib/render.js`, where the generator's own wording lives, or upstream in the proto comments a description came from. The skill covers how to tell which.

### 3. Freeze the Version

Run the freeze script from `scripts/versioning/`. This promotes `next/` to `latest/`, rewrites all internal links, injects `noindex` into `next/` pages, and updates `versions.json`.

```bash
cd scripts/versioning
NON_INTERACTIVE=1 SUBDIR=<product> NEW_DISPLAY_VERSION=<version> npm run freeze
```

Then manually update `docs.json` for the product's dropdown:

- Add a new version entry cloned from `next/`, with all paths rewritten from `<product>/next/` to `<product>/latest/`
- Set `"tag": "Latest"` and `"default": true` on the `latest/` entry
- Set `"tag": "Unreleased"` on the `next/` entry
- Order: `latest` first, then `next`, then archived versions newest-first

If the product has pre-existing archived version directories (e.g. `v0.53/`, `v10.1.x/`), tag them with `noindex` and `canonical`:

```bash
node tag-archived.js --product <product> --all
```

### 4. Check for Broken Links

```bash
npx mint broken-links
```

Fix any broken links before committing. Note that this checks internal page paths only. It does not validate heading anchors and it does not check external URLs, so nothing here catches a dead or misdirected GitHub link.
