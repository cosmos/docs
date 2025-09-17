# Docusaurus to Mintlify Migration Scripts

Convert Docusaurus documentation to Mintlify format with proper MDX syntax, code formatting, and navigation structure.

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
- **Content-based caching**: Processes identical content only once
- **SHA-256 checksumming**: Detects duplicate files across versions
- **Intelligent processing**: Cache hits for duplicate content, full processing for unique content
- **GitHub reference fetching**: Automatically fetches code from GitHub URLs in reference blocks
- **Comprehensive validation**: Reports issues requiring manual intervention
- **Performance optimized**: Shows cache statistics and duplicate percentage
- Migrates all versions: `docs/` (next) and `versioned_docs/version-*`
- Preserves `sidebar_position` for navigation ordering
- AST-based processing for accuracy

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
- Fixes relative paths (`../file.md` → `/file.md`)
- Updates versioned links for products
- Maintains external links unchanged

### MDX Compatibility
- HTML comments → JSX comments
- `<details>` → `<Expandable>`
- Problematic angle brackets wrapped in backticks
- Template variables `{foo}` wrapped in backticks

### Frontmatter
- Preserves `sidebar_position` for navigation ordering
- Extracts title from content if not in frontmatter
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
📊 Migration Cache Statistics:
==================================================
Total files processed: 600
Unique content blocks: 450
Duplicate files (cache hits): 150
Duplicate percentage: 25.0%
==================================================
```

**Error report (if issues found):**
```
❌ ERRORS (10) - These need manual fixes:
----------------------------------------
📄 path/to/file.md:
  Line 45: Unclosed opening tag <Expandable>
    💡 Suggestion: Add matching closing tag
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
- Duplicate error prevention
- Comprehensive migration statistics
- Required product parameter for proper link resolution
- Fixed JSX comment escaping issues
- Improved validation with fewer false positives

### Technical Details
- Code content is preserved exactly - no arbitrary removal
- Reference URLs are fetched or converted to comments
- AST processing used where possible, regex as fallback
- Multiple passes ensure proper sequencing of fixes
- Code blocks are protected during transformations