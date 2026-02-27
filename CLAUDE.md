# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the unified documentation repository for the Cosmos ecosystem, built with Mintlify. It covers multiple products: **evm, sdk, hub, cometbft, ibc, skip-go**. The repo contains comprehensive documentation including API references, integration guides, smart contract/precompile specifications, and SDK module READMEs.

## Common Development Commands

### Local Development
```bash
# Start live-reload preview server
npx mint dev

# Check for broken internal links (run before committing)
npx mint broken-links

# Validate OpenAPI specifications
npx mint openapi-check docs/api-reference/ethereum-json-rpc/openapi.yaml

# Clean build artifacts
npm run clean

# Full reset (clean + reinstall)
npm run reset
```

### Documentation Generation Scripts
```bash
# Generate interactive RPC documentation pages
node scripts/generate-evm-rpc-docs.js

# Generate OpenAPI specification from methods documentation
node scripts/generate-evm-rpc-openapi.js

# Manage changelogs (unified script for all products)
cd scripts/versioning && npm run changelogs -- --product evm --target next
cd scripts/versioning && npm run changelogs -- --product evm --target v0.5.0
cd scripts/versioning && npm run changelogs -- --product evm --all

# Version management (freeze versions, update navigation, etc.)
cd scripts/versioning && npm run freeze
```

### Testing Precompiles
```bash
# Run all precompile tests
./tests/run-tests.sh

# Test individual precompiles
cd tests && npm test
```

## Architecture & Structure

### Documentation Organization
The documentation follows a hierarchical structure configured in `docs.json`. The repo is a multi-product docs site; each product has its own top-level directory with versioned subdirectories.

#### Top-level product directories

- **`ibc/`** — IBC (Inter-Blockchain Communication) docs. Versions: `next/` (active), `v10.1.x`, `v8.5.x`, `v7.8.x`, `v6.3.x`, `v5.4.x`, `v4.6.x`, `v0.2.0`
- **`evm/`** — Cosmos EVM docs. Versions: `next/`, `v0.5.0`, `v0.4.x`
- **`sdk/`** — Cosmos SDK docs. Versions: `next/`, `v0.53`, `v0.50`, `v0.47`
- **`hub/`** — Cosmos Hub docs. Versions: `v25/`
- **`cometbft/`** — CometBFT docs. Versions: `v0.38/`, `v0.37/`
- **`skip-go/`** — Skip Go docs (unversioned, flat structure)
- **`enterprise/`** — Enterprise docs

### Key Technical Components

1. **Mintlify Framework**: Documentation uses Mintlify v4.2.7 with custom MDX components and interactive features. Configuration in `docs.json` controls navigation, theming, and search.

2. **Script Automation**: Scripts in `/scripts` and `/scripts/versioning` handle:
   - Unified changelog management for all products (evm, sdk, ibc, hub) with version-specific filtering
   - Version freezing and Google Sheets integration for EIP data snapshots
   - Creating interactive RPC documentation from methods.mdx
   - Generating OpenAPI specifications for API testing

3. **Precompile Testing**: Comprehensive test suite in `/tests` validates all precompile contracts against documentation, tracking implementation completeness and gas costs.

4. **Component Library**: Custom JSX components in `/snippets` provide:
   - EIP compatibility tables
   - RPC method viewers
   - Icon libraries
   - Reusable UI elements

### Documentation Workflow

When updating documentation:
1. Edit MDX files in appropriate section under `docs/`
2. Run `npx mint dev` to preview changes locally
3. Validate with `npx mint broken-links` before committing
4. For RPC changes: regenerate docs with `node scripts/generate-evm-rpc-docs.js`
5. For release notes: use `cd scripts/versioning && npm run changelogs -- --product <product> --target <version>` to update changelogs
6. For version freezing: use `cd scripts/versioning && npm run freeze` to create versioned snapshots

### Integration Points

- **GitHub Actions**: Automated changelog sync workflow triggers `manage-changelogs.js` on new releases
- **Multi-Product Changelogs**: Release notes pulled from configured repositories (cosmos/evm, cosmos/cosmos-sdk, cosmos/ibc-go, cosmos/gaia)
- **Version-Specific Filtering**: Automatically filters changelog versions based on target directory (e.g., v0.5.0 directory only shows v0.5.x releases)
- **Google Sheets Integration**: EIP compatibility data versioned through Google Sheets tabs (EVM only)
- **Precompile Addresses**: Fixed addresses documented in tests/README.md
- **Network Endpoints**: Configure in tests/config.js for testing

## Internal Link Format

All internal links in MDX files must use absolute root-relative paths **without** the `.mdx` extension:

```text
✅ /sdk/next/changelog/release-notes
❌ ./release-notes.mdx
❌ ../changelog/release-notes.mdx
```

Mintlify resolves links by URL path, not filesystem path. Relative or extension-suffixed links will break in production.

## File Operations Checklist

When **adding**, **deleting**, **moving**, or **renaming** any `.mdx` file:

1. **Update `docs.json`** — Add, remove, or update the page entry in the navigation structure. Every page must be registered to appear in the sidebar.
2. **Add redirects** — For deleted, renamed, or moved pages, add a redirect in `docs.json` so existing links and search results don't 404.
3. **Fix backlinks** — Search for all internal links pointing to the old path and update them to the new path.

```bash
# Find broken internal links
npx mint broken-links
```

### Redirects in `docs.json`

Redirects are defined as a top-level `"redirects"` array in `docs.json`. Each entry has a `source` and `destination`, both as root-relative paths without `.mdx` extensions:

```json
"redirects": [
  {
    "source": "/ibc/next/old-page-name",
    "destination": "/ibc/next/new-page-name"
  }
]
```

Wildcards are supported:

```json
{ "source": "/ibc/beta/:slug*", "destination": "/ibc/next/:slug*" }
```

**Constraints:** Redirects cannot include URL anchors (`#anchor`) or query parameters (`?key=value`). Avoid circular redirects.

### Versioning in `docs.json` and `versions.json`

**`docs.json`** controls the version *dropdown UI* shown in the sidebar. Each product is a `dropdown` entry inside `navigation`, with a `versions` array. Each version entry contains its own `tabs`, `groups`, and `pages`:

```json
{
  "dropdown": "IBC",
  "versions": [
    {
      "version": "next",
      "tabs": [ ... ]
    },
    {
      "version": "v10.1.x",
      "tabs": [ ... ]
    }
  ]
}
```

**`versions.json`** is a *custom script config* (not a Mintlify-native file). It is used by the scripts in `scripts/versioning/` to manage changelog syncing, version freezing, and related automation. It defines each product's available versions, default version, upstream GitHub repository, and changelog path. It does not affect the live docs UI directly — changes here only affect what the scripts do.

## Session State

`WORKING.md` in the repo root tracks active work, recent changes, and known issues for the current session. It is gitignored and mintignored. Check it at the start of any session to understand what was last being worked on.

## Important Notes

- All documentation files use MDX format with Mintlify-specific components
- Interactive RPC documentation is generated from the source `methods.mdx` file
- Test findings in `tests/README.md` track documentation accuracy against implementation
- Use relative imports for snippets and components (e.g., `/snippets/icons.mdx`)
- Versioned content lives under per-product subdirectories: `sdk/v0.47/`, `sdk/v0.50/`, `sdk/v0.53/`, `cometbft/v0.37/`, `cometbft/v0.38/`, etc. — changes to links may need to be applied across multiple version dirs

**Cosmos SDK branch naming**: Use `release/v{X}.{Y}.x` format (e.g., `release/v0.50.x`) for versioned links. `blob/v0.50` and `blob/main` are both wrong for stable-version docs.
- Use relative imports for snippets and components (e.g., `/snippets/icons.mdx`) but not for markdown links. 
