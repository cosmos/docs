---
name: review-generated-prose
description: Use after regenerating the SDK API reference, as the last step before a freeze, to read the generated pages for grammar, spelling, house style, and whether they make sense to a reader. Also use when a generated page reads badly and it is unclear whether the fix belongs in the generator or upstream.
---

# Reviewing generated prose

The checks around the API reference prove that what a page tells a reader to send is accepted by a chain. Nothing in them reads the page as English. A field can carry a correct type, a correct encoding note, a working example, and a description that is a sentence fragment, a typo, or advice that contradicts the page above it.

This is the last step of a regeneration, after `npm run release-check` passes and before the freeze.

## The rule that shapes everything here

Never edit a generated page.

`sdk/<version>/api-reference/grpc/*.mdx` and `rest/openapi.yaml` are overwritten wholesale on the next run. An edit to one is not a fix, it is a change that disappears silently at the next regeneration and takes its reviewer's attention with it.

So every finding resolves to one of three places, and deciding which is the substance of this review:

| The problem is in | Fix it in | How you can tell |
| --- | --- | --- |
| Wording the generator supplies: headings, table captions, encoding notes, the transaction envelope prose | `scripts/api-reference/lib/render.js` | The same phrasing appears on many pages, identically |
| A field or method description | Upstream, as an issue or PR against `cosmos/cosmos-sdk` proto comments | The text appears once, and reads like a developer's comment |
| One of the three hand-written pages | The page itself, which is safe to edit | `api-reference/index.mdx`, `grpc/index.mdx`, `transactions.mdx` |

A description that is wrong upstream stays wrong until upstream fixes it. Record it, raise it, and do not paper over it locally. That is a real limit of a generated reference and it is better stated than hidden.

## What to read

Read the generated pages for a version, and sample rather than exhaustively grinding: the generator makes the same mistake on every page, so a defect is almost always a class. Three or four module pages of different shapes will surface nearly everything, and a pattern seen twice is a pattern.

Prioritise the pages a reader actually lands on first: `bank`, `staking`, `gov`, `auth`, and whichever module changed most in this release.

## What to look for

**Grammar and spelling**, in the generator's own wording first. Upstream comment text is its own problem, but a typo the generator introduces is ours and appears everywhere.

**House style**, from the root `CLAUDE.md`: no bold or italic in documentation content, no em-dashes, internal links as absolute Mintlify paths without `.mdx`. The generator should never emit any of these, so one occurrence is a template defect.

**Whether it makes sense.** The question to hold is: could a competent reader who has not used this API before act on this page without guessing? Specifically:

- Does a field description say what to put in the field, or only restate the field's name?
- Does the page state the form of every value it asks for, or does it leave a placeholder a reader cannot fill? The runners already fail on this, so anything here is something they could not see.
- Do the encoding notes agree with the transaction example directly below them?
- Does a sentence assume knowledge the page never gives, or that lives only in `grpc/index.mdx`?
- Is a heading or a note ambiguous between two methods with similar names?

**Truncation and mangling.** Proto comments arrive with line breaks, code fences, and occasional markup. Look for a description cut mid-sentence, a stray backtick, a table cell that broke its row, a link that renders as literal text.

## How to report

Group findings by where they must be fixed, using the table above, because that is the order someone will act on them. For each: the page and anchor, the text as it stands, and what it should say.

Say plainly when a class of problem is upstream and large. "Sixteen field descriptions across `staking` restate the field name and say nothing else" is a useful finding about upstream comment quality. Listing all sixteen is not.

If nothing needs fixing, say so in a sentence. A prose review that manufactures findings to look thorough costs more attention than it saves.

## Verifying a generator fix

After changing `lib/render.js`, regenerate and confirm the fix landed everywhere the pattern appeared, not only on the page where you noticed it:

```bash
cd scripts/api-reference && GITHUB_TOKEN=$(gh auth token) npm run sync -- --version next
npm test
```

The 77 unit tests assert generator behaviour by class, so add a case there for anything you fix. A wording defect that shipped once will ship again.
