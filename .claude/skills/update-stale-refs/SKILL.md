---
name: update-stale-refs
description: Use when adjudicating flagged GitHub links from scripts/versioning/check-github-refs.js, or when a docs page links to upstream code that has since changed. Decides whether a page's prose is still accurate after upstream moved, and proposes the smallest edit that makes it correct. Not for bumping refs the checker already auto-fixed.
---

# Adjudicating stale upstream references

`scripts/versioning/check-github-refs.js` bumps the links it can prove are safe. It flags the rest. This skill decides what to do with a flag.

A flag is not a broken link to repair. It is a signal that a page may describe code that no longer exists or no longer behaves as written. The link is the symptom. Read for the defect.

## Correct the prose when it is wrong. Change nothing else.

The target is a page that is accurate against the code at the shipping ref. Not a page that explains how it got there.

If a sentence is false, change it. Change the minimum needed to make it true, and stop. Do not introduce information the page did not already carry, do not expand a correction into an explanation, and do not add examples or caveats that were not there.

Never write version-comparative prose. No "as of v0.55", "previously", "this changed in", "no longer", "has been removed", "in older versions". A reader arrives at this page long after the release and needs to know how the system works, not what it used to do. `docs-house-style` requires timeless writing; this is that rule applied to a ref sweep. Version history belongs in the changelog and the upgrade guide, which already have it.

So, in order of preference:

1. Sentence still true, link drifted: fix the link. Touch no prose.
2. Sentence false because the thing it describes is gone: delete the sentence, and any list item, heading, table row, diagram label or table-of-contents entry that only existed to support it.
3. Sentence false because the behaviour differs: change the words that are wrong. Keep the sentence's shape, length and level of detail.

Write the corrected page as though the code had always been this way. The reference fix for this skill renamed a heading, deleted a bullet and a dead link, and edited two strings; net negative on prose. That is the shape to aim for.

## Scope: decide whether a link should be touched at all

Work this out before adjudicating anything. Getting it wrong here produces confident, wrong edits.

**Architecture decision records and RFCs are liveness-only.** For any page under `reference/architecture/` or `reference/rfc/`, the only question is whether the link 404s. If it resolves, leave it exactly as it is: do not bump the ref, do not adjust the line range, do not touch the prose. An ADR records a decision as of a moment, so it legitimately cites code that has since changed or been deleted. If it does 404, propose the most recent ref at which the path still exists, and an older release branch or tag is a perfectly good answer.

**Version-specific pages keep their own version's refs.** Anything under `<product>/<ver>/upgrade/` or `<product>/<ver>/changelog/` is about one release. A v0.54 upgrade guide citing the v0.54 changelog is correct, and bumping it to the newest branch makes the page contradict itself. This was a real bug: "breaking changes in v0.54.0, see the Changelog" ended up pointing at v0.55's changelog, and "the v0.53.x to v0.54.x upgrade reference" at v0.55's `UPGRADING.md`. More generally, if a sentence names a version, its link must match the version the sentence names, not the newest one.

**A cross-product link takes the dependency's version, not the host page's.** A CometBFT URL on an SDK page does not go to `release/v0.55.x`, which does not exist in the CometBFT repo. Read the host product's `go.mod` at its shipping ref to find which version it actually depends on, and use that. SDK v0.55 pins `cometbft v0.40.0`, so CometBFT links on SDK pages belong on `v0.40.x`.

**Never run a global find-and-replace across the changed set.** Every ref decision is per-link and depends on the surrounding sentence. A blanket replace produced both of the version-mismatch bugs above, once via tooling and once by hand.

## Verdicts

Every flag resolves to exactly one. `no-change` is a real answer and often the right one.

| Verdict | When | Action |
| ------- | ---- | ------ |
| `no-change` | Upstream changed in a way the prose does not depend on | Bump the ref or relocate the anchor. Touch nothing else. |
| `minimal-edit` | The page states something false | Smallest edit that makes it true. Delete rather than explain. No new information. |
| `needs-decision` | The correct fix depends on intent only a maintainer knows | Do not edit. Write up the options with evidence. |

A `no-change` verdict must mean you read the prose and confirmed it still holds, not that you only looked at the link. If you could not confirm it, say so rather than defaulting to `no-change`.

Never invent a replacement target. If a linked file was deleted with no successor, say so rather than pointing at the closest-looking file. Basename matching is not rename detection; `store.go` has 23 candidates in the SDK tree.

## Procedure

For each flagged link:

### 1. Read the upstream change

The flag carries the diff hunk in `evidence`. If it is absent or truncated, fetch the file at both refs before deciding. Do not infer from the path alone.

### 2. Read the entire page

Not the flagged line, not the section. The whole file.

This is not optional, and it is the step most likely to be skipped. A concept usually appears in more than one place on a page. On `sdk/latest/learn/concepts/store.mdx`, store tracing appeared three times: in its own section, in the page's table-of-contents list, and inside an ASCII diagram of the storage stack. Fixing only the flagged section would have left two stale mentions and an in-page anchor pointing at a heading that no longer existed.

Before proposing an edit, search the page for every mention of the affected concept, including:

- table-of-contents or "on this page" lists
- headings, and any anchor that targets them
- code blocks, ASCII diagrams, and tables
- "Next steps" and cross-reference links

### 3. Decide whether the prose is actually wrong

Upstream refactors constantly. A function moving between files does not make a conceptual page inaccurate. Ask what the page claims, and whether that claim is still true. Only a false claim justifies an edit.

### 4. Propose the minimal edit

Follow `docs-house-style` for all prose and formatting rules. This skill does not restate them. Beyond that:

- If a heading changes, update every anchor that targets it. `npx mint broken-links` validates page paths only. It does not check anchors, so a stale anchor ships silently.
- Anchor slugs: `.` becomes `-`, `/` is kept and percent-encoded as `%2F`, and smart punctuation rewrites heading text before slugging. See the anchor rules in the root `CLAUDE.md`.
- Internal links are absolute Mintlify paths with no extension, for example `/sdk/latest/learn/concepts/store`.
- Do not add a callout to announce the change.

### 5. Check which directory to edit

- Before a freeze, edit `next/`. The promotion copies it to `latest/`, so one pass covers both.
- After a freeze, edit `latest/`, then run `node scripts/sync-latest-to-next.js <file>`. It preserves the destination's front matter, so `noindex` and `canonical` on the `next/` copy survive.
- Never edit an archived version directory such as `v0.54/` or `v0.38/`. Those are frozen snapshots and their links are correct for the version they document.

## Output

Propose everything as a batch. Do not apply edits until a maintainer approves the batch.

Per flag:

```
<doc>:<line>  [verdict]
  upstream:  what changed, one or two lines
  claim:     what the page currently asserts
  accurate:  yes | no
  edit:      the diff, or "none"
  also:      other places on the page touched by the same concept, or "none"
```

Then a summary: counts per verdict, and the `needs-decision` items with their options.

After approval, apply the edits, sync if `latest/` was edited, then verify with `npx mint broken-links` plus a manual check of any anchor whose heading changed.

## Review pass, mandatory before handing back

Any sweep that touches more than a handful of pages gets an independent review pass. Do not skip it and do not review your own work in the same context that produced it.

Build the list of every changed page from `git status --porcelain`, split it into batches, and dispatch one review agent per batch on a small model. Each agent runs `git diff -- <page>` for its pages and reports problems only. Reviewers must not edit anything.

This exists because a bulk sweep fails in ways the author cannot see. Real defects that only a review pass caught:

- A find-and-replace bumped a v0.54 upgrade guide to v0.55, leaving "breaking changes in v0.54.0, see the Changelog" pointing at the v0.55 changelog, and "the v0.53.x to v0.54.x upgrade reference" pointing at v0.55's `UPGRADING.md`.
- An automated line-mapper rewrote an anchor to a line that existed but held unrelated code, so the link still returned 200.

Give reviewers these flags:

1. Version mismatch. If the prose names a version, the link must match that version, not the newest one.
2. Display text carrying a line number that disagrees with the URL's `#L` anchor.
3. A changed line that now contradicts something else on the same page.
4. Prose that no longer parses, or a count that no longer matches the list beneath it.
5. Version-comparative phrasing introduced.
6. An em dash introduced.
7. Mechanical damage: a stray backtick or punctuation inside a URL, a half-replaced string, a broken markdown link, duplicated words.

And tell them explicitly what is deliberate, or they will report it:

- An older ref on an ADR or RFC page, which cites code as it stood at decision time.
- A dead URL shown as plain text or inline code rather than a link.
- A version-specific page under `/upgrade/` or `/changelog/` keeping its own version's refs.

Expect false positives on that last group; an unlinked dead URL looks exactly like corruption. Triage every flag against the page before acting, and treat a reviewer's report as a list of questions rather than a list of defects.

## Recording the work

Log to the branch's file in `work-log/` per `work-log/CLAUDE.md`: what changed and why, not how. Group a page's edits into one entry. A flag that resolved to `no-change` or `needs-decision` is worth a line too, so the next person does not re-investigate it.
