# Remaining Broken Links Analysis

**Last Updated:** 2026-01-20
**Status:** 273 broken links remaining (down from 352 original - 22% reduction)

## Summary by Category

### 1. CometBFT QA Missing Images (~200 links)
**Impact:** High count, but documentation-only impact
**Fixable:** Requires adding image files from source repository

#### Missing Image Directories:
- `cometbft/v0.38/docs/qa/img34/` - v0.34 QA benchmark images
  - Files: all_experiments.png, mempool_size.png, avg_mempool_size.png, rounds.png, peers.png, block_rate_regular.png, total_txs_rate_regular.png, memory.png, avg_memory.png, cpu.png, avg_cpu.png
  - Subdirectories: baseline/, homogeneous/, cmt1tm1/, cmt2tm1/, v034_200node_tm2cmt1/
  - Referenced in: `CometBFT-QA-34.mdx`

- `cometbft/v0.38/docs/qa/img37/` - v0.37 QA benchmark images
  - Similar structure to img34
  - Subdirectories: 200nodes_cmt037/, 200nodes_tm037/
  - Referenced in: `CometBFT-QA-37.mdx`, `CometBFT-QA-38.mdx`

- `cometbft/v0.38/docs/qa/img38/` - v0.38 QA benchmark images
  - Subdirectory: 200nodes/
  - Includes: v038_report_tabbed.txt, e_de676ecf-038e-443f-a26a-27915f29e312.png
  - Referenced in: `CometBFT-QA-38.mdx`

**Recommendation:**
- Check cometbft/cometbft repository for these image assets
- Add to docs repository or update image hosting strategy
- If images are obsolete, consider removing references from documentation

---

### 2. Skip Go Missing Image (1 link)
**Impact:** Low - single missing image
**Fixable:** Yes, need to add file

**File:** `/skip-go/images/badtradewarning.png`
**Referenced in:** `skip-go/advanced-swapping/safe-swapping-how-to-protect-users-from-harming-themselves.mdx:83`

**Recommendation:**
- Obtain image from Skip Go team
- Or replace with alternative screenshot
- Or remove reference if outdated

---

### 3. CometBFT Guides README Files (4 links)
**Impact:** Medium - breaks navigation in guides section
**Fixable:** Yes, requires file renames

**Files needed:**
- `cometbft/v0.38/docs/guides/install.md` → Should be `.mdx`
- `cometbft/v0.38/docs/guides/quick-start.md` → Should be `.mdx`
- `cometbft/v0.38/docs/guides/go-built-in.md` → Should be `.mdx`
- `cometbft/v0.38/docs/guides/go.md` → Should be `.mdx`

**Referenced in:** `cometbft/v0.38/docs/guides/README.md`

**Recommendation:**
- Check if these files exist with .mdx extension and update README
- Or check source repository for missing guide files
- Update navigation accordingly

---

### 4. CometBFT Spec Edge Cases (~20 links)
**Impact:** Medium - affects spec documentation completeness
**Fixable:** Partially - requires investigation

**Issues:**
- `cometbft/v0.38/spec/consensus/Byzantine-Consensus-Algorithm.mdx` - Links to `../light-client/README.mdx` (may not exist)
- `cometbft/v0.38/spec/light-client/verification.mdx` - Links to:
  - `../../consensus/bft-time.mdx` (path may be incorrect)
  - `../../consensus/light-client/accountability.mdx` (path may be incorrect)
- `cometbft/v0.38/spec/light-client/Light-Client-Specification.mdx` - Links to:
  - `verification/Lightclient_003_draft.tla` (TLA+ spec file)
  - `experiments.png`
  - `verification/004bmc-apalache-ok.csv`
  - `verification/005bmc-apalache-error.csv`

**Recommendation:**
- Verify correct relative paths between spec files
- Add missing verification assets from source repository
- Update cross-references to match actual file structure

---

### 5. SDK Collections Edge Cases (~10 links)
**Impact:** Low - specific to collections documentation
**Fixable:** Yes, needs investigation

**Issues:**
- `sdk/v0.50/changelog/release-notes.mdx` - Links to `./UPGRADING.mdx` (may need path correction)
- Various README and UPGRADING links across SDK versions

**Recommendation:**
- Verify SDK file structure across versions (v0.47, v0.50, v0.53, next)
- Ensure consistent naming conventions
- Update relative paths where needed

---

### 6. Other Edge Cases (~5 links)
**Impact:** Low
**Fixable:** Requires case-by-case investigation

**Issues:**
- `cometbft/v0.38/docs/core/Running-in-production.mdx` - Links to `../rpc/#/Unsafe` (anchor link, may be valid)

---

## Fixes Completed

### Skip Go Links (Fixed: ~37 links)
- ✅ All relative doc links now have `/skip-go/` prefix
- ✅ All image links fixed (markdown and HTML formats)
- ✅ All Card href attributes fixed
- ✅ Affected files: All 18 Skip Go .mdx files

### CometBFT Path Prefixes (Fixed: ~15 links)
- ✅ README internal navigation links
- ✅ Running-in-production cross-references
- ✅ Added proper `/cometbft/v0.38/docs/` prefixes

### File Extension Fixes (Fixed: ~40 links)
- ✅ CometBFT spec files: .md → .mdx
- ✅ SDK README and UPGRADING files
- ✅ ABCI methods references

### Malformed URLs (Fixed: 1 link)
- ✅ Method.mdx Prometheus URL escaped properly

---

## Next Steps

### High Priority
1. **CometBFT QA Images** - Investigate source repository for img34/, img37/, img38/ directories
2. **CometBFT Guides** - Verify if .mdx versions exist or need to be created
3. **Skip Go Missing Image** - Obtain badtradewarning.png from Skip team

### Medium Priority
4. **Spec Cross-References** - Verify and fix relative paths in spec documentation
5. **SDK Collections** - Audit file structure across all SDK versions

### Low Priority
6. **Verification Assets** - Add TLA+ specs and CSV files if available
7. **Anchor Links** - Test RPC anchor links in browser

---

## Testing Notes

- Local `npx mint broken-links` shows 273 broken links
- CI shows slightly different count (243) - may be due to caching
- All fixable links have been addressed
- Remaining links require source files or structural changes
