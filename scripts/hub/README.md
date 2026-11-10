# Hub docs on chain time

Scripts that keep the Cosmos Hub docs (`hub/`) on the gaia version mainnet runs. The Hub upgrades by governance at a block height, so the docs switch when the chain does, not when someone remembers to merge.

| File | What it does |
| --- | --- |
| `release-check.py` | Checks every `gaiad` command in `hub/<version>/` against a gaiad binary, in code blocks and in inline code: each subcommand has to exist and each flag has to be accepted. Also lists pages whose HubVerified stamp names another gaia version. |
| `release-check-allow.json` | Known exceptions for the release check, such as a page that names a removed command on purpose. |
| `release-reader.py` | Brings `hub/next/` up to a new release: replaces the release number, then has Claude Code correct the pages against the gaia release notes, changelog and code diff, and writes a summary that lists each change beside its source. |
| `detect-upgrade.py` | Reads upgrade proposals, the current plan and applied heights from the endpoints in `endpoints.json`. An answer counts only when two current endpoints from different operators agree. |
| `upgrade-bot.py` | The scheduled bot run by `.github/workflows/hub-upgrade-docs.yml` every 10 minutes. |
| `bot-config.json` | Mode (`dry-run` or `live`), alert timing, branch names. |
| `endpoints.json` | Public REST endpoints for mainnet and testnet, one per operator. |
| `test_hub_scripts.py` | Unit tests, no chain or binary needed. |

## Run them by hand

```bash
python3 scripts/hub/release-check.py --gaiad /path/to/gaiad --version next
python3 scripts/hub/detect-upgrade.py --network mainnet
python3 scripts/hub/upgrade-bot.py --plan
python3 scripts/hub/release-reader.py --from v29.0.1 --to v29.1.0 --summary /tmp/summary.md
python3 -m unittest discover -s scripts/hub -p 'test_*.py'
```

`--plan` reads the chain and prints what the bot would do. It changes nothing. `release-reader.py` edits `hub/next/` in the working tree and commits nothing; it needs the `claude` CLI signed in, or `--no-agent` for the number swap alone.

## What the bot does

When a software upgrade proposal for a release newer than the docs reaches its voting period:

1. It opens a content PR, `hub-docs/content-<release>`, written by `release-reader.py`. This is the PR to read: its description lists what changed in gaia and every page edit beside the release note, changelog line or file that caused it, plus what the reader could not settle from its sources. The release check runs on it too. The publish PR waits until this one is merged or closed.
1. It opens a publish PR, `hub-docs/<release>`. The PR is the standard freeze from `scripts/versioning` run on current `main`: `hub/next/` becomes `hub/latest/` and the outgoing `hub/latest/` is archived under its version. When `main` moves, the bot regenerates the PR, so it always publishes what `hub/next/` holds. Fix content in `hub/next/` with ordinary PRs, never by pushing to the bot's branch.
2. It runs `release-check.py` on the PR against the linux binary named in the proposal (checksum verified) and posts the result as the `hub-release-check` status and a PR comment.
3. Once the proposal passes, it opens a notice PR, `hub-docs/notice-<release>`, which fills the upcoming upgrade box (`snippets/hub-upgrade-notice.mdx`). The start, versions and upgrade pages already import the box, which renders nothing while the snippet is empty. The publish PR empties it again.
4. A Hub code owner reviews and approves the three PRs during the vote. The content PR is the one with words to check. The other two are mechanical.
5. Within an hour of the estimated upgrade time it polls every 30 seconds. When two endpoints report the upgrade applied, it squash-merges the publish PR. Mintlify deploys, and the bot checks that the site shows the new version.

For a patch release of the version the docs show (operators swap the binary, no proposal), it opens `hub-docs/<patch>`, which replaces the version string in `hub/latest/` and `hub/next/` (not HubVerified stamps or the upgrade history page), and merges it once approved and checked.

Halt-height upgrades with private binaries have no proposal and no public release, so the bot never sees them. Handle those by hand.

## The release reader

The release check proves commands still run. It cannot tell that a sentence is out of date, such as a workaround for a bug the release fixed. `release-reader.py` covers that, once per upgrade:

1. It replaces the outgoing release number in `hub/next/`, leaving HubVerified stamps and the upgrade history page.
2. It collects sources from `cosmos/gaia`: release notes, the changelog sections between the two tags, the upgrading guide, the commit list, the code diff for files an operator can see the effect of, the tag's commit and checksums, and the on-chain proposal.
3. It runs Claude Code with file tools only (read, edit, search), no shell and no network, and without the bot's GitHub or PagerDuty credentials. The sources are treated as data.
4. It undoes any change outside `hub/next/*.mdx`.

Claude signs in with the repository secret `CLAUDE_CODE_OAUTH_TOKEN`, a token from `claude setup-token` that draws on one person's Claude subscription and lasts a year. `ANTHROPIC_API_KEY` works in its place. `reader_token_issued` in `bot-config.json` records when the token was made, and the bot alerts 30 days before it runs out. To renew: run `claude setup-token`, store the result with `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R cosmos/docs`, and update `reader_token_issued`.

If the reader fails (expired token, usage limit, outage), the content PR is still opened with the release number replaced, its title ends in "(release number only)", and an alert fires. Either add the changes by hand, or close that PR so the next run tries again. The reader runs once per release, not on every scheduled run.

The reader's output is a draft by a model. The reviewer's approval is the check on it.

## Release check exceptions

A command the check cannot find is a failure, unless a rule in `release-check-allow.json` covers it. Each rule names a page relative to the version folder (so it still applies after a freeze), text the line must contain, the start of the problem message, and why it is allowed:

```json
{
  "file": "getting-started/what-is-gaia.mdx",
  "contains": "gaiad query provider",
  "problem": "unknown command",
  "why": "The page lists commands that were removed, on purpose."
}
```

Add a rule only for a mention that is meant to fail, such as a removed command. Fix the page for anything else.

## Alerts

| When | Alert |
| --- | --- |
| 24 and 8 hours before the estimated upgrade time, the publish PR is not approved, failing the release check, or conflicting | `Hub docs for <release> are not ready` (also while the content PR is unmerged) |
| The chain applied the upgrade but the PR cannot merge | `Mainnet applied <plan> ... but the Hub docs PR cannot merge` |
| An hour after merging, the site does not show the release | `Hub docs for <release> merged ... but the site does not show it` |
| Fewer than two independent current endpoints agree | `Hub docs bot cannot get two independent chain endpoints to agree` |
| The release reader failed, so the content PR only replaces the release number | `Hub docs for <release>: the release notes were not read ...` |
| The Claude token is within 30 days of its one year life | `The Hub docs bot's Claude token expires in <n> days` |
| `versions.json` does not name a gaia release for the Hub (for example `Latest`) | `Hub docs version in versions.json is ... not a gaia release` |

Alerts go to PagerDuty through the Events API with severity `warning`, so the service's urgency rules keep them low urgency, and the PagerDuty Slack integration posts them. Each alert has a stable key: it stays one incident while the condition holds and resolves itself on the run that sees it clear. The routing key is the repository secret `HUB_DOCS_PAGERDUTY_ROUTING_KEY`. Without it, alerts show as warnings in the workflow run.

## Dry run and going live

`bot-config.json` ships with `"mode": "dry-run"`: the bot opens and updates PRs and checks them, but never merges and never pages. Each alert and each merge it would have made appears in the run summary and as a PR comment. Change the mode to `live` in a PR after one upgrade has gone through cleanly in dry run.
