# Professional Git Workflow: Fixing SDK Links in `docs/sdk/next`

**Task:** Fix broken Docusaurus syntax and relative links in `./docs/sdk/next/build/architecture` ADR files.

---

## 📋 Quick Reference Checklist

- [ ] Step 1: Sync local branch
- [ ] Step 2: Create backup/feature branch
- [ ] Step 3: Assess current state
- [ ] Step 4: Examine sample files
- [ ] Step 5: Plan approach (communicate with team)
- [ ] Step 6: Execute the fix
- [ ] Step 7: Modify/check link-fixing script
- [ ] Step 8: Run link fixes
- [ ] Step 9: Test changes locally
- [ ] Step 10: Review your work
- [ ] Step 11: Commit with clear message
- [ ] Step 12: Push and create PR
- [ ] Step 13: Respond to review feedback

---

## Step 1: Sync Your Local Branch ✅

```bash
# Make sure you're on the correct branch
git checkout neil/adr-fixes

# Fetch all remote changes
git fetch origin

# Pull changes from your base branch
git pull origin neil/adr-fixes
```

**Why:** Always start with a clean, up-to-date workspace to avoid merge conflicts later.

---

## Step 2: Create a Safety Checkpoint 🔖

```bash
# Create a backup branch (just in case)
git branch neil/adr-fixes-backup

# Or create a new feature branch for this specific work
git checkout -b neil/fix-next-adr-links
```

**Why:** Professional developers always have an escape hatch. If something goes wrong, you can easily return to a known good state.

---

## Step 3: Assess the Current State 🔍

```bash
# Look at the structure
ls -la docs/sdk/next/build/architecture/

# Check git status to see what's already changed
git status

# Compare next with a corrected version
ls docs/sdk/v0.47/build/architecture/ | head -20
ls docs/sdk/next/build/architecture/ | head -20
```

**Why:** Before making changes, understand what you're working with. Compare the broken files with the fixed versions.

---

## Step 4: Examine Sample Files 📄

```bash
# Look at a broken file in next
cat docs/sdk/next/build/architecture/adr-033-protobuf-inter-module-comm.mdx | head -50

# Compare with the fixed version from v0.47
cat docs/sdk/v0.47/build/architecture/adr-033-protobuf-inter-module-comm.mdx | head -50

# Look for differences
diff docs/sdk/next/build/architecture/adr-033-protobuf-inter-module-comm.mdx \
     docs/sdk/v0.47/build/architecture/adr-033-protobuf-inter-module-comm.mdx
```

**Why:** Understand what "broken" means - what syntax issues exist? This informs your fix strategy.

---

## Step 5: Plan Your Approach 📝

**Option A: Copy Fixed Files (Quick but Creates Version Links)**
- Copy all ADR files from `v0.47` to `next`
- Links will point to v0.47 paths
- Fast, but navigation might confuse users

**Option B: Fix in Place (More Work but Cleaner)**
- Fix syntax issues in `next` files
- Update script to also fix `next` directory
- Run link-fixing script specifically on `next`
- More work, but links stay within `next` version

**Professional Decision:** Discuss with your colleague first! Send a message like:

```
"Hey! Looking at the next/architecture ADRs. I see two approaches:

1. Copy corrected files from v0.47 → quick but links go to v0.47
2. Fix syntax + run link script on next → more work but cleaner

Since you mentioned it's okay if links navigate to other versions temporarily,
I'm thinking Option 1 for now. We can do a proper fix later. Thoughts?"
```

**Why:** Professional devs communicate before making architectural decisions.

---

## Step 6: Execute the Fix (Assuming Option A Chosen) 🛠️

```bash
# Create a test copy first
mkdir -p /tmp/test-fix
cp -r docs/sdk/next/build/architecture /tmp/test-fix/

# Copy corrected files from v0.47 to next
cp docs/sdk/v0.47/build/architecture/*.mdx docs/sdk/next/build/architecture/

# Check what changed
git status
git diff docs/sdk/next/build/architecture/ | head -100
```

**Why:** Test first, then apply. Check the diff to ensure nothing unexpected happened.

---

## Step 7: Modify the Link-Fixing Script 🔧

The script currently scans all `docs/sdk/**/*.mdx` files, so it should already include `next`.

**Verify the script will process next:**

```bash
# Run in dry-run mode to see if it finds next files
node scripts/fix-sdk-relative-links.js --dry-run | grep "docs/sdk/next"
```

**Why:** Verify before modifying. The script might already handle `next` since it scans all subdirectories.

---

## Step 8: Run Link Fixes (If Needed) 🔗

```bash
# First, dry-run to preview
node scripts/fix-sdk-relative-links.js --dry-run | grep -A 5 "docs/sdk/next"

# If looks good, run it for real
node scripts/fix-sdk-relative-links.js

# Check the changes
git diff docs/sdk/next/build/architecture/
```

**Why:** Always dry-run first. Review changes before committing.

---

## Step 9: Test Your Changes ✅

```bash
# Start the dev server
npx mint dev

# Navigate to: localhost:3000/docs/sdk/next/build/architecture/
# Click through several ADR links
# Verify:
# - Files load without errors
# - Links work (even if they go to other versions)
# - No broken syntax
```

**Why:** Manual testing catches issues automated tools miss. Actually use what you built.

---

## Step 10: Review Your Work 🔍

```bash
# See all changed files
git status

# Review all changes
git diff

# Check specific stats
git diff --stat

# Look at a specific file change
git diff docs/sdk/next/build/architecture/adr-033-protobuf-inter-module-comm.mdx
```

**Why:** Professional code reviews start with self-review. Catch your own mistakes first.

---

## Step 11: Commit with Clear Message 💾

```bash
# Stage the changes
git add docs/sdk/next/build/architecture/

# Write a descriptive commit message
git commit -m "fix(docs): Fix ADR links and syntax in sdk/next/architecture

- Copied corrected ADR files from v0.47 to fix Docusaurus syntax issues
- Ran link-fixing script to update relative links to full paths
- Links may reference v0.47 paths, to be cleaned up in future iteration
- All files now render without syntax errors

Fixes syntax issues mentioned in team sync.
Related to ongoing ADR formatting cleanup."
```

**Why:** Good commit messages explain WHAT changed and WHY. Future you (and teammates) will thank you.

---

## Step 12: Push and Create PR 🚀

```bash
# Push to your branch
git push origin neil/fix-next-adr-links

# Or if you worked directly on neil/adr-fixes:
git push origin neil/adr-fixes
```

Then create a Pull Request with:

**Title:** `fix(docs): Fix ADR links and syntax in sdk/next/architecture`

**Description:**
```markdown
## Problem
The `docs/sdk/next/build/architecture` ADR files had syntax issues from Docusaurus conversion
and broken relative links.

## Solution
- Copied corrected ADR files from `v0.47` to fix syntax
- Ran link-fixing script to update relative links to full paths
- Verified all pages render without errors

## Notes
- Links may reference `v0.47` paths temporarily
- Content is identical across versions
- Future iteration can update to version-specific links if needed

## Testing
- [x] Dev server runs without errors
- [x] ADR pages load correctly
- [x] Links are functional (even if cross-version)
- [x] No broken syntax
```

**Why:** PRs are documentation. Help reviewers understand your changes quickly.

---

## Step 13: Respond to Review Feedback 💬

When your colleague reviews:
- Address all comments
- Ask questions if something's unclear
- Push new commits (don't force-push unless asked)
- Mark conversations as resolved

**Why:** Code review is collaboration, not criticism. It makes everyone's code better.

---

## 🎓 Professional Best Practices

1. **Safety First**: Always branch, always backup
2. **Communication**: Check with team before big decisions
3. **Test Before Apply**: Dry-run, diff, review
4. **Clear Documentation**: Good commits and PR descriptions
5. **Incremental Work**: Fix what's broken now, perfect it later
6. **Validation**: Actually test what you built

---

## 📚 Common Pitfalls to Avoid

❌ **Don't:**
- Commit directly to `main` or shared branches without PR
- Skip testing "small" changes
- Write vague commit messages like "fix stuff"
- Force-push unless you know what you're doing
- Assume your changes work - always verify

✅ **Do:**
- Communicate with your team
- Test locally before pushing
- Write clear, descriptive commits
- Ask questions when unsure
- Break big changes into smaller PRs

---

## 🤔 Pre-Commit Checklist

1. ✅ Did I test this locally?
2. ✅ Does the dev server run without errors?
3. ✅ Did I check `git diff` for unexpected changes?
4. ✅ Is my commit message clear?
5. ✅ Would a new developer understand what I did?
6. ✅ Did I update/run any related scripts?
7. ✅ Are there any TODOs I should document?

---

## 🆘 Emergency Commands (If Something Goes Wrong)

```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard all local changes (CAREFUL!)
git reset --hard HEAD

# Go back to your backup branch
git checkout neil/adr-fixes-backup

# See what you did recently
git reflog

# Unstage files
git reset HEAD <file>
```

---

## 📞 Need Help?

- Ask your colleague in Slack/Discord
- Check git status: `git status`
- Check git log: `git log --oneline -10`
- Don't panic - git saves everything!
