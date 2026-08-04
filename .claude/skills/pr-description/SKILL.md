---
name: pr-description
description: Use when writing or revising a pull request description for this docs repo. Produces a short description a reviewer will actually read, and points them at the riskiest part of the change. Not for writing commit messages.
---

# Writing a PR description

A reviewer reads this to answer two questions: what changed, and where should I look hardest. Answer those and stop.

Target one screen, roughly 15 to 25 lines. If it is longer, you are narrating instead of summarising.

## Shape

```markdown
## Summary

One or two sentences. What this changes and why.

## Changes

- Grouped by outcome, not by file. Three to six bullets.
- Numbers where they carry information: "160 links corrected", not "many links".

## Review focus

The one or two things most likely to be wrong, and why. Name files.

## Verification

What was run, one line.
```

Drop any section with nothing real in it. A PR that only bumps a version does not need a review-focus section.

## Rules

**Group by outcome.** "Corrected 160 upstream links" beats fifteen bullets naming pages. The diff already lists files.

**Numbers, not adjectives.** "9 factual corrections" tells a reviewer how much attention to bring. "Various fixes" tells them nothing.

**Say what is risky.** If part of the change rests on a method rather than on individual verification, say so in one sentence. A reviewer who discovers that themselves trusts the rest less.

**Detail belongs in the work log.** Per `work-log/CLAUDE.md` every branch has a file there. Put the reasoning, the rejected options and the measurements in it, and let the PR link to it. Do not duplicate.

**No process narration.** How the work was sequenced, which attempts failed, which tools were used: none of that belongs here unless a reviewer needs it to review. "The first version of the script had a bug, now fixed" is noise. "The script refuses anchored rewrites spanning more than one minor version, because mapping is unreliable beyond that" is signal.

**House style applies.** Follow `docs-house-style`: no em dashes, no first person, active voice.

## Anti-patterns

| Don't | Do |
| ----- | -- |
| A section per file changed | One bullet per outcome |
| Restating the diff | Saying what the diff means |
| Explaining every judgment call | Naming the one or two a reviewer should check |
| "Notes for reviewers" running 20 lines | Two sentences under Review focus |
| Burying the risky part at the bottom | Leading Review focus with it |

## Before posting

Reread it as someone who has not seen the work. Cut every sentence that does not change what they would do next.
