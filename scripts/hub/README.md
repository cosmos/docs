# Hub docs on chain time

Scripts that keep the Cosmos Hub docs (`hub/`) on the gaia version mainnet runs. The Hub upgrades by governance at a block height, so the docs switch when the chain does, not when someone remembers to merge.

| File | What it does |
| --- | --- |
| `release-check.py` | Checks every `gaiad` command in `hub/<version>/` against a gaiad binary, in code blocks and in inline code: each subcommand has to exist and each flag has to be accepted. Also lists pages whose HubVerified stamp names another gaia version. |
| `release-check-allow.json` | Known exceptions for the release check, such as a page that names a removed command on purpose. |
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
python3 -m unittest discover -s scripts/hub -p 'test_*.py'
```

`--plan` reads the chain and prints what the bot would do. It changes nothing.

## What the bot does

When a software upgrade proposal for a release newer than the docs reaches its voting period:

1. It opens a publish PR, `hub-docs/<release>`. The PR is the standard freeze from `scripts/versioning` run on current `main`: `hub/next/` becomes `hub/latest/` and the outgoing `hub/latest/` is archived under its version. When `main` moves, the bot regenerates the PR, so it always publishes what `hub/next/` holds. Fix content in `hub/next/` with ordinary PRs, never by pushing to the bot's branch.
2. It runs `release-check.py` on the PR against the linux binary named in the proposal (checksum verified) and posts the result as the `hub-release-check` status and a PR comment.
3. Once the proposal passes, it opens a notice PR, `hub-docs/notice-<release>`, which fills the upcoming upgrade box (`snippets/hub-upgrade-notice.mdx`). The start, versions and upgrade pages already import the box, which renders nothing while the snippet is empty. The publish PR empties it again.
4. A Hub code owner reviews and approves both PRs during the vote.
5. Within an hour of the estimated upgrade time it polls every 30 seconds. When two endpoints report the upgrade applied, it squash-merges the publish PR. Mintlify deploys, and the bot checks that the site shows the new version.

For a patch release of the version the docs show (operators swap the binary, no proposal), it opens `hub-docs/<patch>`, which replaces the version string in `hub/latest/` and `hub/next/` (not HubVerified stamps or the upgrade history page), and merges it once approved and checked.

Halt-height upgrades with private binaries have no proposal and no public release, so the bot never sees them. Handle those by hand.

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
| 24 and 8 hours before the estimated upgrade time, the publish PR is not approved, failing the release check, or conflicting | `Hub docs for <release> are not ready` |
| The chain applied the upgrade but the PR cannot merge | `Mainnet applied <plan> ... but the Hub docs PR cannot merge` |
| An hour after merging, the site does not show the release | `Hub docs for <release> merged ... but the site does not show it` |
| Fewer than two independent current endpoints agree | `Hub docs bot cannot get two independent chain endpoints to agree` |
| `versions.json` does not name a gaia release for the Hub (for example `Latest`) | `Hub docs version in versions.json is ... not a gaia release` |

Alerts go to PagerDuty through the Events API with severity `warning`, so the service's urgency rules keep them low urgency, and the PagerDuty Slack integration posts them. Each alert has a stable key: it stays one incident while the condition holds and resolves itself on the run that sees it clear. The routing key is the repository secret `HUB_DOCS_PAGERDUTY_ROUTING_KEY`. Without it, alerts show as warnings in the workflow run.

## Dry run and going live

`bot-config.json` ships with `"mode": "dry-run"`: the bot opens and updates PRs and checks them, but never merges and never pages. Each alert and each merge it would have made appears in the run summary and as a PR comment. Change the mode to `live` in a PR after one upgrade has gone through cleanly in dry run.
