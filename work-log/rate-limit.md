## 2026-07-09

- Rewrote the rate limit middleware pages (overview, integration, setting-limits) in `ibc/latest` and `ibc/next` with code-verified content, and added a new `migration` page. Content verified against ibc-go `main` plus PR #8984 (v2 wiring) and ibc-apps rate-limiting v10.1.0 (migration before/after).
- Added a "Rate Limit Middleware" group to the IBC Middleware navigation in `docs.json` for both `latest` and `next`; the pages existed as files but were not linked in the sidebar.
