# Link Validation Script

This script validates both internal and external links in the Cosmos documentation site.

## Installation

Install dependencies:

```bash
`cd scripts/link-validation
npm install`
```

## Usage

### Option 1: Static File Checker (No Server Required)

This method scans MDX/MD files directly without needing the site to run:

```bash
# Check internal links only (fast, no network required)
npm run check:static

# Check both internal and external links
npm run check:static:external

# Verbose mode (shows all checks)
npm run check:static:verbose
```

**Advantages:**
- ✅ Works even if the site has build errors
- ✅ Fast for internal links (no network requests)
- ✅ Checks files directly from source
- ✅ Can check external links optionally

### Option 2: Live Site Checker (Requires Running Server)

Check links on a running server:

```bash
# Check localhost (requires `npx mint dev` to be running)
npm run check

# Check a production URL
BASE_URL=https://docs.cosmos.network npm run check

# Verbose mode
npm run check:verbose
```

### Integration with Root Package.json

You can also add this to the root `package.json` scripts:

```json
{
  "scripts": {
    "validate-links": "cd scripts/link-validation && npm run check"
  }
}
```

Then run from the root:

```bash
npm run validate-links
```

### Saving Output to a File

To save the broken links report to a file for easier review:

```bash
# From project root - save to link-validation-report.txt
npm run validate-links 2>&1 | tee link-validation-report.txt

# From scripts/link-validation directory - save to report.txt
npm run check:static 2>&1 | tee report.txt

# Save only broken links (filter out success messages)
npm run validate-links 2>&1 | grep "❌\|BROKEN\|Summary" | tee broken-links-only.txt

# Save with external links included
npm run validate-links:external 2>&1 | tee link-validation-report-full.txt
```

**Note:** The `2>&1` redirects both stdout and stderr to the file, and `tee` displays the output on screen while also saving it to the file.

## How It Works

### Static File Checker (`check-links-static.js`)

1. Scans all `.mdx` and `.md` files in the repository
2. Extracts links from:
   - Markdown links: `[text](url)`
   - HTML anchor tags: `<a href="url">`
   - Card components: `<Card href="url">`
3. For internal links: Checks if the target file exists
4. For external links (optional): Makes HTTP requests to verify accessibility
5. Reports broken links with file path and line number
6. Exits with code 1 if broken links are found, 0 otherwise

### Live Site Checker (`check-links.js`)

1. Uses `broken-link-checker` to crawl the site starting from the base URL
2. Checks both internal and external links
3. Reports broken links with:
   - The broken URL
   - The page where the broken link was found
   - HTTP status code (if available)
   - Reason for failure
4. Exits with code 1 if broken links are found, 0 otherwise

## Configuration

The script can be configured via environment variables:

- `BASE_URL` or `NEXT_PUBLIC_BASE_URL`: The base URL to check (default: `http://localhost:3000`)

## Notes

### Static File Checker
- ✅ **No server required** - Works even if the site has build errors
- ✅ Fast for internal links - No network requests needed
- ⚠️ External link checking requires network access and may take longer
- ⚠️ Internal link checking uses file system paths, so relative paths must be correct

### Live Site Checker
- ⚠️ Requires the site to be running (`npx mint dev` or production URL)
- ✅ More accurate for checking rendered pages
- ⚠️ External link checking may take longer and depends on network connectivity
- The script respects `robots.txt` files
- Rate limiting is applied to avoid overwhelming servers
