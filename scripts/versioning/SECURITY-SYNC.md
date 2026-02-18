# Security Documentation Sync

Automated system for syncing security documentation from the [`cosmos/security`](https://github.com/cosmos/security) repository into the Cosmos SDK v0.53 documentation.

## Overview

This system maintains three security-related pages in the SDK v0.53 documentation that are automatically synced from the official cosmos/security repository:

- **Security Policy** (`sdk/v0.53/security/security-policy.mdx`) - Release families, maintenance policy, EOL timelines
- **Bug Bounty Program** (`sdk/v0.53/security/bug-bounty.mdx`) - Vulnerability reporting, severity tiers, disclosure timeline
- **Security Audits** (`sdk/v0.53/security/audits.mdx`) - Auto-generated links to all security audits and transparency reports

## Quick Start

### Run Sync Manually

```bash
# From project root
node scripts/versioning/sync-security-docs.js

# Or from scripts/versioning directory
cd scripts/versioning
node sync-security-docs.js
```

### Test Changes Locally

```bash
# Start local preview
npx mint dev

# Navigate to: SDK v0.53 → Build → Reference → Security
```

### Trigger Automated Sync

1. Go to GitHub Actions tab
2. Select "Sync Security Documentation" workflow
3. Click "Run workflow"
4. Review and merge the created PR

## How It Works

### 1. Weekly Automated Sync

- **Schedule**: Every Monday at 9am UTC
- **Workflow**: `.github/workflows/sync-security-docs.yml`
- **Can be triggered manually** via GitHub Actions UI

### 2. Content Fetching

The script fetches content from the public `cosmos/security` repository:

- **Security Policy**: `POLICY.md` (release families, maintenance commitments)
- **Bug Bounty**: `SECURITY.md` (reporting process, severity classifications)
- **Audits**: Recursively scans `/audits` directory for all PDFs and markdown files
- **Reports**: Fetches transparency reports from `/reports` directory

### 3. Content Transformation

For each page, the script:

1. Fetches raw markdown from GitHub
2. Removes the main title (added in frontmatter instead)
3. **Transforms relative links** to absolute GitHub URLs
4. Removes HTML comments
5. Adds source attribution with last sync date
6. Converts to Mintlify-compatible MDX format

**Example link transformation:**

```markdown
# Before (in cosmos/security repo)
[Classification Matrix](./resources/CLASSIFICATION_MATRIX.md)

# After (in docs)
[Classification Matrix](https://github.com/cosmos/security/blob/main/resources/CLASSIFICATION_MATRIX.md)
```

### 4. PR Creation

If changes are detected:

1. Creates a pull request titled "🔒 Sync Security Documentation"
2. Adds labels: `documentation`, `security`, `automated`
3. Includes a checklist for reviewers
4. Lists all updated files

Once the PR is reviewed and merged, changes go live on the docs site.

## Audit Auto-Generation

The audits page is **fully auto-generated** by:

1. **Fetching directory structure** from `cosmos/security/audits`
2. **Recursively scanning** all subdirectories (sdk, evm, gaia, ics, ledger)
3. **Finding all files** with extensions: `.pdf`, `.md`, `.markdown`
4. **Organizing by component** with subdirectory headers
5. **Generating display names** from filenames (converts underscores/dashes to title case)

### Example Output

```markdown
## Cosmos SDK
- [Cosmos SDK V53 Audit Final](...)

## Ledger

**ledger/**
- [2023 Zondax](...)
- [2026 Zondax](...)

## Transparency Reports
- [Transparency Report 2023 2024](...)
```

### Adding New Audits

To add a new audit to the docs:

1. Add the PDF or markdown file to `cosmos/security/audits/<component>/`
   - Files can be at any depth (e.g., `audits/sdk/2024/audit.pdf`)
2. Wait for next Monday's automatic sync (or trigger manually)
3. Review and merge the PR
4. New audit will appear on the docs site

**No manual docs updates needed!**

## Configuration

Edit constants at the top of `sync-security-docs.js`:

```javascript
const SECURITY_REPO = 'cosmos/security';
const SECURITY_BRANCH = 'main';
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'sdk', 'v0.53', 'security');
```

**To sync to a different SDK version:**
- Change `OUTPUT_DIR` to point to the desired version (e.g., `sdk/v0.54/security`)
- Update navigation in `docs.json` to include the new security section

## GitHub Actions Workflow

### Workflow Configuration

**File**: `.github/workflows/sync-security-docs.yml`

**Schedule**:
```yaml
schedule:
  - cron: '0 9 * * 1'  # Every Monday at 9am UTC
```

**Permissions**:
```yaml
permissions:
  contents: write         # To commit changes
  pull-requests: write    # To create PRs
```

### Workflow Steps

1. **Checkout**: Checks out docs repo
2. **Setup Node**: Installs Node.js 18
3. **Run Sync**: Executes `sync-security-docs.js`
4. **Check Changes**: Detects if any files changed
5. **Create PR**: If changes detected, creates PR with:
   - Clear title and description
   - Automated labels
   - Review checklist

### Manual Trigger

Trigger the workflow manually:

1. Navigate to: **Actions** → **Sync Security Documentation**
2. Click **"Run workflow"**
3. Select branch (usually `main`)
4. Click **"Run workflow"** button

### No Authentication Needed

- ✅ Fetches from **public** `cosmos/security` repo (no auth required)
- ✅ Uses built-in `GITHUB_TOKEN` for PR creation (automatically provided by GitHub Actions)
- ❌ No additional secrets or tokens needed

## Link Transformation Details

The script transforms three types of relative links:

### 1. Same Directory Links (`./`)

```markdown
# Source file: SECURITY.md
[Guide](./GUIDE.md)

# Transformed to:
[Guide](https://github.com/cosmos/security/blob/main/GUIDE.md)
```

### 2. Parent Directory Links (`../`)

```markdown
# Source file: docs/POLICY.md
[README](../README.md)

# Transformed to:
[README](https://github.com/cosmos/security/blob/main/README.md)
```

### 3. Subdirectory Links

```markdown
# Source file: SECURITY.md
[Matrix](resources/CLASSIFICATION_MATRIX.md)

# Transformed to:
[Matrix](https://github.com/cosmos/security/blob/main/resources/CLASSIFICATION_MATRIX.md)
```

**Absolute URLs are preserved unchanged:**
- `https://example.com` → unchanged
- `http://example.com` → unchanged
- `//example.com` → unchanged
- `#anchor` → unchanged

## Maintenance

### When to Run Manually

- After a new security audit is published
- When security policy is updated in `cosmos/security`
- To verify changes before the weekly automated sync
- For testing after modifying the sync script

### Troubleshooting

**Sync fails with fetch error:**
- Verify `cosmos/security` repo is accessible
- Check internet connection
- Try running locally: `node scripts/versioning/sync-security-docs.js`

**Links not working:**
- Check that relative links are being transformed correctly
- View generated MDX files in `sdk/v0.53/security/`
- Test locally with `npx mint dev`

**Audit files missing:**
- Verify files have correct extensions (`.pdf`, `.md`, `.markdown`)
- Check that files aren't in `.gitignore`
- Ensure GitHub API can access the files

**PR not created:**
- Check GitHub Actions logs for errors
- Verify `sync-security-docs.yml` workflow file exists
- Ensure workflow has correct permissions

### Testing Changes to Sync Script

```bash
# 1. Modify sync-security-docs.js

# 2. Run locally
node scripts/versioning/sync-security-docs.js

# 3. Check output files
ls -la sdk/v0.53/security/

# 4. Preview in browser
npx mint dev

# 5. Commit if everything looks good
git add scripts/versioning/sync-security-docs.js sdk/v0.53/security/
git commit -m "Update security docs sync script"
```

## File Structure

```
scripts/versioning/
├── sync-security-docs.js        # Main sync script (ESM)
└── SECURITY-SYNC.md            # This file

.github/workflows/
└── sync-security-docs.yml       # Automated weekly sync workflow

sdk/v0.53/security/              # Generated output directory
├── security-policy.mdx          # From POLICY.md
├── bug-bounty.mdx              # From SECURITY.md
└── audits.mdx                  # Auto-generated from /audits + /reports
```

## Script Reference

### Functions

**`fetchFromGitHub(filePath)`**
- Fetches raw markdown from cosmos/security repo
- Returns: string content

**`fetchDirectoryRecursive(path, baseUrl)`**
- Recursively fetches all files from a directory
- Returns: array of file objects with metadata

**`fetchAuditSubdirectory(dirName)`**
- Fetches all audit files for a component
- Returns: array of audit file objects

**`fetchReports()`**
- Fetches transparency reports
- Returns: array of report file objects

**`transformToMDX(content, sourceFile, title)`**
- Converts markdown to MDX with frontmatter
- Transforms relative links to absolute URLs
- Adds source attribution
- Returns: formatted MDX string

**`generateSecurityPolicyPage()`**
- Generates security-policy.mdx
- Fetches from POLICY.md

**`generateBugBountyPage()`**
- Generates bug-bounty.mdx
- Fetches from SECURITY.md

**`generateAuditsPage()`**
- Generates audits.mdx
- Auto-generates from /audits and /reports

**`main()`**
- Orchestrates the entire sync process
- Creates output directory if needed
- Calls all generation functions

## Related Documentation

- [Versioning System README] README.md - Documentation versioning for releases
- [cosmos/security Repository](https://github.com/cosmos/security) - Source of security documentation
- [GitHub Actions Documentation](https://docs.github.com/en/actions) - Workflow automation
- [Mintlify Documentation](https://mintlify.com/docs) - MDX reference
