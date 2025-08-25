# Documentation Versioning System

This directory contains the unified versioning system for Cosmos EVM documentation. The system enables freezing documentation versions while maintaining immutable snapshots of dynamic data like EIP compatibility tables.

## Overview

The versioning system provides:

- **Immutable version snapshots** - Frozen versions preserve the exact state of documentation at release time
- **Dynamic data preservation** - EIP compatibility data is snapshotted via Google Sheets tabs
- **Automated workflow** - Single command to freeze current version and prepare for next release
- **Mintlify compatibility** - Works within Mintlify's MDX compiler constraints

## Architecture

### Version Structure

```sh
docs/                    # Active development (main)
├── documentation/       # Current docs being edited
├── api-reference/
└── changelog/

v0.4.x/                 # Frozen version (immutable)
├── .version-frozen     # Marker file with freeze date
├── .version-metadata.json # Version metadata
├── documentation/      # Snapshot of docs at v0.4.x
├── api-reference/
└── changelog/

v0.5.0/                 # Another frozen version
└── ...
```

### Navigation Structure

```json
{
  "navigation": {
    "versions": [
      {
        "version": "v0.4.x",  // Frozen version
        "tabs": [...],        // Points to v0.4.x/ paths
      },
      {
        "version": "main",    // Active development
        "tabs": [...],        // Points to docs/ paths
      }
    ]
  }
}
```

## Quick Start

### Prerequisites

1. **Google Sheets API Access**
   - Service account key saved as `service-account-key.json`
   - See `GOOGLE_API_SETUP_GUIDE.md` for full details

2. **Install Dependencies**

   ```bash
   cd scripts/versioning
   npm install
   ```

### Freeze a Version

Run the version manager to freeze the current version and start a new one:

```bash
./scripts/versioning/version-manager.sh
```

The script will:

1. Prompt for the new development version (e.g., v0.5.0)
2. Check/update release notes from cosmos/evm
3. Create a frozen copy at the current version path
4. Snapshot EIP data to a Google Sheets tab
5. Update navigation and version registry
6. Set up the new development version

## Scripts Reference

### Core Scripts

#### `version-manager.sh`

Main orchestration script that handles the complete versioning workflow.

**What it does:**

- Creates frozen copy of `docs/` at version path
- Calls Google Sheets API to create version-specific tab
- Generates MDX with sheet tab reference
- Updates all internal links in frozen version
- Updates navigation structure
- Creates version metadata files
- Registers new development version

**Usage:**

```bash
./scripts/versioning/version-manager.sh
```

#### `snapshot-eip-sheet.js`

Creates a version-specific tab in the Google Sheets document.

**What it does:**

- Connects to Google Sheets API using service account
- Copies data from main sheet to new version tab
- Preserves formatting and structure
- Returns sheet ID for reference

**Usage:**

```bash
node scripts/versioning/snapshot-eip-sheet.js <version>
```

#### `generate-eip-mdx-simple.js`

Generates the EIP reference MDX file with sheet tab prop.

**What it does:**

- Creates MDX that imports shared component
- Passes version-specific sheet tab as prop
- Adds metadata comments and documentation

**Output format:**

```mdx
import EIPCompatibilityTable from '/snippets/eip-compatibility-table.jsx'

<EIPCompatibilityTable sheetTab="v0.4.x" />
```

#### `update-navigation.js`

Updates navigation paths for versioned documentation.

**What it does:**

- Creates version-specific navigation entry
- Updates all paths from `docs/` to version path
- Ensures main version always points to `docs/`
- Handles path normalization

**Usage:**

```bash
node scripts/versioning/update-navigation.js <version>
```

#### `update-versions.js`

Manages the versions registry.

**What it does:**

- Adds/removes versions from registry
- Updates default version
- Maintains version ordering

**Usage:**

```bash
node scripts/versioning/update-versions.js add <version>
node scripts/versioning/update-versions.js remove <version>
```

#### `refresh-release-notes.sh`

Fetches and updates release notes from cosmos/evm.

**What it does:**

- Fetches changelog from GitHub
- Parses markdown changelog
- Converts to Mintlify format
- Updates release notes file

**Usage:**

```bash
./scripts/versioning/refresh-release-notes.sh [version|latest]
```

#### `parse-evm-changelog.js`

Parses cosmos/evm changelog to Mintlify format.

**What it does:**

- Converts markdown changelog structure
- Generates Mintlify Update components
- Organizes changes by category
- Preserves links and formatting

### Supporting Scripts

#### `restructure-navigation.js`

Ensures clean navigation structure in docs.json.

#### `snapshot-eip-data.js`

Fallback script for JSON-based EIP data snapshot (deprecated).

#### `generate-simple-eip-mdx.js`

Fallback script for embedded JSON approach (deprecated).

## Google Sheets Integration

### Architecture

The system uses Google Sheets as a versioned data store:

1. **Main Sheet**: `eip_compatibility_data` - Live data for active development
2. **Version Tabs**: `v0.4.x`, `v0.5.0`, etc. - Frozen snapshots per version

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

1. **Preparation**
   - Determine current version from versions.json
   - Prompt for new development version
   - Check/update release notes

2. **Freeze**
   - Copy `docs/` to version directory (e.g., `v0.4.x/`)
   - Create Google Sheets tab with version name
   - Copy EIP data to version tab

3. **Update**
   - Generate MDX with sheet tab reference
   - Update internal links (`/docs/` → `/v0.4.x/`)
   - Keep snippet imports unchanged (`/snippets/`)
   - Update navigation structure

4. **Finalization**
   - Create `.version-frozen` marker
   - Create `.version-metadata.json`
   - Register new development version
   - Update default version

### Path Management

The system handles three types of paths:

1. **Document paths**: Updated to version-specific
   - Before: `/docs/documentation/concepts/accounts`
   - After: `/v0.4.x/documentation/concepts/accounts`

2. **Snippet imports**: Remain unchanged (shared)
   - Always: `/snippets/icons.mdx`

3. **External links**: Remain unchanged
   - Always: `https://example.com`


## Setup Guide

### 1. Google Sheets API Setup

Follow `GOOGLE_API_SETUP_GUIDE.md` to:

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

```
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
./scripts/versioning/version-manager.sh

# Enter new version when prompted
Enter the new development version (e.g., v0.5.0): v0.5.0

# Confirm actions
Proceed with version management? (y/n): y
```

### Update Release Notes Only

```bash
# Fetch latest release notes
./scripts/versioning/refresh-release-notes.sh latest

# Or fetch specific version
./scripts/versioning/refresh-release-notes.sh v0.4.1
```

### Manual Navigation Update

```bash
# If needed, manually update navigation for a version
node scripts/versioning/update-navigation.js v0.4.x
```

## Important Notes

### Immutability

- **Avoid editing frozen versions**
- New development lives in `docs/` directory
- Frozen versions include `.version-frozen` marker

### Version Naming

- Use semantic versioning: `v0.4.0`, `v0.5.0`
- Special case: `v0.4.x` for minor version branches
- Main/development is always `next` in navigation

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
rm -rf v0.5.0/

# Update versions.json
node scripts/versioning/update-versions.js remove v0.5.0

# Remove navigation entry (manual edit of docs.json)
# Remove Google Sheets tab (manual via Google Sheets UI)
```

### Updating Scripts

When modifying versioning scripts:

1. Test with a dummy version first
2. Ensure backward compatibility
3. Update this README
4. Test the complete flow

## File Structure

```sh
scripts/versioning/
├── README.md                      # This file
├── GOOGLE_API_SETUP_GUIDE.md    # Google API setup instructions
├── version-manager.sh            # Main orchestration script
├── snapshot-eip-sheet.js         # Google Sheets snapshot creator
├── generate-eip-mdx-simple.js    # MDX generator with props
├── update-navigation.js          # Navigation updater
├── update-versions.js            # Version registry manager
├── refresh-release-notes.sh      # Release notes fetcher
├── parse-evm-changelog.js        # Changelog parser
├── restructure-navigation.js     # Navigation cleanup
├── package.json                  # Node dependencies
├── package-lock.json            # Dependency lock file
└── service-account-key.json     # Google service account (git-ignored)
```
