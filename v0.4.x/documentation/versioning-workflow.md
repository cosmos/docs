# Documentation Versioning Workflow

## Overview

The cosmos/docs repository uses a versioning system to maintain documentation snapshots for different releases while continuing development on the main branch. This document describes the complete workflow and automation.

## Directory Structure

```ascii
cosmos/docs/
├── docs/                     # Current development documentation (e.g., v0.5.0)
├── v0.4.x/                  # Frozen snapshot for v0.4.x release series
├── v0.3.x/                  # Frozen snapshot for v0.3.x release series
├── scripts/                 # Automation scripts
│   ├── version-manager.sh
│   ├── check-and-freeze-release.sh
│   ├── parse-evm-changelog.js
│   ├── snapshot-eip-data.js
│   └── update-navigation.js
├── versions.json            # Version registry
└── docs.json               # Navigation configuration
```

## Key Concepts

### 1. Version Types

- **Development Version**: Lives in `docs/` directory, actively edited
- **Frozen Versions**: Immutable snapshots in version-named directories (e.g., `v0.4.x/`)
- **Main Branch Only**: All versions exist as directories on the main branch (no version branches)

### 2. Version Naming Convention

- Release versions: `v0.4.x`, `v0.5.x` (using `.x` for minor version series)
- Development version: Specified in `versions.json`
- Special version: `main` represents current development

## Core Scripts

### 1. version-manager.sh

**Purpose**: Primary script for freezing documentation versions

**Process**:

1. Prompts for version to freeze and new development version
2. Updates release notes from cosmos/evm changelog
3. Copies `docs/` to versioned directory
4. Snapshots dynamic data (EIP compatibility)
5. Converts dynamic components to static
6. Updates navigation and version registry

**Usage**:

```bash
./scripts/version-manager.sh
# Interactive prompts:
# - Version to freeze: v0.4.x
# - New dev version: v0.5.0
# - Confirmations: y
```

### 2. check-and-freeze-release.sh

**Purpose**: Automated version freezing triggered by cosmos/evm releases

**Features**:

- Monitors cosmos/evm for new releases
- Automatically triggers freeze for major/minor releases
- Creates branch and pull request
- Fully automated workflow

**Process**:

1. Checks latest cosmos/evm release via GitHub API
2. Compares with frozen versions
3. If new major/minor release found:
   - Fetches changelog from release tag
   - Generates release notes
   - Freezes documentation
   - Creates PR

**Usage**:

```bash
./scripts/check-and-freeze-release.sh
# Can be run in CI/CD or manually
```

### 3. Supporting Scripts

#### parse-evm-changelog.js

- Converts cosmos/evm CHANGELOG.md to Mintlify format
- Generates release notes pages
- Extracts version-specific changes

#### snapshot-eip-data.js

- Fetches EIP compatibility data from Google Sheets
- Creates JSON snapshot for frozen versions
- Ensures data persistence

#### update-navigation.js

- Updates docs.json navigation structure
- Adds versioned navigation entries
- Maintains version dropdown

## Workflow Steps

### Manual Version Freeze

1. **Preparation**

   ```bash
   cd /Users/cordt/repos/docs
   git checkout main
   git pull origin main
   ```

2. **Create Branch**

   ```bash
   git checkout -b docs/freeze-v0.4.x
   ```

3. **Run Version Manager**

   ```bash
   ./scripts/version-manager.sh
   # Enter: v0.4.x (version to freeze)
   # Enter: v0.5.0 (new dev version)
   # Confirm: y
   ```

4. **Commit and Push**

   ```bash
   git add -A
   git commit -m "docs: freeze v0.4.x and begin v0.5.0 development"
   git push -u origin docs/freeze-v0.4.x
   ```

5. **Create PR**
   - PR is created automatically when branch is pushed
   - Or manually via GitHub UI/CLI

### Automated Release-Driven Freeze

1. **Setup** (one-time)

   ```bash
   # Add to CI/CD or run periodically
   ./scripts/check-and-freeze-release.sh
   ```

2. **Automatic Process**
   - Script detects new cosmos/evm release
   - Downloads changelog from release tag
   - Freezes matching documentation version
   - Creates branch and PR automatically

## Component Conversion

### Dynamic to Static Components

When freezing a version, dynamic components are converted to static:

#### EIP Compatibility Table

**Development** (Dynamic):

```jsx
import EIPCompatibilityTable from '/snippets/eip-compatibility-table.jsx'
<EIPCompatibilityTable />
// Fetches live data from Google Sheets
```

**Frozen** (Static):

```jsx
import EIPCompatibilityTableStatic from '/snippets/eip-compatibility-table-static.jsx'
<EIPCompatibilityTableStatic snapshotPath="/v0.4.x/eip-data-snapshot.json" />
// Reads from JSON snapshot
```

## File Modifications During Freeze

### 1. versions.json

```json
{
  "versions": [
    "main",
    "v0.5.0"  // New development version
  ],
  "defaultVersion": "v0.5.0"
}
```

### 2. docs.json

- Adds new version section with complete navigation
- Updates path prefixes for frozen version
- Maintains version dropdown order

### 3. Internal Links

- All `/docs/` links in frozen version updated to `/v0.4.x/`
- Ensures frozen version is self-contained

### 4. Metadata Files

- `.version-frozen`: Marker file with freeze date
- `.version-metadata.json`: Detailed version information

## Important Considerations

### 1. Immutability

- Frozen versions should not be edited
- Changes only in `docs/` directory
- Historical accuracy preserved

### 2. Branch Strategy

- All versions live on main branch
- Feature branches for changes
- Version freeze branches for PR review

### 3. Release Coordination

- Align documentation freezes with cosmos/evm releases
- Use release notes from actual releases
- Maintain version number consistency

### 4. Data Persistence

- Dynamic data sources snapshotted at freeze time
- External dependencies captured
- Self-contained frozen versions

## Troubleshooting

### Common Issues

1. **Script Permissions**

   ```bash
   chmod +x scripts/*.sh
   ```

2. **Missing versions.json**

   ```bash
   echo '{"versions": ["main"]}' > versions.json
   ```

3. **EIP Snapshot Fails**
   - Check Google Sheets API access
   - Verify network connectivity
   - Manual snapshot: `node scripts/snapshot-eip-data.js v0.4.x`

4. **Navigation Not Updated**
   - Run: `node scripts/update-navigation.js v0.4.x`
   - Manually check docs.json structure

## Best Practices

1. **Before Freezing**
   - Ensure all documentation is up-to-date
   - Review and merge pending PRs
   - Test all code examples

2. **Version Naming**
   - Use `.x` suffix for minor version series
   - Match cosmos/evm version numbers
   - Clear progression (v0.4.x → v0.5.0)

3. **PR Process**
   - Always create PR for version freezes
   - Review frozen content before merging
   - Tag PR with "documentation" and "release"

4. **Post-Freeze**
   - Announce version freeze in Discord/Slack
   - Update any external documentation links
   - Continue development in `docs/`

## Automation Opportunities

### GitHub Actions Workflow

```yaml
name: Check for New Releases
on:
  schedule:
    - cron: '0 0 * * *'  # Daily
  workflow_dispatch:

jobs:
  check-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: ./scripts/check-and-freeze-release.sh
```

### Pre-commit Hooks

```bash
# Prevent edits to frozen versions
if git diff --cached --name-only | grep -q '^v[0-9]'; then
  echo "Error: Cannot edit frozen version directories"
  exit 1
fi
```

## Version Lifecycle

1. **Development** → Active work in `docs/`
2. **Pre-release** → Final reviews and updates
3. **Freeze** → Create immutable snapshot
4. **Archived** → Frozen version maintained indefinitely
5. **Next Cycle** → New development version begins

## Summary

The versioning workflow ensures:

- Documentation matches specific cosmos/evm releases
- Historical versions remain accessible
- Development continues uninterrupted
- Automated processes reduce manual work
- Clear separation between versions

This system provides users with accurate documentation for their specific version while allowing continuous improvement of current documentation.
