## 2026-04-01

- First-time freeze for sdk, ibc, cometbft, hub: promoted each product's `next/` → `latest/`, rewrote internal links, stripped noindex from promoted files, injected noindex/canonical into `next/` pages
- Updated `docs.json` nav for all four products: added `latest` version entry (cloned from `next`, paths rewritten) with `tag: "Latest"` and `default: true`; set `next` to `tag: "Unreleased"`; ordered latest → next → stable archived newest-first. Hub uses `version: "Latest"` (no version number) instead of a semver label since hub versioning uses single-component versions (`v25`) that fail the script's format validation.
- Updated `versions.json` for all four products: added `latest` to versions list, set `defaultVersion: latest`, set `latestDisplayVersion` (sdk: v0.54, ibc: v11.0.x, cometbft: v0.39, hub: Latest)
- Ran `tag-archived.js --all-products --all`: injected noindex/canonical into all pre-existing archived version directories (1,394 files across sdk/v0.47–v0.53, ibc/v0.2.0–v10.1.x, cometbft/v0.37–v0.38, evm/v0.4.x–v0.5.0, hub/v25)
- Added `CLAUDE.md` to `scripts/versioning/` documenting all scripts accurately
- Rewrote `docs/CLAUDE.md`: accurate product/version directory overview, writing style rules (no bold, no em-dashes), docs.json versioning details, anchor link rules, redirect examples, snippets table, releases runbook, removed stale references to nonexistent scripts and tests
- Cleaned up `scripts/`: removed untracked one-off migration scripts (convert-to-relative-links.js, fix-sdk-paths.py, etc.) and `link-validation/`; fixed `.gitignore` to remove blanket `scripts/*` deny pattern in favor of targeted ignores. Removed redundant `scripts/node_modules/` gitignore entry (covered by top-level rule).
- Fixed `versions.json`: corrected sdk versions order (latest before next), fixed hub repository from `cosmos/hub` to `cosmos/gaia`, added missing `v25` to hub versions
- Added `--unreleased-as <version>` flag to `manage-changelogs.js` to treat the `## Unreleased` section as a named version entry
- Added `--current-only` flag to `manage-changelogs.js` to output only the most recent version entry
- Updated `generateMintlifyContent` in `manage-changelogs.js`: simplified Info block to show current version and full changelog link, removed redundant footer
- Generated sdk/next and sdk/latest changelogs for v0.54.0 from upstream tag `v0.54.0-rc.3`
- Generated ibc/next and ibc/latest changelogs for v11.0.0 from `cosmos/ibc-go` main (Unreleased section, no RC tag exists yet)
- Generated cometbft/next and cometbft/latest changelogs for v0.39.0 from `cometbft/cometbft` main (Unreleased section, no RC tag exists yet)
