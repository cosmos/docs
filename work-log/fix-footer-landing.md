## 2026-04-20

- Added `style.css` rule to un-hide the Mintlify footer on the custom index page (`body:has(#custom-index-content) #footer { display: flex !important; }`)
- Created `snippets/theme-toggle.jsx` — three-button system/light/dark theme switcher to replace the hidden Mintlify navbar switcher on the index page; delegates to Mintlify's hidden buttons when present, falls back to direct localStorage/DOM manipulation
- Updated `index.mdx` to import and render `<ThemeToggle />` in the custom header
