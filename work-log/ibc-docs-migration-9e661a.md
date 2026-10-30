## 2026-10-30

- Removed the IBC docs (991 files, every version plus images); they now live at ibcprotocol.dev, built from cosmos/ibc
- Added 22 `/ibc/*` redirect rules. `/ibc/{latest,next}/spec/*` goes to `/docs/ibc/spec/*`, the rest of `/ibc/{latest,next}/*` to `/docs/ibc-go/latest/*`, archived versions to the docs home. 163 of 165 latest pages and 164 of 186 next pages map page for page
- Mapped the 22 next pages that moved on the new site rather than letting them fall to the docs home. All 29 indexed `/ibc/next/*` URLs in the production sitemap now land on a real page, which is where the remaining search equity was
- Repointed 83 IBC links across 44 content files in evm, sdk, hub, index.mdx and both navigation drawers at ibcprotocol.dev, including the ones in archived version directories, which pointed into a deleted tree
- Dropped the IBC Protocol dropdown from docs.json and `products.ibc` from versions.json; the navbar and footer IBC entries now link to the new site
- Removed IBC from the product tables in CLAUDE.md and README.md, and from the versioning and sync scripts, so it is not treated as a local product
- Left `ibc/README.md` pointing at the archived tree at d6038e7d
