# Migration Error Test Cases

This file contains all the problematic patterns found during migration that cause MDX parsing errors.

## Error Categories

### 1. Template Variables in Braces

**Error**: "Could not parse expression with acorn"
**Location**: Lines containing `{placeholder}` syntax

```markdown
### Neutral

{neutral consequences}
```

```markdown
### Negative

{negative consequences}
```

### 2. Escaped Special Characters in Template Literals

**Error**: "Unexpected character `-` before name"
**Location**: Lines with escaped backticks in template literals

```markdown
essential that node \`<->\` sidecar connectivity stays stable
```

### 3. Malformed JSX Comments

**Error**: "Could not parse expression with acorn"
**Location**: Lines with incomplete JSX comment conversion

```markdown
{/\* ## Further Discussions

While an ADR is in the DRAFT or PROPOSED stage...
Later, this section can optionally list ideas... \*/}
```

```markdown
{/\* //nolint:all \*/}
```

### 4. Unclosed HTML Tags

**Error**: "Expected a closing tag for `<details>`"
**Location**: Missing closing tags

```markdown
<details>
  <summary>Click to see abandoned idea.</summary>

- content here...
- more content...

  <!-- Missing </details> tag -->
```

### 5. Lazy Lines in Block Quotes

**Error**: "Unexpected lazy line in expression in container"
**Location**: Block quotes with incorrect continuation

```markdown
> This section describes the forces at play...
> called out as such. The language in this section...
> proposal aims to resolve.
> {context body}

## Alternatives
```

### 6. Complex Template Variables in Tables

**Error**: "Could not parse expression with acorn"
**Location**: Tables with template variables

```markdown
| Type      | Attribute Key | Attribute Value      |
| --------- | ------------- | -------------------- |
| string    | authority     | `{authorityAddress}` |
| \[]string | msg_urls      | \[]string{msg_urls}  |
```

### 7. Unclosed Braces in Tables

**Error**: "Unexpected end of file in expression, expected a corresponding closing brace"
**Location**: Tables with complex formatting

```markdown
| message | action | `/cosmos.group.v1.Msg/UpdateGroup{Admin|Metadata|Members}` |
```

### 8. Comparison Operators

**Error**: "Unexpected character `=` before name"
**Location**: Lines with comparison operators

```markdown
(namely with a completion time <= current time and completion height <= current
```

### 9. Version Markers

**Error**: "Unexpected character `=` before name"
**Location**: Version markers in headers

```markdown
**<= v0.45**:
```

### 10. Stray Closing Tags

**Error**: "Unexpected closing slash `/` in tag"
**Location**: Orphaned closing tags

```markdown
</Info>
```

Without proper opening tag context.

## Test Input File

```markdown
---
title: Test Document
---

# Test Migration Errors

## Template Variables

### Positive

{positive consequences}

### Negative

{negative consequences}

### Neutral

{neutral consequences}

## Special Characters

The node \`<->\` sidecar connectivity is important.
We need to handle `<=` and `>=` operators.

## Version Markers

**<= v0.45**:
Run this command

**>= v0.46**:
Run that command

## JSX Comments

{/\* This is a malformed comment
that spans multiple lines
and causes issues \*/}

{/\* //nolint:all \*/}

## HTML Tags

<details>
  <summary>Click to expand</summary>

Some content here without closing tag

## Tables with Templates

| Type      | Attribute Key | Attribute Value                         |
| --------- | ------------- | --------------------------------------- | -------- | --------- |
| string    | authority     | `{authorityAddress}`                    |
| \[]string | msg_urls      | \[]string{msg_urls}                     |
| message   | action        | `/cosmos.group.v1.Msg/UpdateGroup{Admin | Metadata | Members}` |

## Block Quotes

> This is a block quote that continues
> across multiple lines and then has
> {context body}

## Stray Tags

Some content here

</Info>

More content without opening tag.

## Comparison in Text

The value must be <= current time and height <= current block.
```

## Expected Output

All these cases should be properly handled by the migration script:

- Template variables wrapped in backticks: `` `{placeholder}` ``
- Special characters in backticks: `` `<->` ``
- JSX comments converted properly: `{/* comment */}`
- HTML tags closed properly
- Comparison operators wrapped: `` `<=` ``
- Version markers handled: `v0.45 and earlier:`
- Tables preserved with proper escaping
