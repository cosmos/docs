# fou-395-restructure-cosmos-enterprise-docs-into-a-subsection

## 2026-06-30

- Demoted Cosmos Enterprise from a standalone top-level product to a subsection. Moved the PoA and Group module docs from `enterprise/components/` to `sdk/latest/enterprise/` and registered them as a new "Cosmos Enterprise" group under the SDK "Modules" nav, right after "Open-source Modules", in both the latest and next versions.
- Added `sdk/latest/enterprise/overview.mdx`: short modules overview sourced from the upstream `enterprise/README.md`, a link to the `enterprise` directory in the Cosmos SDK repo, and accurate licensing (Source Available Evaluation License for non-production use, Enterprise License for production). Replaces the prior subscription and services framing.
- Corrected the licensing sections on the PoA and Group overview pages to the Source Available Evaluation License with per-module LICENSE links, replacing the prior "commercially licensed / Cosmos Enterprise subscription" wording.
- Deleted the `enterprise/` directory, including the professional services page, the security and compliance page, and the interoperability pages (relayer, attestor, deployment). Interop is being redone alongside the new relayer and will be re-added separately.
- Removed Cosmos Enterprise from the top navbar, the footer, and the navigation drawers (`docs-navigation-drawer.jsx`, `mobile-menu-drawer.jsx`). On the landing page, replaced the Enterprise card with a "Get in touch" card, reordered the grid so IBC sits second after the SDK, and set "Start Building" as the highlighted card.
- Added redirects: a specific redirect for each moved PoA and Group page to its new `sdk/latest/enterprise/` path, plus a catch-all `/enterprise/:slug*` to the new overview for the deleted pages. Updated inbound links in the SDK latest and next learn, upgrade, and module pages to the new paths.
- Softened the Cosmos Enterprise sections in the SDK `learn/intro/overview.mdx`, `learn/intro/cosmos-stack.mdx`, and `upgrade/upgrade.mdx` pages (latest and next), replacing the services, infrastructure, and support framing with a factual modules-and-licensing description. Archived versions left unchanged.
