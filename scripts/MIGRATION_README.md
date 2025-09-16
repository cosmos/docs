# Docusaurus to Mintlify Migration Scripts

Convert Docusaurus documentation to Mintlify format with proper MDX syntax, code formatting, and navigation structure.

## Scripts

### `migrate-docusaurus.js`
Full repository migration with versioning support and navigation updates.

**Usage:**
```bash
# Interactive mode
node migrate-docusaurus.js

# Non-interactive mode
node migrate-docusaurus.js <repo-path> <product> [--target <dir>] [--update-nav]

# Example
node migrate-docusaurus.js /path/to/cosmos-sdk-docs sdk --target ./tmp
```

**Features:**
- Migrates all versioned documentation (`versioned_docs/version-*`)
- Preserves `sidebar_position` for navigation ordering
- Updates `docs.json` navigation (when `--update-nav` flag is used)
- AST-based processing for accuracy

### `migrate-single-file.js`
Convert individual Docusaurus markdown files to Mintlify MDX.

**Usage:**
```bash
node migrate-single-file.js <input-file> <output-file>

# Example
node migrate-single-file.js ../cosmos-sdk-docs/docs/learn/events.md ../tmp/events.mdx
```

## Conversion Pipeline

### Multi-Pass Processing (Sequential)

1. **Fix Malformed Code Blocks**
   - Remove whitespace before backticks
   - Close unclosed code blocks
   - Normalize code block structure

2. **Handle Reference Syntax**
   - Convert Docusaurus ````lang reference\nURL\n```' blocks
   - Preserve URLs as comments in code blocks
   - Maintain language specification

3. **Enhance Code Blocks**
   - Add `expandable` property for blocks >10 lines
   - Auto-detect language from content
   - Format code based on language

4. **Fix Inline Code & Brackets**
   - Wrap `{value}` patterns in backticks
   - Handle `interface{}` and similar Go patterns
   - Fix curly brackets in tables

5. **Convert HTML Elements**
   - Convert HTML comments `<!-- -->` to JSX `{/* */}`
   - Replace `<details>` with `<Expandable>`
   - Fix command placeholders (`<appd>` → `` `appd` ``)
   - Handle comparison operators (`<=>` → `` `<=>` ``)

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

## Dependencies

```json
{
  "dependencies": {
    "gray-matter": "^4.0.3",
    "unified": "^11.0.0",
    "remark-parse": "^11.0.0",
    "remark-stringify": "^11.0.0",
    "unist-util-visit": "^5.0.0"
  }
}
```

## Notes

- Code content is preserved exactly - no arbitrary removal
- Reference URLs are converted to comments, not deleted
- AST processing used where possible, regex as fallback
- Multiple passes ensure proper sequencing of fixes
- Code blocks are processed first to prevent syntax breaking