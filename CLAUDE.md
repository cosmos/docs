# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Notes and sync

You must do the following every time you work on something:

1. ALWAYS log meaningful changes as they are completed. Each branch gets its own file in `work-log/`. See [`work-log/CLAUDE.md`](work-log/CLAUDE.md).
2. After editing any files in `latest/`, run `node scripts/sync-latest-to-next.js <file-or-dir>` to apply the same changes to `next/`.

## Products

Each product lives in its own top-level directory:

| Directory | Product |
| --------- | ------- |
| `evm/` | Cosmos EVM |
| `sdk/` | Cosmos SDK |
| `hub/` | Cosmos Hub |
| `cometbft/` | CometBFT |
| `ibc/` | IBC Protocol |
| `skip-go/` | Skip Go |
| `enterprise/` | Cosmos Enterprise (not versioned) |

Each versioned product directory has:

- `latest/` — current stable release, default for site visitors. Edit here for stable doc changes.
- `next/` — active development. Default working directory for new content.
- `v0.53/`, `v10.1.x/`, etc. — archived versions. Do not edit these.

After editing files in `latest/`, run `node scripts/sync-latest-to-next.js <file-or-dir>` to apply the same changes to `next/`.

## Writing Style

- No bold or italic text in documentation content
- No em-dashes — use a comma, period, or rewrite the sentence instead

## Rules

- Do not edit archived version directories (`v0.53/`, `v10.1.x/`, etc.)
- Do not run versioning or freeze scripts without explicit instruction
- Do not use emdashes in documentation
- When adding a page to `latest/`, check whether `next/` needs the same addition
- Do not manually add `noindex` or `canonical` front matter to archived pages — `tag-archived.js` handles that
- Use absolute Mintlify paths for internal links, never relative paths or `.mdx` extensions:
  - correct: `/sdk/next/tutorials/example/03-build-a-module`
  - wrong: `./03-build-a-module.mdx`
- Cosmos SDK GitHub links: use `release/v{X}.{Y}.x` branch format (e.g. `release/v0.50.x`). `blob/v0.50` and `blob/main` are wrong for stable-version links.

## docs.json

- All navigation is configured in `docs.json` — every `.mdx` file must be registered to appear in the sidebar
- Navigation uses `navigation.dropdowns`, not `navigation.versions` — Mintlify docs show the latter but this repo uses the former
- Each dropdown has a `versions` array. Version entries use:
  - `tag: "Latest"` and `default: true` on the `latest/` entry
  - `tag: "Unreleased"` on the `next/` entry
  - No tag on archived entries
- When adding, deleting, moving, or renaming any `.mdx` file:
  1. Update the page entry in `docs.json`
  2. Add a redirect for deleted, renamed, or moved pages so existing links don't 404
  3. Fix all internal links pointing to the old path
- Redirects go in the top-level `"redirects"` array. Each entry has a `source` and `destination` as root-relative paths without `.mdx` extensions. Wildcards are supported. No anchors (`#`) or query params (`?`) in redirects. No circular redirects.

```json
"redirects": [
  { "source": "/ibc/next/old-page", "destination": "/ibc/next/new-page" },
  { "source": "/ibc/beta/:slug*", "destination": "/ibc/next/:slug*" }
]
```

## Internal Links

Use absolute Mintlify paths. Never relative paths or `.mdx` extensions.

```text
correct: /sdk/next/tutorials/example/03-build-a-module
wrong:   ./03-build-a-module.mdx
wrong:   03-build-a-module
```

The path is the file's location relative to the `docs/` root, without the `.mdx` extension.

### Anchor Links

Mintlify preserves special characters in anchor IDs. Rules:

- Spaces become `-`
- `&`, `+`, `=`, `@`, `#`, `$`, `%` are kept with surrounding hyphens (e.g. `Gas & Fees` becomes `#gas-&-fees`)
- `/` is kept as-is, no surrounding hyphens (e.g. `x/gov` becomes `#x/gov`)
- `?`, `!`, `(`, `)`, `:`, `` ` ``, `—`, `*`, `.` are dropped (surrounding spaces still become `-`)
- `-` in a heading stays as `-`, spaces around it collapse (e.g. `A - B` becomes `#a-b`)
- All characters lowercased

## snippets/

Reusable components — import with absolute paths (e.g. `/snippets/icons.mdx`), not relative paths.

| File | Purpose |
| ---- | ------- |
| `icons.mdx` | Icon library |
| `footnote.mdx` | Footnote component |
| `eip-compatibility-table.jsx` | EIP compatibility matrix (EVM) |
| `rpc-methods-viewer.jsx` | Interactive RPC method viewer |
| `doc-card.jsx` | Card component |
| `topic-card-component.jsx` | Topic card |
| `cosmos-stack-diagram.jsx` | Cosmos stack diagram |
| `cosmos-stack-learn.jsx` | Cosmos stack learn component |
| `code-highlighter.jsx` | Code highlighting |
| `blockchain-demo.jsx` | Blockchain demo |
| `docs-navigation-drawer.jsx` | Navigation drawer |
| `mobile-menu-drawer.jsx` | Mobile menu |

## Releasing a New Version

When a product is ready to release, complete these steps in order.

### 1. Update the Changelog

Update the changelog in `next/` first, so it carries over when the freeze copies `next/` to `latest/`. If the new version is still listed as `## Unreleased` in the upstream `CHANGELOG.md`, use `--unreleased-as` to label it correctly.

```bash
# If the version is released in CHANGELOG.md
cd scripts/versioning && npm run changelogs -- --product <product> --target next --source <tag> --current-only

# If the version is still listed as Unreleased in CHANGELOG.md
cd scripts/versioning && npm run changelogs -- --product <product> --target next --source <tag> --unreleased-as <version> --current-only
```

### 2. Freeze the Version

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

### 3. Check for Broken Links

```bash
npx mint broken-links
```

Fix any broken links before committing.

## Scripts

Versioning, changelog, and migration scripts live in `scripts/`. See [`scripts/versioning/CLAUDE.md`](scripts/versioning/CLAUDE.md) for full documentation on the versioning scripts.

## Development Commands

```bash
npx mint dev           # local preview with live reload
npx mint broken-links  # check for broken internal links (run before committing)
npm run clean          # remove build artifacts
npm run reset          # clean + reinstall
```

## Example Tutorial Sync

The Cosmos SDK example chain tutorials (`sdk/next/tutorials/example/`, files `00-overview.mdx` through `05-run-and-test.mdx`) are kept in sync with the `cosmos/example` repo via a bidirectional GitHub Actions workflow. When either side merges a change, a PR is opened on the other repo with content transformed between formats.

The transform script lives at `scripts/docs-sync/transform.py` and is tracked in git. When editing these tutorial pages, `title:` is owned by the sync — other front matter (e.g. `description:`) is preserved.
