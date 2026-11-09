# hub-upgrade-bot

## 2026-11-08

- Added `scripts/hub/`: `release-check.py` checks every `gaiad` command on the Hub pages against a gaiad binary (subcommand path and flags, read from the binary's own help), `detect-upgrade.py` reads upgrade proposals and applied heights from five mainnet and two testnet REST endpoints and keeps an answer only when two operators agree, `upgrade-bot.py` opens, checks and merges the publish, notice and patch PRs, with unit tests and a README. The bot ships in dry-run mode: it opens PRs and reports, never merges or pages.
- Added `.github/workflows/hub-upgrade-docs.yml` (every 10 minutes, plus unit tests and a read-only plan on PRs that touch the bot) and `snippets/hub-upgrade-notice.mdx` (the upcoming upgrade box, empty until the bot fills it).
- Fixed three bugs in `scripts/versioning/version-manager.js` found by a trial Hub freeze: the docs.json dropdown was looked up as `subdir.toUpperCase()` ("HUB") while the real labels are display names ("Cosmos Hub", "Cosmos SDK"), so the freeze created a new empty dropdown; the archived nav entry kept `default: true` from the latest entry, giving the product two defaults; and versions.json dropped archive names without a minor number (`v25`) and reordered `latest`/`next` for every other product.
- CODEOWNERS: the ecosystem team owns the new bot files, like `/hub/`.

## 2026-11-08 pause point

- release-check now also checks inline `gaiad ...` spans, handles hidden commands, and reads `scripts/hub/release-check-allow.json` (rules match pages relative to the version folder, so they survive a freeze).
- Against the hub-v29 content branch, the check passes on both v29.0.1 and v29.1.0-rc0 (638 commands, 6 allowed removed-command mentions).
- Next: README update (notice imports and allow file), tests for inline spans and takes_args, em dash and bold scan of both diffs, hub-v29 work log, devnet run log, then the PR and freeze approval asks to Dan.
- Finished after the pause: README covers the inline checks, the allow file and the notice box, three new tests (24 pass), and the bot now raises `hub-docs-version` and stops when `versions.json` names the Hub version `Latest` instead of a gaia release, as `main` does today. Until the freeze sets it, every run would warn.
