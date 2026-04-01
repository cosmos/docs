## 2026-04-01

- First-time freeze for sdk, ibc, cometbft, hub: promoted each product's `next/` → `latest/`, rewrote internal links, stripped noindex from promoted files, injected noindex/canonical into `next/` pages
- Updated `docs.json` nav for all four products: added `latest` version entry (cloned from `next`, paths rewritten) with `tag: "Latest"` and `default: true`; set `next` to `tag: "Unreleased"`; ordered latest → next → stable archived newest-first. Hub uses `version: "Latest"` (no version number) instead of a semver label since hub versioning uses single-component versions (`v25`) that fail the script's format validation.
- Updated `versions.json` for all four products: added `latest` to versions list, set `defaultVersion: latest`, set `latestDisplayVersion` (sdk: v0.54, ibc: v11.0.x, cometbft: v0.39, hub: Latest)
- Ran `tag-archived.js --all-products --all`: injected noindex/canonical into all pre-existing archived version directories (1,394 files across sdk/v0.47–v0.53, ibc/v0.2.0–v10.1.x, cometbft/v0.37–v0.38, evm/v0.4.x–v0.5.0, hub/v25)
- Added `CLAUDE.md` to `scripts/versioning/` documenting all scripts accurately
