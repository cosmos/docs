# Google Sheets Setup for Documentation Versioning

## Overview

The versioning system creates version-specific tabs in Google Sheets to preserve EIP compatibility data when documentation versions are frozen.

**Configuration:**

- **Spreadsheet ID**: `1OGscheUSh-g15p7mNYjSaxI05E8O_3R3tDK0IwXaczk`
- **Main Sheet**: `eip_compatibility_data` (live data)
- **Version Tabs**: `v0.4.x`, `v0.5.0`, etc. (frozen snapshots)

## How It Works

**Active Development** (`docs/next/`):

```mdx
<EIPCompatibilityTable />
```

Uses main sheet `eip_compatibility_data` with live data.

**Frozen Versions** (`docs/v0.5.0/`):

```mdx
<EIPCompatibilityTable sheetTab="v0.5.0" />
```

Uses version-specific tab `v0.5.0` with snapshot data.

## Tab Reference Format

** Correct**: Use **sheet tab name** as identifier:

- `sheetTab="v0.4.x"`
- `sheetTab="v0.5.0"`
- `sheetTab="eip_compatibility_data"`

** Incorrect**: GID numbers, indices, or other identifiers do not work.

## API Setup Process

### 1. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: `cosmos-docs-versioning`
3. Select the project

### 2. Enable Sheets API

1. Navigate: APIs & Services → Library
2. Search: "Google Sheets API"
3. Click "Enable"

### 3. Create Service Account

1. Navigate: APIs & Services → Credentials
2. Click "Create Credentials" → "Service Account"
3. Name: `docs-versioning-bot`
4. Click "Create and Continue"
5. Skip role assignment (click "Continue")
6. Click "Done"

### 4. Generate Key

1. Click on the created service account
2. Go to "Keys" tab
3. Click "Add Key" → "Create New Key"
4. Select "JSON" format
5. Click "Create"
6. Save file as `scripts/versioning/service-account-key.json`

### 5. Share Spreadsheet

1. Open the [EIP Compatibility Spreadsheet](https://docs.google.com/spreadsheets/d/1OGscheUSh-g15p7mNYjSaxI05E8O_3R3tDK0IwXaczk)
2. Click "Share"
3. Add the service account email (from the JSON key file)
4. Set permission to "Editor"
5. Click "Send"

### 6. Install Dependencies

```bash
cd scripts/versioning
npm install
```

## Testing

Test the setup:

```bash
# Quick test
npm run test

# Manual test
npm run sheets test-v1
```

## Troubleshooting

**"The caller does not have permission"**

- Verify spreadsheet is shared with service account email
- Check Editor permissions granted

**"Sheet not found"**

- Verify `MAIN_SHEET_NAME` matches actual sheet name
- Check sheet tab exists in spreadsheet

**Authentication fails**

- Verify service account key file exists
- Check JSON key format is valid
- Ensure API is enabled in Google Cloud
