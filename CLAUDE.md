# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the Cosmos Documentation Hub - a unified documentation system for all parts of the Cosmos Stack using Mintlify as the documentation platform. The repository manages documentation for multiple products including SDK, IBC, EVM, and CometBFT.

## Architecture

### Documentation Structure
```
docs/
├── <product>/              # Product subdirectory (evm, sdk, ibc, cometbft)
│   ├── next/              # Active development (latest unreleased)
│   ├── v0.x.x/           # Frozen version snapshots
│   │   ├── .version-frozen        # Marker file
│   │   └── .version-metadata.json # Version metadata
│   └── images/           # Product-specific images
```

### Key Files
- `docs.json`: Mintlify navigation configuration with product dropdowns and versioning
- `versions.json`: Registry of versions per product with defaults and next development targets
- `scripts/`: Versioning automation and migration tools

## Common Development Commands

### Development Server
```bash
npx mint dev         # Start local development server with live reload
```

### Validation & Linting
```bash
npx mint broken-links  # Check for broken internal links
next lint             # Run Next.js linter
```

### Clean & Reset
```bash
yarn clean           # Remove build artifacts and dependencies
yarn reset           # Clean and reinstall dependencies
```

## Versioning System

### Freeze a Version (Interactive)
```bash
cd scripts
npm run freeze       # Interactive prompts for product, version, etc.
```

### Update Release Notes
```bash
cd scripts
# Fetch latest release for a product
npm run release-notes latest sdk
npm run release-notes latest ibc
npm run release-notes latest evm

# Fetch specific version
npm run release-notes v0.53 sdk
npm run release-notes v8 ibc
```

### Non-Interactive Version Freeze
```bash
cd scripts
NON_INTERACTIVE=1 \
  SUBDIR=sdk \
  CURRENT_VERSION=v0.53.0 \
  NEW_VERSION=v0.54.0 \
  npm run freeze
```

## Product Configurations

### SDK (Cosmos SDK)
- **Versions**: next, v0.53, v0.50, v0.47
- **Default**: v0.53
- **GitHub**: cosmos/cosmos-sdk
- **Changelog Location**: CHANGELOG.md

### IBC (IBC-Go)
- **Versions**: next, v10.1.x, v8.5.x, v7.8.x, v6.3.x, v5.4.x, v4.6.x
- **Default**: next
- **GitHub**: cosmos/ibc-go
- **Changelog Location**: CHANGELOG.md

### EVM (Cosmos EVM)
- **Versions**: next, v0.4.x
- **Default**: next
- **Next Dev**: v0.5.0
- **GitHub**: cosmos/evm
- **Special**: Uses Google Sheets for EIP compatibility tables

## Important Patterns

### Link Management
When editing documentation:
- **Internal docs links**: Update to version-specific paths
  - Before: `/docs/sdk/next/learn/intro`
  - After: `/docs/sdk/v0.53/learn/intro`
- **Snippet imports**: Keep unchanged (shared across versions)
  - Always: `/snippets/component.mdx`
- **External links**: Keep unchanged

### Navigation Updates
Navigation structure in `docs.json` uses product dropdowns:
```json
{
  "navigation": {
    "dropdowns": [
      {
        "dropdown": "SDK",
        "versions": [
          { "version": "v0.53", "tabs": [...] },
          { "version": "next", "tabs": [...] }
        ]
      }
    ]
  }
}
```

### Version Metadata
Each frozen version contains:
- `.version-frozen`: Marker file indicating frozen state
- `.version-metadata.json`: Freeze timestamp and version info

## Mintlify Constraints

### Component Usage
- Components must be imported from `/snippets/` directory
- Props can be passed to components (e.g., `<Component prop="value" />`)
- No inline component definitions or dynamic imports in MDX

### MDX Limitations
- No JavaScript expressions in MDX body
- No JSON imports in MDX files
- Standard MDX syntax only
- HTML comments allowed for metadata

## Migration and Formatting Scripts

### Docusaurus to Mintlify Migration
```bash
cd scripts
node migrate-docusaurus.js <source-dir> <target-dir>
```

### Code Block Formatting
```bash
cd scripts
node code-formatter.js <file-path>
```

## Google Sheets Integration (EVM Only)

EVM documentation uses Google Sheets for EIP compatibility tables:
1. Service account credentials required: `scripts/service-account-key.json`
2. Version freeze creates sheet tabs for snapshots
3. Component usage: `<EIPCompatibilityTable sheetTab="v0.4.x" />`

## Git Workflow

### After Version Freeze
```bash
git add -A
git commit -m "docs: freeze <product> <version> and begin <new-version> development"
git push
```

### Documentation Updates
- Active development: Edit files in `docs/<product>/next/`
- Previous versions: Generally frozen, edit only for critical fixes
- Always test locally with `npx mint dev` before committing

## Testing Documentation Changes

### Local Preview
```bash
npx mint dev
# Navigate to http://localhost:3000
# Changes auto-reload
```

### Validate Links
```bash
npx mint broken-links
```

### Check Navigation Structure
Review `docs.json` to ensure:
- All pages are included in navigation
- Version dropdowns are correctly configured
- Groups and tabs are properly nested

## Recent Architecture Changes

Based on git status, the repository is undergoing restructuring:
- SDK documentation reorganization (learn, tutorials, user sections)
- Migration from proposed navigation structures to unified system
- Cleanup of old Docusaurus artifacts
- New content for SDK next version including advanced topics and tutorials