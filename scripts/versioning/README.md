# Documentation Versioning System

Unified versioning scripts for the Cosmos documentation site (Mintlify). Covers all products: `sdk`, `ibc`, `evm`, `cometbft`, `hub`, etc.

## Model: next → latest → archive

Every product has three directory tiers:

| Directory | Purpose | SEO |
| --------- | ------- | --- |
| `<product>/next/` | Active development — unreleased changes | `noindex` (add manually to MDX front matter) |
| `<product>/latest/` | Current stable release — accumulates Google ranking | Indexed, canonical |
| `<product>/v0.53/` etc. | Archived releases — preserved for reference | `noindex: true` + `canonical:` pointing at `latest/` |

**Why `latest/`?** A stable URL means SEO equity is never lost on a version bump. When you ship `v0.54`, the URL `/sdk/latest/` stays the same — only the content changes. Archived pages redirect search engines to the equivalent page in `latest/`.

### Directory layout

```text
sdk/
├── next/       ← active development (pre-release)
├── latest/     ← current stable (SEO-indexed)
├── v0.53/      ← archived (noindex + canonical → latest)
├── v0.50/      ← archived
└── v0.47/      ← archived
```

---

## Version freeze process (end-of-release runbook)

When a new release is ready to ship, run through these steps in order.

### 1. Merge all in-progress `next/` content

Make sure `next/` contains everything that belongs in the new release. Merge any open PRs targeting `next/`.

### 2. Run the freeze script

```bash
cd scripts/versioning
npm run freeze
```

The script will prompt for:

- **Product** — e.g. `sdk`, `ibc`
- **New display version** — the label for the outgoing `latest/` when it becomes an archive (e.g. `v0.54`)

**What happens internally:**

1. Reads `versions.json` to find the current `latestDisplayVersion` (e.g. `v0.53`)
2. Copies `latest/` → `v0.53/` (archive)
3. Rewrites internal links in the archive: `/sdk/latest/` → `/sdk/v0.53/`
4. Injects `noindex: true` + `canonical:` into every MDX file in the archive
5. Copies `next/` → `latest/` (promote)
6. Rewrites internal links in the new `latest/`: `/sdk/next/` → `/sdk/latest/`
7. Clones the `latest` nav entry in `docs.json` to create a new `v0.53` nav entry
8. Updates the `latest` nav badge to reflect the new display version (`v0.54`)
9. Updates `versions.json` with new `latestDisplayVersion`

**Non-interactive:**

```bash
NON_INTERACTIVE=1 SUBDIR=sdk NEW_DISPLAY_VERSION=v0.54 npm run freeze
```

### 3. Verify locally

```bash
npx mint dev
```

Check that `/sdk/latest/` loads correctly and `/sdk/v0.53/` shows the archived notice (if any).

### 4. Commit and push

```bash
git add -A
git commit -m "docs: freeze sdk v0.53, promote next to latest (v0.54)"
git push
```

---

## Retroactive archiving: `tag-archived.js`

If existing versioned directories predate the `latest/` model (e.g. `sdk/v0.50`, `sdk/v0.47`), run `tag-archived.js` to inject `noindex` + `canonical` front matter into those files.

### Usage

```bash
# Tag a single version
node tag-archived.js --product sdk --version v0.50

# Tag all archived versions for a product
node tag-archived.js --product sdk --all

# Tag all archived versions across all products
node tag-archived.js --all-products --all

# Dry-run: see what would change without modifying files
node tag-archived.js --product sdk --all --dry-run

# Override the canonical base URL
node tag-archived.js --product sdk --all --base-url https://docs.cosmos.network
```

### What it does

For each `.mdx` file in the targeted archive directory:

1. Skips files that already have `noindex:` in front matter
2. Checks whether the equivalent page exists in `<product>/latest/`
   - If yes → `canonical: 'https://docs.cosmos.network/<product>/latest/<page>'`
   - If no  → `canonical: 'https://docs.cosmos.network/<product>/latest/'` (fallback to root)
3. Injects `noindex: true` and `canonical:` at the top of the front matter block
4. Writes the file in place

Run this once per product when first setting up the `latest/` model, then the freeze script handles archiving automatically going forward.

---

## Changelog management

```bash
# Generate changelog for next (all versions)
npm run changelogs -- --product evm --target next

# Generate changelog for specific version directory
npm run changelogs -- --product evm --target v0.5.0

# Generate all changelogs for a product
npm run changelogs -- --product evm --all

# Test without modifying files (output to ./tmp)
npm run changelogs -- --product evm --all --staging
```

Release notes are fetched from the GitHub repositories configured in `versions.json`:

| Product | Repository |
| ------- | ---------- |
| evm | `cosmos/evm` |
| sdk | `cosmos/cosmos-sdk` |
| ibc | `cosmos/ibc-go` |
| hub | `cosmos/gaia` |

---

## versions.json

The top-level `versions.json` tracks configuration per product.

```json
{
  "products": {
    "sdk": {
      "versions": ["next", "latest", "v0.53", "v0.50", "v0.47"],
      "defaultVersion": "latest",
      "latestDisplayVersion": "v0.53",
      "repository": "cosmos/cosmos-sdk",
      "changelogPath": "CHANGELOG.md"
    }
  }
}
```

Key fields:

- **versions** — all available version directories (auto-discovered from filesystem and merged)
- **defaultVersion** — shown to users by default; should be `latest` once `latest/` exists
- **latestDisplayVersion** — the human-readable release label shown in the navigation badge (e.g. `v0.53 (Latest)`)
- **repository** — GitHub repo for changelog fetching
- **changelogPath** — path within the repo (default: `CHANGELOG.md`)

---

## noindex convention for `next/`

The `next/` directory contains pre-release documentation. It is not blocked by the freeze script — you are responsible for adding `noindex: true` to pages in `next/` if you want to prevent search engines from indexing unreleased content.

To add noindex to all files in a `next/` directory:

```bash
node tag-archived.js --product sdk --version next --base-url https://docs.cosmos.network
```

> **Note:** This will set the canonical to `/sdk/latest/` for each page, which is correct — it tells Google the authoritative version is `latest/`.

---

## Link rewriting

The freeze script uses Perl (not sed) for link replacement because Perl can skip external URLs while rewriting internal paths:

```perl
s{(https?://\S+)|/sdk/next/}{defined($1)?$1:"/sdk/latest/"}ge
```

This pattern:

1. Matches a full `https://` or `http://` URL → returns it unchanged
2. Otherwise matches the internal path prefix → replaces it

This prevents GitHub links like `https://github.com/cosmos/cosmos-sdk/blob/release/v0.53.x/...` from being accidentally rewritten.

---

## Scripts reference

| Script | Command | Purpose |
| ------ | ------- | ------- |
| `version-manager.js` | `npm run freeze` | Full version freeze workflow |
| `tag-archived.js` | `node tag-archived.js` | Inject noindex/canonical into archived dirs |
| `manage-changelogs.js` | `npm run changelogs` | Fetch and update release notes |
| `test-versioning.js` | `npm run test` | System validation |

---

## File structure

```text
scripts/versioning/
├── README.md                  # This file
├── GSHEET-SETUP.md            # Google Sheets API setup (EVM only)
├── SECURITY-SYNC.md           # Security docs sync system
├── version-manager.js         # Main freeze orchestration
├── tag-archived.js            # Retroactive noindex/canonical injection
├── manage-changelogs.js       # Unified changelog management
├── sheets-manager.js          # Google Sheets operations (EVM only)
├── test-versioning.js         # System testing
├── restructure-navigation.js  # Navigation cleanup utility
├── package.json
└── service-account-key.json   # Google service account (git-ignored)
```

---

## Related

- [CLAUDE.md](../../CLAUDE.md) — AI assistant context and Mintlify constraints
- [GSHEET-SETUP.md](./GSHEET-SETUP.md) — Google Sheets API setup for EVM EIP tables
- [Mintlify docs](https://mintlify.com/docs) — MDX reference
