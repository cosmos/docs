# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the documentation repository for Cosmos EVM, built with Mintlify. The repository contains comprehensive documentation for the Cosmos EVM implementation, including API references, integration guides, smart contract documentation, and precompile specifications.

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
The documentation follows a hierarchical structure configured in `docs.json`:

- **docs/documentation/** - Main documentation content
  - `concepts/` - Core concepts (accounts, gas, transactions, IBC)
  - `cosmos-sdk/` - SDK modules and protocol details
  - `smart-contracts/` - Precompiles and predeployed contracts
  - `integration/` - Integration guides and migration docs
  - `getting-started/` - Quick start guides and tooling

- **docs/api-reference/** - API documentation
  - `ethereum-json-rpc/` - RPC methods, OpenAPI spec, and explorer

- **docs/changelog/** - Release notes auto-synced from cosmos/evm

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

## Important Notes

- All documentation files use MDX format with Mintlify-specific components
- Navigation structure must be updated in `docs.json` when adding new pages
- Interactive RPC documentation is generated from the source `methods.mdx` file
- Test findings in `tests/README.md` track documentation accuracy against implementation
- Use relative imports for snippets and components (e.g., `/snippets/icons.mdx`)

## Documentation Style Guide

### Writing Standards

When writing or updating documentation, follow these style guidelines:

- No bold text
- No italics
- No first person pronouns (I, we, us, our)
- Be concise and direct
- Write naturally, as a human would
- No horizontal line breaks (---)
- No emojis
- Use paragraphs where appropriate for readability
- Use unordered lists only where they improve clarity
- Use ordered lists only for sequential steps or ranked items
- Be clear, concise, and coherent

### Mintlify Syntax

The documentation uses Mintlify-specific MDX components. Use these components appropriately:

**Callouts**: Use sparingly and only where they add value. Available types:
```mdx
<Note>General information or tips</Note>
<Info>Informational content</Info>
<Warning>Important warnings or cautions</Warning>
<Tip>Helpful tips or best practices</Tip>
<Check>Success messages or confirmations</Check>
```

**Code Blocks**: Always specify the language for syntax highlighting:
```mdx
```javascript
const example = "code";
```
```

**Tabs**: For showing multiple options or examples:
```mdx
<Tabs>
  <Tab title="JavaScript">
    Content for JavaScript
  </Tab>
  <Tab title="Python">
    Content for Python
  </Tab>
</Tabs>
```

**Accordions**: For collapsible content sections:
```mdx
<Accordion title="Click to expand">
  Hidden content here
</Accordion>
```

**Cards**: For grouped navigation or features:
```mdx
<CardGroup cols={2}>
  <Card title="Title" icon="icon-name" href="/path">
    Description
  </Card>
</CardGroup>
```

Use these components only where appropriate. Do not overuse callouts or formatting that may distract from the technical content.