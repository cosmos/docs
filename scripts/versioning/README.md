# Documentation Versioning System

This directory contains the unified versioning system for Cosmos documentation across multiple products (EVM, SDK, IBC). It automates the process of freezing documentation versions while maintaining product‑specific assets (e.g., EVM EIP compatibility tables).

## Overview

The versioning system provides:

- **Version snapshots** - Frozen versions preserve the state of documentation at release time
- **Google Sheets integration (EVM only)** - EIP compatibility data is snapshotted via Google Sheets tabs
- **Automated workflow** - Single command to freeze current version and prepare for next release
- **Mintlify compatibility** - Works within Mintlify's MDX compiler constraints

## Architecture

### Version Structure

```
docs/
├── evm/
│   ├── next/                  # Working directory (always contains latest docs)
│   │   ├── documentation/    # This is where active development happens
│   │   ├── api-reference/
│   │   └── changelog/
│   ├── v0.4.x/               # Frozen snapshot (copied from next/)
│   │   ├── .version-frozen   # Marker file
│   │   ├── .version-metadata.json
│   │   ├── documentation/    # Snapshot from docs/evm/next/
│   │   ├── api-reference/
│   │   └── changelog/
│   └── v0.5.0/               # Another frozen snapshot
│       └── ...
├── sdk/
│   ├── next/                 # SDK working directory
│   ├── v0.53/               # SDK frozen snapshots
│   ├── v0.50/
│   └── v0.47/
└── ibc/
    └── next/                 # IBC working directory
```

#### The "next" Directory Workflow

The `next` directory is the **working directory** for active documentation development:

1. **Development**: All documentation updates happen in `docs/<product>/next/`
2. **Freezing**: When ready to release, the `next` directory is **copied** to `docs/<product>/<version>/`
3. **Preservation**: The original `next` directory **remains unchanged** and continues to be the working directory
4. **Links Updated**: Only the frozen copy has its internal links updated to point to the versioned path
5. **Continued Work**: After freezing, development continues in `next/` for the upcoming release

**Example workflow:**
```bash
# Before freeze: Working on v0.5.0 in docs/evm/next/
# Run freeze with version v0.5.0
npm run freeze
# After freeze:
#   - docs/evm/v0.5.0/ created (frozen snapshot with updated links)
#   - docs/evm/next/ unchanged (continues as working directory for v0.6.0)
```

### Navigation Structure

Docs now use product-specific dropdowns with per-product versions:

```json
{
  "navigation": {
    "dropdowns": [
      {
        "dropdown": "EVM",
        "versions": [
          { "version": "next", "tabs": [/* docs/evm/next/... */] },
          { "version": "v0.4.x", "tabs": [/* docs/evm/v0.4.x/... */] }
        ]
      },
      {
        "dropdown": "SDK",
        "versions": [
          { "version": "v0.53", "tabs": [/* docs/sdk/v0.53/... */] }
        ]
      }
    ]
  }
}
```

### Versions Registry

The top-level `versions.json` tracks versions per product (subdirectory under `docs/`). Each product configuration includes:

- **versions**: Array of available versions (filesystem is auto-discovered and merged)
- **defaultVersion**: The default version shown to users (usually "next")
- **repository**: GitHub repository path for changelog fetching (e.g., "cosmos/evm")
- **changelogPath**: Path to changelog file in the repository (default: "CHANGELOG.md")
- **nextDev**: (Optional) Advisory label for the next development version

Example:

```json
{
  "products": {
    "evm": {
      "versions": ["next", "v0.4.x"],
      "defaultVersion": "next",
      "nextDev": "v0.5.0",
      "repository": "cosmos/evm",
      "changelogPath": "CHANGELOG.md"
    },
    "sdk": {
      "versions": ["next", "v0.53", "v0.50", "v0.47"],
      "defaultVersion": "next",
      "repository": "cosmos/cosmos-sdk",
      "changelogPath": "CHANGELOG.md"
    },
    "ibc": {
      "versions": ["next"],
      "defaultVersion": "next",
      "repository": "cosmos/ibc-go",
      "changelogPath": "CHANGELOG.md"
    }
  }
}
```

#### Auto-Discovery

The system automatically discovers products and versions at runtime:

1. **Product Discovery**: Scans `./docs/` directory for subdirectories (evm, sdk, ibc, etc.)
2. **Version Discovery**: Scans each product directory for version folders (next, v0.4.x, v0.53, etc.)
3. **Intelligent Merging**: Merges discovered versions with configured versions in `versions.json`
4. **Default Configuration**: Creates sensible defaults for new products not yet in `versions.json`

This means:
- New products under `./docs/` are automatically recognized
- Manually created version directories are automatically tracked
- The `versions.json` file is the source of truth for repository configuration
- Version arrays are kept in sync with the filesystem

## Quick Start

### Prerequisites

1. **Google Sheets API Access**
   - Service account key saved as `service-account-key.json`
   - See [GSHEET-SETUP.md](https://github.com/cosmos/docs/blob/main/scripts/versioning/GSHEET-SETUP.md) for detailed setup

2. **Install Dependencies**

   ```bash
   cd scripts/versioning
   npm install
   ```

### Freeze a Version

Run the version manager to freeze the current version in a chosen docs subdirectory (e.g., `evm`, `sdk`, `ibc`) and start a new one. The flow is fully interactive by default:

```bash
cd scripts/versioning
npm run freeze
```

The script will:

1. Prompt for the product (based on folders under `docs/`)
2. Show the product’s entry from `versions.json` (versions, defaultVersion, nextDev)
3. Prompt for the freeze version (e.g., `v0.5.0`, `v0.5.x`)
4. Prompt for the new development version
5. Check/update release notes for that product; if missing, auto‑fetch from GitHub
6. Create a frozen copy at `docs/<subdir>/<version>/`
7. Snapshot EIP data to a Google Sheets tab and generate versioned EIP reference (EVM only)
8. Update navigation (clone `next` entry to `<version>`) and versions registry (per‑product)
9. Create metadata files

Non‑interactive:

```bash
NON_INTERACTIVE=1 \
  SUBDIR=evm \
  CURRENT_VERSION=v0.5.0 \
  NEW_VERSION=v0.6.0 \
  npm run freeze
```

## Scripts Reference

### Core Scripts (ESM)

#### `version-manager.js`

Main orchestration script for complete version freezing workflow.

**Usage:**

```bash
npm run freeze
```

**What it does:**

- Creates frozen copy of `docs/<subdir>/next/` at `docs/<subdir>/<version>/`
- Calls sheets-manager for Google Sheets operations (EVM only)
- Updates all internal links in frozen version
- Updates navigation structure and version registry
- Creates version metadata files

#### `sheets-manager.js`

Google Sheets operations for EIP data versioning.

**Usage:**

```bash
npm run sheets <version>
```

**What it does:**

- Creates version-specific tab in Google Sheets
- Copies data from main sheet to version tab
- Generates EIP reference MDX with sheetTab prop
- Handles authentication and error recovery

#### `release-notes.js`

Standalone changelog and release notes management.

**Usage:**

```bash
npm run release-notes [version|latest] [evm|sdk|ibc]
```

**What it does:**

- Fetches changelog from the product's GitHub repository (auto-detects `CHANGELOG.md`/variants)
- Parses and converts to Mintlify format
- Updates release notes file in `docs/<subdir>/next/`

**Repository Sources:**

Release notes are fetched from GitHub repositories configured in `versions.json`:

- **evm** → `cosmos/evm`
- **sdk** → `cosmos/cosmos-sdk`
- **ibc** → `cosmos/ibc-go`

**Changelog Format Compatibility:**

All three repositories use similar changelog formats with minor variations:

| Repository | Version Format | Example |
|------------|----------------|---------|
| cosmos/evm | `## v0.4.1` | No brackets |
| cosmos/cosmos-sdk | `## [v0.53.0]` | With brackets |
| cosmos/ibc-go | `## [v10.4.0]` | With brackets |

The parser handles both formats automatically through flexible regex matching. Sections like "Features", "Bug Fixes", "Improvements" are recognized regardless of case variations.

### Supporting Scripts

#### `test-versioning.js`

System testing and validation.

**Usage:**

```bash
npm run test
```

#### `restructure-navigation.js`

Navigation structure cleanup utility.

## Google Sheets Integration

EIP compatibility data is versioned through Google Sheets tabs. See [GSHEET-SETUP.md](https://github.com/cosmos/docs/blob/main/scripts/versioning/GSHEET-SETUP.md) for setup and configuration.

### Shared Component

The `/snippets/eip-compatibility-table.jsx` component accepts a `sheetTab` prop:

```jsx
export default function EIPCompatibilityTable({ sheetTab } = {}) {
  const url = sheetTab
    ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${sheetTab}&tqx=out:json`
    : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=eip_compatibility_data&tqx=out:json`;
  // ...
}
```

### Version-Specific Usage

Frozen versions use the component with their tab:

```mdx
<EIPCompatibilityTable sheetTab="v0.4.x" />
```

Active development uses it without props (defaults to main sheet):

```mdx
<EIPCompatibilityTable />
```

## How It Works

### Version Freeze Process

1. **Preparation Phase**
   - Pick product subdirectory (`evm`, `sdk`, `ibc`)
   - Determine current version to freeze from `versions.json` for that product (or prompt)
   - Prompt for new development version
   - Check/update release notes (auto‑fetch when missing)

2. **Freeze Phase**
   - Copy `docs/<subdir>/next/` to version directory (e.g., `docs/evm/v0.4.x/`)
   - (EVM only) Create Google Sheets tab with version name and copy EIP data

3. **Update Phase**
   - (EVM only) Generate MDX with sheet tab reference
   - Update internal links (`/docs/<subdir>/next/` → `/docs/<subdir>/<version>/`)
   - Keep snippet imports unchanged (`/snippets/`)
   - Update navigation structure

4. **Finalization Phase**
   - Create `.version-frozen` marker
   - Create `.version-metadata.json`
   - Register per-product versions in `versions.json`
   - Record next development version label per product

### Path Management

The system handles three types of paths:

1. **Document paths**: Updated to version-specific
   - Before: `/docs/evm/next/documentation/concepts/accounts`
   - After: `/docs/evm/v0.4.x/documentation/concepts/accounts`

2. **Snippet imports**: Remain unchanged (shared)
   - Always: `/snippets/icons.mdx`

3. **External links**: Remain unchanged
   - Always: `https://example.com`

## Mintlify Constraints

The system works within Mintlify's MDX compiler limitations:

### What Works

- Component imports from `/snippets/`
- Props passed to components
- Standard MDX syntax
- HTML comments for metadata

### What Doesn't Work

- Inline component definitions
- Dynamic imports
- JSON imports in MDX
- JavaScript expressions in MDX body
- Runtime code execution

See [Mintlify Constraints](../../CLAUDE.md) for details.

## Setup Guide

### 1. Google Sheets API Setup

Follow [GSHEET-SETUP.md](https://github.com/cosmos/docs/blob/main/scripts/versioning/GSHEET-SETUP.md) to:

1. Create a Google Cloud project
2. Enable Sheets API
3. Create service account
4. Download credentials
5. Share spreadsheet with service account

### 2. Install Dependencies

```bash
cd scripts/versioning
npm install
```

### 3. Configure Credentials

Save your service account key as:

```sh
scripts/versioning/service-account-key.json
```

### 4. Test Connection

```bash
node -e "
const { google } = require('./node_modules/googleapis');
const fs = require('fs');
const credentials = JSON.parse(fs.readFileSync('service-account-key.json'));
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
console.log('✓ Google Sheets API configured');
"
```

## Usage Examples

### Freeze Current Version

```bash
# Start the version freeze process
cd scripts/versioning && npm run freeze

# Enter prompts
Enter the docs subdirectory to version [evm, sdk, ibc]: evm
Enter the new development version (e.g., v0.5.0): v0.5.0
```

### Update Release Notes Only

```bash
# Fetch latest release notes into docs/evm/next
node scripts/versioning/release-notes.js latest evm

# Or fetch specific release into docs/evm/next
node scripts/versioning/release-notes.js v0.4.1 evm
```

### Manual Navigation Update

```bash
# If needed, manually update navigation for a version
npm run freeze  # Full workflow includes navigation updates
```

## Important Notes

### Version Management

- Development happens in `docs/<subdir>/next/` directory
- Frozen versions include `.version-frozen` marker
- Previous versions can be updated if needed

### Version Naming

- Use semantic versioning: `v0.4.0`, `v0.5.0`
- Special case: `v0.4.x` for minor version branches
- Active development is always `next` in navigation

### Google Sheets Management

- Don't delete version tabs from spreadsheet
- Main sheet (`eip_compatibility_data`) is always live
- Version tabs are permanent snapshots

### Git Workflow

```bash
# After version freeze
git add -A
git commit -m "docs: freeze v0.4.x and begin v0.5.0 development"
git push
```

## Maintenance

### Cleaning Up Test Versions

If you need to remove a test version:

```bash
# Remove frozen directory
rm -rf docs/<subdir>/v0.5.0/

# Update per-product entries in versions.json or re-run version manager

# Remove navigation entry (manual edit of docs.json)
# Remove Google Sheets tab (manual via Google Sheets UI)
```

## File Structure

```
scripts/versioning/
├── README.md                     # This file
├── GSHEET-SETUP.md              # Google Sheets API setup guide
├── version-manager.js           # Main orchestration (ESM)
├── sheets-manager.js            # Google Sheets operations (ESM)
├── release-notes.js             # Changelog management (ESM)
├── test-versioning.js           # System testing (ESM)
├── restructure-navigation.js    # Navigation cleanup utility
├── package.json                 # Node dependencies with ESM support
├── package-lock.json           # Dependency lock file
└── service-account-key.json    # Google service account (git-ignored)
```

## Related Documentation

- [Main README](../../README.md) - Project overview
- [CLAUDE.md](../../CLAUDE.md) - AI assistant context
- [GSHEET-SETUP.md](https://github.com/cosmos/docs/blob/main/scripts/versioning/GSHEET-SETUP.md) - Google Sheets API setup
- [Mintlify Documentation](https://mintlify.com/docs) - MDX reference
