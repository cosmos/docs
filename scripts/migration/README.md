# Docusaurus to Mintlify Migration Tool

A comprehensive migration tool for converting Docusaurus documentation to Mintlify format with intelligent link resolution, content transformation, and multi-version support.

## Features

- **Dry-Run Mode**: Preview migrations without writing any files - see what will happen before committing
- **Smart Path Resolution**: Properly handles relative links (`../`, `./`, implicit) with numbered prefix support
- **Multi-Version Support**: Migrate all versions at once or individual versions
- **Content Caching**: Deduplicates identical content across versions for faster processing
- **Staging Mode**: Write to temp directory for review before copying to final location
- **AST-Based Transformations**: Uses unified/remark for accurate markdown processing
- **Automatic Conversions**:
  - Docusaurus admonitions → Mintlify callouts
  - HTML → JSX-compatible syntax
  - Image path resolution
  - Numbered prefix stripping (e.g., `01-learn/` → `learn/`)
  - Extension changes (`.md` → `.mdx`)
  - Link formatting fixes (removes backticks in link text: `[`code`](link)` → `[code](link)`)
- **Error Reporting**: Comprehensive migration report with warnings and errors

## Installation

```bash
cd scripts/migration
npm install
```

## Quick Start

### Interactive Mode (Recommended)

```bash
node migrate.js

# Prompts for all versions:
# 1. Choose option: 2 (all versions)
# 2. Repository path: ~/repos/gaia
# 3. Target directory: ./hub
# 4. Product name: hub
# 5. Dry run mode: y (recommended first!)
# 6. [Review output, then run again with dry-run: n]
# 7. Staging mode: n
# 8. Update navigation: y
```

### Non-Interactive Mode

```bash
# Dry run first - see what will be migrated
node migrate.js ~/repos/gaia ./hub hub --dry-run

# Staging mode - write to temp for review
node migrate.js ~/repos/gaia ./hub hub --staging

# Full migration with navigation
node migrate.js ~/repos/gaia ./hub hub --update-nav
```

**Available Options:**

- `--dry-run` - Process files but don't write anything (preview mode)
- `--staging` - Write to `./tmp/migration-staging` instead of target
- `--update-nav` - Update `docs.json` and `versions.json` with navigation

## Usage Modes

### 1. Single Version Migration

Migrate one specific version at a time.

**When to use:**

- Importing a new version to existing docs
- Testing migration on one version first
- Migrating non-standard directory structures

**Output:**

```shell
./sdk/v0.52/
  ├── learn/
  ├── build/
  └── integrate/
```

### 2. Multi-Version Migration

Migrate all versions from a Docusaurus repository at once.

**When to use:**

- Initial migration from Docusaurus
- Syncing all versions at once
- Bulk operations

**What it processes:**

- `docs/` → `next/` (current development docs)
- `versioned_docs/version-X.Y/` → `vX.Y/` (released versions)

**Output:**

```shell
./sdk/
  ├── next/
  ├── v0.52/
  ├── v0.50/
  └── images/
```

### 3. Dry-Run Mode

Process all files and show what will happen **without writing anything**.

**When to use:**

- **ALWAYS run first** before any actual migration
- Preview conversion results
- Check for errors and warnings
- Validate link resolution
- See file counts and statistics
- Test migration settings

**What happens:**

- All files are processed with full conversion logic
- Migration report shows errors and warnings
- Cache statistics displayed
- No files written to disk
- No images copied
- No navigation updates

**Workflow:**

```bash
# 1. Dry run first
node migrate.js ~/repos/gaia ./hub hub --dry-run

# 2. Review the migration report
#    - Check for errors
#    - Note any warnings
#    - Verify file counts

# 3. If everything looks good, run without dry-run
node migrate.js ~/repos/gaia ./hub hub --update-nav
```

**Interactive mode:**

```bash
node migrate.js
# When prompted: Dry run mode? → y
```

### 4. Staging Mode

Write to `./tmp/migration-staging` for review before copying to final location.

**When to use:**

- Cherry-picking specific sections
- Reviewing actual converted files
- Testing in Mintlify preview
- Avoiding overwriting existing docs
- Making manual adjustments before final copy

**Workflow:**

```bash
# 1. Enable staging mode when prompted (or use --staging flag)
node migrate.js ~/repos/gaia ./hub hub --staging

# 2. Review converted files
ls -la ./tmp/migration-staging/
cat ./tmp/migration-staging/v25/intro.mdx

# 3. Optional: Test in Mintlify
npx mint dev  # Preview the staged files

# 4. Copy what you want
cp -r ./tmp/migration-staging/v25 ./hub/
cp -r ./tmp/migration-staging/images ./assets/hub/

# 5. Clean up
rm -rf ./tmp/migration-staging
```

**Important:** Links point to final location (`/hub/v25/`), so they work immediately when copied!

## Recommended Workflow

For a safe, controlled migration:

```bash
# 1. DRY RUN - Always start here
node migrate.js ~/repos/gaia ./hub hub --dry-run
# ✓ Review errors and warnings
# ✓ Check file counts
# ✓ Verify no critical issues

# 2. STAGING - Test the actual output
node migrate.js ~/repos/gaia ./hub hub --staging
# ✓ Review converted files in ./tmp/migration-staging
# ✓ Check link resolution
# ✓ Test with Mintlify: npx mint dev

# 3. PRODUCTION - Final migration
node migrate.js ~/repos/gaia ./hub hub --update-nav
# ✓ Files written to ./hub/
# ✓ Images copied to ./assets/hub/images/
# ✓ Navigation updated in docs.json

# 4. VERIFY
npx mint dev  # Test the live docs
npx mint broken-links  # Check for broken links
```

**Time investment:**

- Dry run: 2-3 minutes
- Staging review: 5-10 minutes
- Production: 2-3 minutes
- Total: ~15 minutes for a safe migration

## Common Scenarios

### Scenario 1: Import Only 'docs' as 'next'

```bash
# Hide versioned_docs temporarily
cd ~/repos/cosmos-sdk-docs
mv versioned_docs versioned_docs_backup

# Run migration
cd ~/repos/docs
node migrate.js
# Option 2, staging mode yes

# Review and copy
cp -r ./tmp/migration-staging/next ./sdk/
cp -r ./tmp/migration-staging/images ./sdk/

# Restore
cd ~/repos/cosmos-sdk-docs
mv versioned_docs_backup versioned_docs
```

### Scenario 2: Cherry-Pick Specific Sections

```bash
# Use staging mode
node migrate.js
# Enable staging mode

# Copy only what you need
mkdir -p ./sdk/next
cp -r ./tmp/migration-staging/next/learn ./sdk/next/
cp -r ./tmp/migration-staging/next/build ./sdk/next/
# Skip deprecated, old-tutorials, etc.
```

### Scenario 3: Migrate Multiple Products

```bash
# Migrate SDK
node migrate.js ~/repos/cosmos-sdk-docs ./sdk sdk --update-nav

# Migrate IBC
node migrate.js ~/repos/ibc-go-docs ./docs/ibc ibc --update-nav

# Migrate CometBFT
node migrate.js ~/repos/cometbft-docs ./docs/cometbft cometbft --update-nav
```

## Path Resolution

### How It Works

The migration script handles numbered prefixes (used for Docusaurus sidebar ordering) intelligently:

**Source:**

```shell
01-learn/
  ├── 00-intro.md
  └── 02-advanced/
      └── architecture.md
```

**Link in `architecture.md`:** `../00-intro.md`

**Resolution Process:**

1. Keep prefixes during resolution: `01-learn/02-advanced` + `../` = `01-learn/00-intro.md`
2. Strip prefixes after resolution: `01-learn/00-intro.md` → `learn/intro.md`
3. Generate final URL: `/sdk/v0.52/learn/intro`

**Output:**

```shell
learn/
  ├── intro.mdx
  └── advanced/
      └── architecture.mdx
```

All links: `/sdk/v0.52/...` (clean URLs)

### Supported Link Formats

| Source Link          | Resolved To                          |
| -------------------- | ------------------------------------ |
| `../intro.md`        | `/sdk/v0.52/learn/intro`             |
| `./concepts.md`      | `/sdk/v0.52/learn/advanced/concepts` |
| `../../build/cli.md` | `/sdk/v0.52/build/cli`               |
| `/learn/intro.md`    | `/sdk/v0.52/learn/intro`             |
| `https://...`        | `https://...` (unchanged)            |
| `#anchor`            | `#anchor` (unchanged)                |

## Image Handling

Images are copied to a centralized assets directory:

**Source:**

```shell
~/repos/gaia/static/img/validators.png
```

**Output:**

```shell
./assets/hub/images/img/validators.png
```

**References in files:**

```markdown
<!-- File: hub/v25/validators/overview.mdx -->

![Validators](/assets/hub/images/img/validators.png)
```

**Key points:**

- Images go to `./assets/<product>/images/` (not `/<product>/images/`)
- Numbered prefixes are stripped from image paths
- Relative paths work: `../../assets/hub/images/...`
- Absolute paths work: `/assets/hub/images/...`

## Navigation Generation

When enabled, the script automatically updates:

- **`docs.json`**: Adds navigation structure for all migrated versions
- **`versions.json`**: Registers product versions

**Format:**

```json
{
  "navigation": {
    "dropdowns": [
      {
        "dropdown": "SDK",
        "icon": "gear",
        "versions": [
          {
            "version": "v0.52",
            "tabs": [
              {
                "tab": "Documentation",
                "groups": [
                  {
                    "group": "Learn",
                    "pages": ["sdk/v0.52/learn/intro", ...]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

## Conversions Applied

### 1. Admonitions → Callouts

**Before (Docusaurus):**

```markdown
:::note
This is important
:::
```

**After (Mintlify):**

```markdown
<Note>
This is important
</Note>
```

Supports: `note`, `tip`, `info`, `warning`, `danger`, `caution`

### 2. HTML → JSX

- `class=` → `className=`
- Self-closing tags enforced
- Attribute quoting normalized

### 3. MDX Fixes

- Template variables wrapped in backticks
- Table cell underscores escaped
- JSX comment syntax corrected
- `<details>` → `<Expandable>`

### 4. File Extensions

- `.md` → `.mdx`
- Removed from links

### 5. Numbered Prefixes

- `01-learn/` → `learn/`
- `00-intro.md` → `intro.mdx`
- Applied to files, directories, and links

## Configuration

### Product Icons

Default icons for common products (edit in `getProductIcon()` function):

```javascript
const iconMap = {
  sdk: "gear",
  ibc: "link",
  cometbft: "star",
  evm: "code",
  wasmd: "cube",
  hermes: "rocket",
};
```

### File Patterns

Processed files:

- `**/*.md`
- `**/*.mdx`

Copied images:

- `**/*.{png,jpg,jpeg,gif,svg,webp}`

## Migration Report

After migration, you'll get a detailed report:

```shell
 MIGRATION REPORT
================================================================================

 ERRORS (3) - These need manual fixes:
----------------------------------------

 learn/advanced/module.md:
  Line 45: Unclosed JSX tag
     Suggestion: Add closing </Note> tag

  WARNINGS (12) - Automatically handled but please verify:
----------------------------------------

 build/cli.md:
  Line 23: Double backticks converted to single
     Applied: Changed `` to `

 Migration Cache Statistics:
==================================================
Total files processed: 245
Unique content blocks: 198
Duplicate files (cache hits): 47
Duplicate percentage: 19.2%
==================================================
```

## Performance

### Caching Strategy

The script caches content by SHA-256 checksum:

- **First occurrence:** Full processing (~500ms per file)
- **Duplicate content:** Cache hit (~5ms per file)

**Example:** If you have 3 versions with 150 identical files:

- Without cache: 450 files × 500ms = 225 seconds
- With cache: 150 unique × 500ms + 300 duplicates × 5ms = 76.5 seconds
- **Savings: 66% faster**

### Optimization Tips

1. **Use multi-version mode**: Processes all versions in one run, maximizing cache hits
2. **Keep content consistent**: More duplicate content = better cache performance
3. **Process largest version first**: If doing one at a time, start with the most recent

## Advanced Usage

### Custom Link Resolution

Edit `createLinkFixerPlugin()` function (line 1394) to customize link transformation logic.

### Custom Content Transformations

Edit `convertDocusaurusToMintlify()` function (line 1829) to add custom conversions.

### Post-Processing Links

The `fixNumberedPrefixLinks()` function (line 2256) runs after all files are processed to clean up any remaining numbered prefixes in links.

## File Structure

```shell
scripts/migration/
├── README.md           ← This file
├── package.json        ← Dependencies
└── migrate.js          ← Main script
```

## Dependencies

- `gray-matter`: Frontmatter parsing
- `unified`: Markdown AST processing
- `remark-parse`: Markdown parser
- `remark-stringify`: Markdown generator
- `remark-gfm`: GitHub Flavored Markdown support
- `unist-util-visit`: AST traversal

## API

### Exported Functions

```javascript
import {
  convertDocusaurusToMintlify,
  processDirectory,
  migrateAllVersions,
  updateDocsJson,
  // ... more functions
} from "./migrate.js";
```

Use for custom migration scripts or integration with other tools.

## Examples

### Example 1: Safe Migration (Hub v25)

```bash
# 1. Dry run
node migrate.js ~/repos/gaia ./hub hub --dry-run
# Review: 45 files, 2 warnings, 0 errors

# 2. Staging
node migrate.js ~/repos/gaia ./hub hub --staging
# Review files in ./tmp/migration-staging/

# 3. Production
node migrate.js ~/repos/gaia ./hub hub --update-nav
```

### Example 2: Interactive Mode

```bash
node migrate.js

# Prompts:
# Choice: 2 (all versions)
# Repository: ~/repos/gaia
# Target: ./hub
# Product: hub
# Dry run: y    ← Test first!
# [Run again with dry-run: n]
# Staging: n
# Update nav: y
```

### Example 3: Staging + Cherry-Pick

```bash
# Staging mode
node migrate.js ~/repos/gaia ./hub hub --staging

# Copy only what you need
cp -r ./tmp/migration-staging/v25/validators ./hub/v25/
cp -r ./tmp/migration-staging/v25/resources ./hub/v25/
cp -r ./tmp/migration-staging/images ./assets/hub/
```

### Example 4: Multiple Products

```bash
#!/bin/bash
# Migrate multiple products safely

products=("sdk" "ibc" "evm" "hub")
for product in "${products[@]}"; do
  echo "=== Migrating $product ==="

  # Dry run first
  node migrate.js ~/repos/$product-docs ./$product $product --dry-run

  # If successful, do real migration
  if [ $? -eq 0 ]; then
    node migrate.js ~/repos/$product-docs ./$product $product --update-nav
  fi
done
```

## Best Practices

1. **Always dry-run first** - Run `--dry-run` before any migration to catch issues
2. **Use staging for review** - Test actual output with `--staging` before production
3. **Review the migration report** - Check all errors and warnings before proceeding
4. **Test incrementally**:
   - Dry run → Review report
   - Staging → Review files
   - Production → Test in Mintlify
5. **Verify links** - Run `npx mint broken-links` after migration
6. **Commit in stages**: files → images → navigation updates
7. **Keep source repo** - Don't delete Docusaurus docs until fully verified
8. **Use version control** - Easy to rollback if needed
9. **Check file structure** - Ensure products are at root level (`./hub/`, not `./docs/hub/`)
10. **Validate images** - Confirm images are in `./assets/<product>/images/`

## Troubleshooting

### "No files will be written" - I ran the migration but nothing happened

You're in dry-run mode! This is intentional - dry-run shows what will happen without writing files.

**Solution:** Run without `--dry-run` flag or answer 'n' to the dry-run prompt.

### Migration completed but I can't find the files

Check if you used staging mode - files are in `./tmp/migration-staging/` instead of your target directory.

**Solution:**

```bash
# Copy from staging to final location
cp -r ./tmp/migration-staging/* ./<product>/
```

### Images not showing in Mintlify

Images should be in `./assets/<product>/images/`, not `/<product>/images/`.

**Solution:** Check image paths in migration output, ensure they reference `/assets/hub/images/...`

### Links pointing to wrong location

Make sure you're using the correct product name during migration.

**Solution:** Product name should match your directory structure (e.g., `hub` for `./hub/`)

### Navigation not updating

Navigation updates are skipped in dry-run and staging modes.

**Solution:** Run without `--dry-run` or `--staging`, and use `--update-nav` flag.

## Support

For issues or questions:

- Check this README first
- Review the migration report for specific errors
- Check Mintlify docs: <https://mintlify.com/docs>
- Open an issue in the repository

## License

MIT
