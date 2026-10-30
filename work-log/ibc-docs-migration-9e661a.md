## 2026-10-30

- Removed the IBC docs (991 files, every version plus images); they now live at ibcprotocol.dev, built from cosmos/ibc
- Added `/ibc/*` redirects to the new site: `/ibc/latest/spec/*` to `/docs/ibc/spec/*`, the rest of `/ibc/latest/*` to `/docs/ibc-go/latest/*`, everything else to the docs home. 163 of 165 latest pages map page for page; only the two template stubs fall through
- Repointed 83 IBC links across 49 files in evm, sdk, hub, index.mdx and both navigation drawers at ibcprotocol.dev, including the ones in archived version directories, which pointed into a deleted tree
- Dropped the IBC Protocol dropdown from docs.json and `products.ibc` from versions.json; the navbar and footer IBC entries now link to the new site
- Removed IBC from the product tables in CLAUDE.md and README.md so it is not treated as a local product
- Left `ibc/README.md` pointing at the archived tree at d6038e7d
