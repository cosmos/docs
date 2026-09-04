## 2026-08-25

Landing page broke after a Mintlify release shifted its markup and CSS build (reported in Slack, tracked as MAR-1965).

- `style.css`: moved the footer override into `@layer utilities`. Mintlify now hides the footer on custom pages with a layered Tailwind v4 utility (`peer-[.is-custom]:hidden!`). For `!important` declarations the cascade-layer order inverts, so our unlayered `!important` lost regardless of specificity.
- `style.css`: moved the Fira Code `@import` to the top of the file. CSS ignores `@import` that follows other rules, so the code-block font was never loading.
- `snippets/theme-toggle.jsx`: Mintlify replaced the `mode-switch-light` / `mode-switch-dark` buttons with a menu (`theme-preference-menu-trigger` plus `theme-preference-{system,light,dark}` items that only mount once the menu opens), and moved the stored preference from `isDarkMode` to `theme`. The toggle now opens the menu and clicks the matching item, falls back to the old buttons, and only as a last resort drives the theme class itself, writing both storage keys. Active state is read from the `light` / `dark` class on `<html>` instead of Mintlify's button styling.
- `index.mdx`: hero background art was a fixed `h-[1000px]` block with the content pulled back over it via `-mt-[1000px]`. Content had grown to 1236px, so the art and its bottom gradient ended partway through the cards. The art is now absolutely positioned inside the hero wrapper, so it sizes to the content.

Verified locally with `npx mint dev`: footer renders (662px, below the content at the page bottom), hero art and gradient span the full 1236px hero, both toggle buttons flip the theme and the active state follows, no console errors. Section offsets below the hero are unchanged from production.
