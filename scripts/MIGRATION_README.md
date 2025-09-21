# Docusaurus to Mintlify Migration Scripts

Convert Docusaurus documentation to Mintlify format with proper MDX syntax, code formatting, and navigation structure.

Comprehensive migration tool that handles complex conversions, caching, and automatic fixes while reporting issues that need manual intervention.

## Scripts

### `migrate-docusaurus.js`

Full repository migration with versioning support and navigation updates.

**Usage:**

```bash
# Interactive mode (with prompts)
node migrate-docusaurus.js

# Non-interactive mode (migrate all versions)
node migrate-docusaurus.js <source-repo> <target-dir> <product> [--update-nav]

# Examples
node migrate-docusaurus.js ~/repos/cosmos-sdk-docs ./tmp sdk
node migrate-docusaurus.js ~/repos/cosmos-sdk-docs ./tmp sdk --update-nav
```

**Parameters:**

- `<source-repo>`: Path to Docusaurus repository (e.g., `~/repos/cosmos-sdk-docs`)
- `<target-dir>`: Output directory for migrated files (e.g., `./tmp`)
- `<product>`: **Required** - Product name for link resolution (e.g., `sdk`, `ibc`, `evm`, `cometbft`)
  - Determines internal link structure: `/docs/<product>/<version>/<path>`
  - Critical for proper link resolution in final documentation
- `--update-nav`: Optional flag to update `docs.json` navigation

**Features:**

- **Content-based caching**: Processes identical content only once using SHA-256 checksums
- **Intelligent processing**: Cache hits for duplicate content, full processing for unique content
- **GitHub reference fetching**: Automatically fetches code from GitHub URLs in reference blocks
- **Title generation**: Creates titles from filenames when missing (e.g., `adr-046-module-params` → "ADR 046 Module Params")
- **Smart comment handling**: Removes long HTML comments (>10 lines) that break JSX conversion
- **Comprehensive validation**: Reports only real issues requiring manual intervention
- **Performance optimized**: Shows cache statistics and duplicate percentage
- **Proper exit handling**: Script exits cleanly with appropriate exit codes
- Migrates all versions: `docs/` (next) and `versioned_docs/version-*`
- Preserves `sidebar_position` for navigation ordering
- AST-based processing for accuracy
- Removes file extensions from internal links for Mintlify compatibility

### `migrate-single-file.js`

Convert individual Docusaurus markdown files to Mintlify MDX.

**Usage:**

```bash
node migrate-single-file.js <input-file> <output-file>

# Example
node migrate-single-file.js ../cosmos-sdk-docs/docs/learn/events.md ../tmp/events.mdx
```

## Migration Workflow

### Content Processing Pipeline

1. **Content Checksumming**

   - SHA-256 hash calculated for each file's raw content
   - Duplicate detection across versions
   - Cache lookup for previously processed content

2. **Transformation Steps** (for new content only)

   - Parse frontmatter and extract metadata
   - Convert HTML comments to JSX: `<!-- -->` → `{/* */}`
   - Process with AST for link fixing and code enhancement
   - Apply MDX fixes (escape underscores, fix JSX expressions)
   - Convert admonitions to Mintlify format
   - Validate content and report issues
   - Generate Mintlify-compatible frontmatter

3. **Caching System**

   - Transformation results cached by content checksum
   - Validation errors cached separately
   - Cache hits skip processing but still write output files
   - Statistics track unique content vs duplicates

4. **GitHub Reference Fetching**

   - Detects `go reference` blocks with GitHub URLs
   - Automatically fetches actual code content
   - Falls back to comment if fetch fails
   - Only fetches once per unique URL

5. **Validation & Error Reporting**
   - Checks for unclosed JSX expressions
   - Validates matching open/close tags
   - Reports only issues needing manual fixes
   - No duplicate reporting for identical content

## Conversions Applied

### Admonitions

```markdown
# Docusaurus

:::note Title
Content
:::

# Mintlify

<Note>
**Title**
Content
</Note>
```

### Code Blocks

- Removes "reference" keyword from language specification
- Adds `expandable` for blocks >10 lines
- Auto-detects language (Go, JavaScript, Python, JSON, etc.)
- Preserves reference URLs as comments

### Links & Paths

- Fixes relative paths (`../file.md` → absolute path)
- Removes file extensions from internal links (`.md` and `.mdx` removed)
- Updates versioned links: `/docs/` → `/docs/<product>/<version>/`
- Maintains external links unchanged

### MDX Compatibility

- HTML comments → JSX comments (short ones only)
- Long HTML comments (>10 lines) are removed entirely
- `<details>` → `<Expandable>`
- Placeholders like `<module>`, `<appd>` wrapped in backticks
- Template variables `{foo}` wrapped in backticks
- JSON objects in tables wrapped in backticks
- Escapes underscores in table cells

### Frontmatter

- Generates title from filename if missing (e.g., `adr-046-module-params` → "ADR 046 Module Params")
- Extracts title from H1 heading if not in frontmatter
- Preserves `sidebar_position` for navigation ordering
- Cleans multi-line descriptions for single-line format
- Removes problematic content from descriptions
- Generates clean Mintlify-compatible frontmatter
- Removes Docusaurus-specific fields

## File Structure

**Input (Docusaurus):**

```
cosmos-sdk-docs/
├── docs/                    # Current/next version
├── versioned_docs/
│   ├── version-0.47/
│   ├── version-0.50/
│   └── version-0.53/
```

**Output (Mintlify):**

```
docs/
└── sdk/
    ├── next/
    ├── v0.47/
    ├── v0.50/
    └── v0.53/
```

## Navigation

When using `--update-nav`, the script updates `docs.json` with:

- Proper dropdown structure for products
- Version-specific navigation tabs
- Files sorted by `sidebar_position`
- Conflict resolution for duplicate positions

## Edge Cases Handled

- Code blocks with indented backticks
- Unclosed HTML comments
- Reference syntax with GitHub URLs
- Command placeholders in documentation
- Comparison operators and arrows
- Mixed content in admonitions
- Tables with curly brackets
- Go-specific patterns (`interface{}`, `map[string]interface{}`)

## Migration Output

### Reports Generated

**Per-version statistics:**

```
Conversion stats for v0.50:
  - Total files: 150
  - Unique content processed: 120
  - Cache hits (duplicates): 30
```

**Final cache statistics:**

```
 Migration Cache Statistics:
==================================================
Total files processed: 600
Unique content blocks: 450
Duplicate files (cache hits): 150
Duplicate percentage: 25.0%
==================================================
```

**Migration report example:**

```
 MIGRATION REPORT
================================================================================

 ERRORS (6) - These need manual fixes:
----------------------------------------
 path/to/file.md:
  Line 45: Unclosed opening tag <Expandable>
     Suggestion: Add matching closing tag

REMOVED CONTENT (2) - Content that was removed:
----------------------------------------
build/building-modules/09-module-interfaces.md:
  Removed long HTML comment: 69-line comment removed (likely documentation notes)

================================================================================
Summary: 6 errors, 0 warnings, 2 removals
================================================================================
```

## Dependencies

```json
{
  "dependencies": {
    "gray-matter": "^4.0.3",
    "unified": "^11.0.0",
    "remark-parse": "^11.0.0",
    "remark-stringify": "^11.0.0",
    "remark-gfm": "^4.0.0",
    "unist-util-visit": "^5.0.0"
  }
}
```

## Migration Report Details

The script generates a comprehensive report showing:

1. **ERRORS**: Issues that require manual intervention

   - Unclosed JSX expressions
   - Mismatched tags
   - Syntax that couldn't be automatically fixed

2. **WARNINGS**: Issues that were automatically fixed but should be reviewed

3. **REMOVED CONTENT**: Content that was removed because it couldn't be safely converted
   - Long HTML comments (>10 lines)
   - Malformed syntax that would break MDX

## Important Notes

### Product Parameter

- **Required** for all migrations (interactive and non-interactive)
- Determines internal link structure: `/docs/<product>/<version>/<path>`
- Without correct product, internal documentation links will be broken
- Common values: `sdk`, `ibc`, `evm`, `cometbft`

### Processing Behavior

- Identical content across versions is processed only once
- Each file still gets written to its appropriate version directory
- Validation errors are reported for each file location
- Cache system significantly improves performance for large repositories

### Recent Improvements (2025)

- Content-based caching with SHA-256 checksums
- Automatic GitHub code fetching for reference blocks
- Title generation from filenames when missing
- Smart handling of long HTML comments (removed with tracking)
- File extension removal from internal links
- Proper script exit handling with exit codes
- Required product parameter for proper link resolution
- Fixed JSX comment escaping issues
- Improved validation with fewer false positives
- Template variables and JSON in tables properly escaped

### Technical Details

- Code content is preserved exactly - no arbitrary removal
- Reference URLs are fetched or converted to comments
- AST processing used where possible, regex as fallback
- Multiple passes ensure proper sequencing of fixes
- Code blocks are protected during transformations
- Script exits with code 0 on success, 1 on failure
- Long HTML comments (>10 lines) are removed to prevent JSX errors
- Placeholders like `<module>` are wrapped in backticks automatically

## Troubleshooting

### Common Issues

1. **Script doesn't exit**: Fixed in latest version - now properly exits with appropriate codes

2. **False positive JSX errors**: Most "Unclosed JSX expression" errors are false positives from validation checking code inside code blocks

3. **Missing titles**: Script now generates titles from filenames when no title exists in frontmatter or H1

4. **Long HTML comments breaking conversion**: Comments >10 lines are automatically removed and reported

5. **Internal links not working**: Ensure you specify the correct product parameter (e.g., `sdk`, `ibc`)

### Migration Best Practices

1. Always specify the product parameter for proper link resolution
2. Review the "REMOVED CONTENT" section to ensure no important content was removed
3. Check files with reported errors - many may be false positives
4. Run `npx mint dev` to test the migrated documentation
5. Use cache statistics to verify efficient processing

## Example Commands

```bash
# Migrate SDK docs without updating navigation
node migrate-docusaurus.js ~/repos/cosmos-sdk-docs ./tmp sdk

# Migrate IBC docs and update navigation
node migrate-docusaurus.js ~/repos/ibc-go-docs ./tmp ibc --update-nav

# Migrate a single file
node migrate-single-file.js ~/repos/cosmos-sdk-docs/docs/learn/intro.md ./tmp/intro.mdx
```
