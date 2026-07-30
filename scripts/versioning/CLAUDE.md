# scripts/versioning — AI context

This directory contains versioning and changelog management scripts for the Cosmos docs site. All scripts use ES module syntax (`import`/`export`) and require Node >= 18.

## npm scripts (package.json)

| Command | Script |
| ------- | ------- |
| `npm run freeze` | `version-manager.js` |
| `npm run changelogs` | `manage-changelogs.js` |
| `npm run sheets` | `sheets-manager.js` |
| `npm run test` | `test-versioning.js` |

---

## version-manager.js — version freeze

The main freeze orchestration script. Implements the `next → latest → archive` model.

### Usage

```bash
# Interactive
npm run freeze

# Non-interactive
NON_INTERACTIVE=1 SUBDIR=sdk NEW_DISPLAY_VERSION=v0.54 npm run freeze

# Non-interactive with explicit archive version (when latest/ already exists)
NON_INTERACTIVE=1 SUBDIR=sdk NEW_DISPLAY_VERSION=v0.54 ARCHIVE_VERSION=v0.53 npm run freeze
```

### What it does

**First-time freeze (no `latest/` yet):**

1. Copies `<product>/next/` → `<product>/latest/`
2. Rewrites internal links in `latest/`: `/<product>/next/` → `/<product>/latest/` using Perl regex that preserves external `https://` URLs
3. Strips `noindex: true` and `canonical:` front matter from all promoted `latest/` files
4. Injects `noindex: true` + `canonical:` into all `next/` files (canonical points at the equivalent `latest/` page, or falls back to `/<product>/latest/`)
5. Updates `versions.json`: adds `latest` to versions list, sets `defaultVersion: latest`, sets `latestDisplayVersion`
6. **Does not update `docs.json`** — prints a warning. The `latest/` nav entry must be added manually.

**Subsequent freeze (when `latest/` already exists):**

1. Copies `latest/` → `<archiveVersion>/`, rewrites internal links `latest/` → `<archiveVersion>/`, injects `noindex`/`canonical` into all archived files
2. Attempts to generate a version-specific changelog for the archive via `manage-changelogs.js --freeze`
3. Promotes `next/` → `latest/` (same as first-time steps 2–4 above)
4. Updates `docs.json` navigation: clones the `latest` nav entry to create the archive entry, updates version labels and `tag: 'Latest'`
5. Updates `versions.json`
6. Creates `.version-metadata.json` and `.version-frozen` marker files in the archive directory

### Known limitation — docs.json nav update

The `updateNavigation` function looks for the product's dropdown by `subdir.toUpperCase()` (e.g. `'SDK'`). The actual dropdown labels in `docs.json` are `'Cosmos SDK'`, `'IBC Protocol'`, `'CometBFT'`, `'Cosmos Hub'` — none of which match. This means **`docs.json` nav updates are always manual**, even on subsequent freezes. The nav update step must be done by hand after every freeze.

### Manual docs.json update after a freeze

After every freeze, add a `latest` version entry to the product's dropdown in `docs.json`:

1. Clone the `next` version entry
2. Rewrite all page paths: `<product>/next/` → `<product>/latest/`
3. Set `"version": "<displayVersion>"`, `"tag": "Latest"`, `"default": true`
4. Give `next` the `"tag": "Unreleased"` field
5. Order: `latest [Latest, default]` → `next [Unreleased]` → stable archived newest-first
6. Check redirects to make sure they are redirected properly.

### Manual checklist around every freeze

The freeze script does not do any of the following. None of it is caught by `npx mint broken-links`.

Order matters. Items 2 and 4 are content that lives in the pages themselves, so do them in `next/` **before** freezing and the promotion carries them into `latest/` for free. Doing them afterwards means editing `latest/` and then running `scripts/sync-latest-to-next.js` on every file touched, which is the same work twice with a chance to miss a file. Item 1 can only be done after, and item 3 must be done after because the freeze is what strips the front matter.

**1. `docs.json` navigation** (after) — see the section above.

**2. Version label in front matter (SDK only, do before).** Five pages carry the displayed version in their `description`, which is what renders as "Version: v0.54" under the page title. Bump all five in both `latest/` and `next/`:

```
sdk/<latest|next>/learn.mdx
sdk/<latest|next>/tutorials.mdx
sdk/<latest|next>/reference/spec.mdx
sdk/<latest|next>/reference/rfc.mdx
sdk/<latest|next>/reference/architecture.mdx
```

```bash
grep -rn 'description: "Version: v' sdk/latest sdk/next --include='*.mdx'
```

Archived directories keep their own version and must not be touched. Only the SDK uses this pattern; the other products do not.

**3. Changelog front matter (after).** `manage-changelogs.js` overwrites the whole file and does not preserve front matter, so a changelog regenerated after the freeze has already tagged it loses its `noindex` and `canonical`. Re-add them to `<product>/next/changelog/release-notes.mdx` and re-run `tag-archived.js` for the archive directory. Verify with:

```bash
for p in sdk cometbft; do for f in $(find $p/next -name '*.mdx'); do head -12 "$f" | grep -q noindex || echo "$f"; done; done
```

**4. GitHub links pinned to the previous version (do before).** Pages link into the product repo at a version-tracking ref, and those refs do not follow the freeze. After promoting SDK v0.55, `sdk/latest/` still held 96 links to `release/v0.54.x`; CometBFT at v0.40 still held 82 to `v0.38.x`. See the section below, because a blind find-and-replace is the wrong fix.

### GitHub link refs — do not blind-replace

Refs fall into three groups and only the first should ever be bumped:

| Ref shape | Treatment |
| --------- | --------- |
| `release/v0.<N>.x` (SDK), `v0.<N>.x` (CometBFT) | Version-tracking. Bump on freeze. |
| `main`, `master` | Always current, never stale in the version sense, but line anchors silently rot as upstream moves. |
| Pinned tag (`v0.47.0-rc1`) or 40-char SHA | Deliberate historical citation. Leave alone. Bumping changes what the prose is referring to. |

The hazard is line anchors (`#L127`). Bumping the ref while leaving the line number is worse than staying on the old ref, because the link keeps working while pointing at unrelated code. Measured on the v0.54 to v0.55 SDK freeze, of 39 line-anchored `release/v0.54.x` links:

- 29 anchors still landed on the same line of code
- 7 had moved, with the original line findable uniquely elsewhere in the file
- 1 anchored line was deleted upstream, 1 file was deleted, 1 was ambiguous

So roughly a quarter would have pointed somewhere wrong. CometBFT was worse, since it had drifted two minor versions: only 4 of 12 anchors survived.

#### The check that works

Per link: does the path exist at the new ref, then does the line number still mean the same thing.

**Path existence.** Compare against the full file tree at each ref rather than probing URLs one at a time:

```bash
curl -sL "https://api.github.com/repos/cosmos/cosmos-sdk/git/trees/release/v0.55.x?recursive=1"
```

Check the `truncated` field; it was `false` for both products at ~5,000 entries. Measured on this freeze, 93 of 96 SDK paths and 77 of 82 CometBFT paths survived the bump, so disappearance is the rare case.

Two traps produce false positives here, and both bit on the first pass:

- URL-decode the path first. `spec/abci/abci%2B%2B_methods.md` is `abci++_methods.md` in the tree and resolves fine.
- A `/blob/` URL pointing at a directory is valid. GitHub redirects it to `/tree/`, returning 200.

**Line numbers.** Use git, not content matching. Content equality cannot tell a moved line from a coincidentally identical one, which is how a `query.proto#L108` link produced six candidate lines. Git resolves it deterministically:

```bash
git init -q --bare refcheck && cd refcheck
git remote add origin https://github.com/cosmos/cosmos-sdk.git
git fetch -q --depth=1 origin 'release/v0.54.x:refs/heads/old' 'release/v0.55.x:refs/heads/new'

# renames, with similarity scoring
git diff --find-renames --name-status old new

# exact line mapping for one file
git diff -U0 old new -- <path>
```

`--find-renames` is what makes rename detection usable. Matching on basename does not work: `store.go` had 23 candidates across the tree.

For a line anchor, read the hunk headers from `git diff -U0`. A line outside every hunk moves by the cumulative offset, which is a safe automatic rewrite. A line inside a changed hunk was edited or deleted, which is a human decision. Do not guess.

**Verdicts.** Four outcomes, not two:

| Verdict | Action |
| ------- | ------ |
| Path exists, anchor unaffected | Bump the ref |
| Path exists, anchor moved outside any hunk | Bump the ref and rewrite the line number |
| Path renamed, deleted, or anchor inside a changed hunk | Flag for a human |
| Already 404 at the current ref | Flag, and read the page before repointing it |

That last verdict is the valuable one. It found `store/tracekv/store.go`, dead since v0.54, which was the symptom of a page still documenting store tracing after upstream removed the API.

### Version format validation

`newDisplayVersion` and `archiveVersion` must match `/^v\d+\.\d+(?:\.(?:\d+|x))?$/` — e.g. `v0.54`, `v11.0.x`, `v0.38`. Single-component versions like `v25` will fail validation.

---

## tag-archived.js — retroactive noindex/canonical injection

Standalone utility for injecting `noindex: true` and `canonical:` front matter into pre-existing archived version directories. Run this once when first setting up the `latest/` model for a product, or whenever archived dirs need to be tagged.

### Usage

```bash
# Tag a single version
node tag-archived.js --product sdk --version v0.50

# Tag all archived versions for a product
node tag-archived.js --product sdk --all

# Tag all archived versions across all products
node tag-archived.js --all-products --all

# Dry run — see what would change without writing files
node tag-archived.js --all-products --all --dry-run

# Override the canonical base URL
node tag-archived.js --product sdk --all --base-url https://docs.cosmos.network
```

### What it does

For each `.mdx` file in the targeted archive directory:

1. Skips files that already have `noindex:` in front matter
2. Determines canonical URL: checks whether the equivalent page exists in `<product>/latest/`; if yes, uses `https://docs.cosmos.network/<product>/latest/<page>`; if no, falls back to `https://docs.cosmos.network/<product>/latest/`
3. Injects `noindex: true` and `canonical:` at the top of the existing front matter block (or creates a new front matter block if none exists)

Only targets directories whose names match `/^v\d+/`. Never touches `next/` or `latest/`.

---

## manage-changelogs.js — changelog generation

Fetches `CHANGELOG.md` from a product's GitHub repository and generates Mintlify MDX release notes using `<Update>` components.

### Usage

```bash
# Generate changelog for next (all versions)
npm run changelogs -- --product evm --target next

# Generate changelog for a specific version directory
npm run changelogs -- --product sdk --target v0.53

# Generate all changelogs for a product
npm run changelogs -- --product ibc --all

# Dry run — output to ./tmp instead of modifying real files
npm run changelogs -- --product evm --all --staging
```

### Options

| Flag | Description |
| ---- | ----------- |
| `--product <name>` | Product name — `evm`, `sdk`, `ibc`, `hub`, etc. Defaults to `evm` |
| `--target <version>` | Target version directory (`next`, `v0.5.0`, `v0.4.x`, etc.) |
| `--filter <pattern>` | Version filter prefix (e.g. `v0.5` to include only `v0.5.x` releases) |
| `--all` | Generate changelogs for all versions listed in `versions.json` |
| `--freeze` | Flag set by `version-manager.js` during a freeze — no behavioral difference currently |
| `--source <ref>` | Git ref to fetch from. Defaults to `main` |
| `--staging` | Write output to `./tmp/changelogs/<product>/<target>/` instead of the real path |

### What it does

1. Reads repository and changelog path from `versions.json` for the given product
2. Fetches the changelog file from `https://raw.githubusercontent.com/<repo>/<source>/<path>` — tries multiple fallback paths (`CHANGELOG.md`, `RELEASE_NOTES.md`, etc.)
3. Parses markdown changelog format: `##` version headers, `###` section headers, bullet point changes
4. Skips `[Unreleased]` sections
5. Sanitizes content for MDX: escapes `<`, `>`, `<=`, `>=` operators; preserves markdown links
6. Generates `release-notes.mdx` at `<product>/<target>/changelog/release-notes.mdx`
7. If `--target` is a versioned directory (not `next`), automatically filters to only include releases matching the version prefix (e.g. target `v0.5.0` → filter `v0.5`)

Called automatically by `version-manager.js` during the archive step of a freeze.

---

## sheets-manager.js — EVM EIP data versioning

**EVM only.** Snapshots the EIP compatibility Google Sheet into a version-specific tab, and generates the corresponding MDX file pointing at that tab.

### Usage

```bash
npm run sheets v0.5.0
```

### What it does

1. Authenticates with Google Sheets API using a service account key (see below)
2. Reads all data from the `eip_compatibility_data` tab in the configured spreadsheet
3. Creates a new tab named after the version (deletes any existing tab with that name first)
4. Copies all data into the new tab
5. Generates `evm/<version>/documentation/evm-compatibility/eip-reference.mdx` with `<EIPCompatibilityTable sheetTab="<version>" />`

### Credentials

Requires one of:
- `scripts/versioning/service-account-key.json` (git-ignored)
- `GOOGLE_SERVICE_ACCOUNT_KEY` environment variable pointing to the key file path

See `GSHEET-SETUP.md` for setup instructions.

The spreadsheet ID is hardcoded in the script. Do not change it without updating the `eip-compatibility-table.jsx` snippet as well.

---

## restructure-navigation.js — legacy utility

**Effectively a no-op with the current repo structure.** This script was written before the `dropdowns`-based navigation model was adopted. It detects `navigation.dropdowns` in `docs.json` and exits immediately without making any changes.

The legacy code path (never reached) would convert a `navigation.tabs` structure into a `navigation.versions` array and sort it by version. Do not rely on this script for anything.

---

## test-versioning.js — setup validation

Validates that the versioning environment is correctly configured. Requires Google Sheets credentials.

```bash
npm run test
```

Checks:
1. `node_modules` exists and `googleapis` is installed
2. `service-account-key.json` is present — **exits with an error if missing**
3. Runs `sheets-manager.js test-version` to verify the Google Sheets connection
4. Runs `manage-changelogs.js --product evm --target next` to verify changelog fetching

This test is only useful if you have Google Sheets credentials configured. It will always fail without them.

---

## versions.json

Top-level registry at `docs/versions.json`. Tracks configuration per product.

```json
{
  "products": {
    "sdk": {
      "versions": ["latest", "next", "v0.53", "v0.50", "v0.47"],
      "defaultVersion": "latest",
      "latestDisplayVersion": "v0.54",
      "repository": "cosmos/cosmos-sdk",
      "changelogPath": "CHANGELOG.md"
    }
  }
}
```

Key fields:
- **versions** — ordered list of version directories. `latest` and `next` first, then stable newest-first. Auto-discovered from the filesystem and merged with existing entries on each run of `version-manager.js`.
- **defaultVersion** — set to `latest` after first freeze
- **latestDisplayVersion** — the human-readable label shown in the nav badge (e.g. `v0.54`)
- **repository** — GitHub repo for changelog fetching
- **changelogPath** — path to changelog within the repo

`versions.json` is read and written by both `version-manager.js` and `manage-changelogs.js`.
