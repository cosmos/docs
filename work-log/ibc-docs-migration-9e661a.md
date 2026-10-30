## 2026-10-30

- Removed the IBC docs (991 files, every version plus images); they now live at ibcprotocol.dev, built from cosmos/ibc
- Added `/ibc/*` redirects to the new site: `/ibc/latest/spec/*` to `/docs/ibc/spec/*`, the rest of `/ibc/latest/*` to `/docs/ibc-go/latest/*`, everything else to the docs home. 163 of 165 latest pages map page for page; only the two template stubs fall through
- Repointed 39 IBC links in evm, sdk, hub, index.mdx and snippets at ibcprotocol.dev; left the 17 in archived directories to resolve through the redirects
- Dropped the IBC Protocol dropdown from docs.json and `products.ibc` from versions.json; the navbar and footer IBC entries now link to the new site
- Left `ibc/README.md` pointing at the archived tree at d6038e7d
