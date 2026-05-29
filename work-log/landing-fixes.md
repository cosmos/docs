## 2026-05-29

- Added CometBFT to landing page top nav, mobile menu drawer, and docs navigation drawer — it was already in the DocCard grid but missing from all nav menus
- Added `navbar.links` to docs.json with all five products so the nav links appear on every docs page, not just the landing page
- Changed light theme background to white by overriding `--background-light` in style.css
- Added accent color overrides in style.css: `.bg-primary/10` → cyan (#40b3ff), `.text-primary` → white, `.dark:bg-primary-light/10` → cobalt (#4251fa)
