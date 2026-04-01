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
