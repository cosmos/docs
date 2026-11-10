#!/usr/bin/env python3
"""Keep the Hub docs on the version mainnet runs.

Runs on a schedule. Every run reads the chain, the bot's pull requests and
versions.json again, so nothing is remembered between runs and a missed run
only delays the next step.

For a software upgrade proposal whose release is newer than the docs:

- opens a publish PR as soon as the proposal is on chain. The PR is the
  existing freeze (scripts/versioning) run on current main: next/ becomes
  latest/, and the outgoing latest/ is archived. It is regenerated whenever
  main moves, so it always publishes what next/ holds.
- runs scripts/hub/release-check.py on the PR against the release binary
  named in the proposal, and records the result as a commit status.
- opens a content PR that brings hub/next/ up to the release: the release
  number, and what scripts/hub/release-reader.py finds in the gaia release
  notes, changelog and code diff. A person reviews that PR.
- opens a notice PR once the proposal passes, adding the upcoming upgrade
  box to the Hub pages.
- merges each PR only when a Hub code owner has approved it, the release
  check passes, and (for the publish PR) the chain has applied the upgrade,
  as agreed by two independent endpoints.

For a patch release of the version the docs show (no proposal, operators
swap the binary), it opens a PR that moves the current version string to the
patch and merges it once approved.

It alerts when the publish PR is not ready 24 and 8 hours before the
estimated upgrade time, when the upgrade is applied but the PR cannot merge,
when the site does not show the new version an hour after merging, and when
the chain endpoints stop agreeing.

    python3 scripts/hub/upgrade-bot.py                 # mode from bot-config.json
    python3 scripts/hub/upgrade-bot.py --plan          # print what it would do, change nothing
    python3 scripts/hub/upgrade-bot.py --network testnet --plan

In dry-run mode (the default in bot-config.json) it opens and updates PRs and
writes alerts to the run summary, but never merges and never pages.
"""

import argparse
import base64
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
CONFIG = json.loads((HERE / "bot-config.json").read_text())
MARKER = "<!-- hub-docs-bot -->"
STATUS_CONTEXT = "hub-release-check"
READER_FAILED = "<!-- hub-docs-reader-failed -->"
PAGERDUTY_URL = "https://events.pagerduty.com/v2/enqueue"
NOW = datetime.now(timezone.utc)


def load_detector():
    return load_script("detect_upgrade", "detect-upgrade.py")


def load_script(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def run(args, check=True, capture=True, env=None, cwd=REPO_ROOT):
    proc = subprocess.run(args, cwd=str(cwd), text=True, capture_output=capture,
                          env=dict(os.environ, **(env or {})))
    if check and proc.returncode != 0:
        raise RuntimeError(f"{' '.join(args)} failed:\n{proc.stdout}\n{proc.stderr}")
    return proc


def gh_json(args):
    return json.loads(run(["gh", *args]).stdout or "null")


def version_tuple(v):
    m = re.match(r"^v(\d+)\.(\d+)\.(\d+)(?:-(rc|alpha|beta)\.?(\d+))?$", v or "")
    if not m:
        return None
    pre = (0, int(m.group(5) or 0)) if m.group(4) else (1, 0)
    return (int(m.group(1)), int(m.group(2)), int(m.group(3)), *pre)


def newer(a, b):
    ta, tb = version_tuple(a), version_tuple(b)
    return bool(ta and tb and ta > tb)


def parse_time(value):
    return datetime.strptime(value[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)


class Log:
    """Collects what happened for the job summary."""

    def __init__(self):
        self.lines = []

    def __call__(self, msg):
        print(msg, flush=True)
        self.lines.append(msg)

    def write_summary(self):
        path = os.environ.get("GITHUB_STEP_SUMMARY")
        if path:
            with open(path, "a") as fh:
                fh.write("## Hub docs bot\n\n" + "\n".join(f"- {l}" for l in self.lines) + "\n")


log = Log()


class Alerts:
    """PagerDuty Events API v2. Every alert has a stable dedup key, so a
    condition that stays true across runs stays one incident, and the run
    that sees it clear resolves it."""

    def __init__(self, live):
        self.live = live
        self.key = os.environ.get("PAGERDUTY_ROUTING_KEY", "")

    def _send(self, action, dedup, summary=None, details=None):
        if not self.live or not self.key:
            if action == "trigger":
                log(f"ALERT ({'not sent, dry run' if not self.live else 'not sent, no PAGERDUTY_ROUTING_KEY'}): {summary}")
                print(f"::warning::{summary}")
            return
        body = {"routing_key": self.key, "event_action": action, "dedup_key": dedup}
        if action == "trigger":
            body["payload"] = {
                "summary": summary[:1000], "source": "cosmos/docs hub-upgrade-docs",
                "severity": "warning", "custom_details": details or {},
            }
            body["links"] = [{"href": os.environ.get("RUN_URL", "https://github.com/cosmos/docs/actions"), "text": "Workflow run"}]
        req = urllib.request.Request(PAGERDUTY_URL, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
        try:
            urllib.request.urlopen(req, timeout=15).read()
        except Exception as exc:
            print(f"::error::PagerDuty {action} failed: {exc}")
        if action == "trigger":
            log(f"ALERT sent: {summary}")

    def trigger(self, dedup, summary, details=None):
        self._send("trigger", dedup, summary, details)

    def resolve(self, dedup):
        self._send("resolve", dedup)


# ---------------------------------------------------------------------------
# Repository state
# ---------------------------------------------------------------------------

def repo_name():
    return os.environ.get("GITHUB_REPOSITORY") or gh_json(["repo", "view", "--json", "nameWithOwner"])["nameWithOwner"]


def docs_version():
    return json.loads((REPO_ROOT / "versions.json").read_text())["products"]["hub"]["latestDisplayVersion"]


def hub_owners():
    for line in (REPO_ROOT / ".github" / "CODEOWNERS").read_text().splitlines():
        parts = line.split()
        if parts and parts[0] == CONFIG["owners_path"]:
            return {p.lstrip("@").lower() for p in parts[1:]}
    return set()


def find_pr(branch):
    prs = gh_json(["pr", "list", "--head", branch, "--state", "all", "--json",
                   "number,state,mergedAt,headRefOid,mergeable,reviews,url,title,body"])
    return prs[0] if prs else None


def approved(pr, owners):
    latest = {}
    for review in pr.get("reviews", []):
        latest[review["author"]["login"].lower()] = review["state"]
    if any(latest.get(o) == "CHANGES_REQUESTED" for o in owners):
        return False
    return any(latest.get(o) == "APPROVED" for o in owners)


def commit_status(repo, sha):
    data = gh_json(["api", f"repos/{repo}/commits/{sha}/status"])
    for status in data.get("statuses", []):
        if status["context"] == STATUS_CONTEXT:
            return status["state"], status.get("description", "")
    return None, ""


def set_status(repo, sha, state, description):
    run(["gh", "api", f"repos/{repo}/statuses/{sha}", "-f", f"state={state}",
         "-f", f"context={STATUS_CONTEXT}", "-f", f"description={description[:140]}",
         "-f", f"target_url={os.environ.get('RUN_URL', '')}"])


def upsert_comment(repo, number, text):
    comments = gh_json(["api", f"repos/{repo}/issues/{number}/comments", "--paginate"])
    body = MARKER + "\n" + text
    for c in comments or []:
        if c["body"].startswith(MARKER):
            if c["body"] != body:
                run(["gh", "api", "-X", "PATCH", f"repos/{repo}/issues/comments/{c['id']}", "-f", f"body={body}"])
            return
    run(["gh", "api", f"repos/{repo}/issues/{number}/comments", "-f", f"body={body}"])


def ensure_label(repo):
    labels = gh_json(["label", "list", "--json", "name", "--limit", "200"])
    if not any(l["name"] == CONFIG["label"] for l in labels):
        run(["gh", "label", "create", CONFIG["label"], "--color", "6f42c1",
             "--description", "Opened by the Hub docs upgrade bot"])


# ---------------------------------------------------------------------------
# Building the branches
# ---------------------------------------------------------------------------

def start_branch(branch):
    run(["git", "fetch", "origin", "main"])
    run(["git", "checkout", "-B", branch, "origin/main"])


def tree_entries(status_z, read=None):
    """Git tree entries for the staged changes against main, from the output
    of `git diff --cached --name-status --no-renames -z origin/main`."""
    read = read or (lambda path: (REPO_ROOT / path).read_bytes())
    entries, binary = [], []
    fields = [f for f in status_z.split("\0") if f]
    for code, path in zip(fields[0::2], fields[1::2]):
        if code == "D":
            entries.append({"path": path, "mode": "100644", "type": "blob", "sha": None})
            continue
        mode = "100755" if os.access(REPO_ROOT / path, os.X_OK) else "100644"
        data = read(path)
        try:
            entries.append({"path": path, "mode": mode, "type": "blob", "content": data.decode("utf-8")})
        except UnicodeDecodeError:
            binary.append((path, mode, data))
    return entries, binary


def push_branch(branch, message):
    """Commit the working tree on top of main and point the branch at it.
    Returns the new commit, or None when there is nothing to commit.

    The commit is created through the GitHub API with no author given, so
    GitHub signs it as the workflow's bot. main requires signed commits, and
    a commit made with `git commit` on the runner is not signed."""
    run(["git", "add", "-A"])
    status = run(["git", "diff", "--cached", "--name-status", "--no-renames", "-z", "origin/main"]).stdout
    if not status:
        return None
    repo = repo_name()
    main_sha = run(["git", "rev-parse", "origin/main"]).stdout.strip()
    entries, binary = tree_entries(status)
    for path, mode, data in binary:
        blob = api_post(f"repos/{repo}/git/blobs", {"content": base64.b64encode(data).decode(), "encoding": "base64"})
        entries.append({"path": path, "mode": mode, "type": "blob", "sha": blob["sha"]})
    base_tree = run(["git", "rev-parse", "origin/main^{tree}"]).stdout.strip()
    tree = api_post(f"repos/{repo}/git/trees", {"base_tree": base_tree, "tree": entries})
    commit = api_post(f"repos/{repo}/git/commits", {"message": message, "tree": tree["sha"], "parents": [main_sha]})
    ref = f"repos/{repo}/git/refs/heads/{branch}"
    if run(["gh", "api", ref], check=False).returncode == 0:
        api_post(ref, {"sha": commit["sha"], "force": True}, method="PATCH")
    else:
        api_post(f"repos/{repo}/git/refs", {"ref": f"refs/heads/{branch}", "sha": commit["sha"]})
    return commit["sha"]


def pr_at(branch, sha, tries=12, wait=5):
    """The branch's PR once GitHub shows it at the commit just pushed. Right
    after a push the PR can still report its previous head."""
    pr = find_pr(branch)
    for _ in range(tries):
        if pr and pr["headRefOid"] == sha:
            return pr
        time.sleep(wait)
        pr = find_pr(branch)
    raise RuntimeError(f"{branch}: the PR did not move to {sha[:8]}")


def ensure_signed(repo, pr, branch):
    """Replace an unsigned head commit on one of the bot's open PRs with the
    same tree committed through the API, which GitHub signs. Returns the PR."""
    head = gh_json(["api", f"repos/{repo}/commits/{pr['headRefOid']}"])
    if head["commit"]["verification"]["verified"]:
        return pr
    commit = api_post(f"repos/{repo}/git/commits", {
        "message": head["commit"]["message"], "tree": head["commit"]["tree"]["sha"],
        "parents": [p["sha"] for p in head["parents"]]})
    api_post(f"repos/{repo}/git/refs/heads/{branch}", {"sha": commit["sha"], "force": True}, method="PATCH")
    log(f"{pr['url']}: replaced an unsigned commit with a signed one, same content")
    return pr_at(branch, commit["sha"])


def api_post(path, body, method="POST"):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump(body, fh)
    try:
        return json.loads(run(["gh", "api", "-X", method, path, "--input", fh.name]).stdout)
    finally:
        os.unlink(fh.name)


def freeze(archive_version, release):
    env = {"NON_INTERACTIVE": "1", "SUBDIR": "hub", "ARCHIVE_VERSION": archive_version,
           "NEW_DISPLAY_VERSION": release}
    run(["node", "version-manager.js"], env=env, cwd=REPO_ROOT / "scripts" / "versioning")
    set_notice(None)


def set_notice(upgrade):
    path = REPO_ROOT / CONFIG["notice_snippet"]
    text = path.read_text()
    value = "null" if upgrade is None else json.dumps(upgrade)
    path.write_text(re.sub(r"const upgrade = .*?;\n", f"const upgrade = {value};\n", text, count=1))


def patch_version(old, new):
    """Move the current version string to a patch release in latest/ and next/.

    Lines with a HubVerified stamp keep the version they were run on, and the
    files in patch_skip_files (history pages) are left alone."""
    changed = []
    for tier in ("latest", "next"):
        for path in sorted((REPO_ROOT / "hub" / tier).rglob("*.mdx")):
            rel = str(path.relative_to(REPO_ROOT / "hub" / tier))
            if rel in CONFIG["patch_skip_files"]:
                continue
            lines = path.read_text().split("\n")
            out = [l if "HubVerified" in l else re.sub(rf"(?<![\w.]){re.escape(old)}(?![\w.-])", new, l) for l in lines]
            if out != lines:
                path.write_text("\n".join(out))
                changed.append(str(path.relative_to(REPO_ROOT)))
    registry = REPO_ROOT / "versions.json"
    data = json.loads(registry.read_text())
    data["products"]["hub"]["latestDisplayVersion"] = new
    registry.write_text(json.dumps(data, indent=2) + "\n")
    nav = REPO_ROOT / "docs.json"
    docs = json.loads(nav.read_text())
    for dropdown in docs["navigation"]["dropdowns"]:
        for entry in dropdown.get("versions", []):
            if entry.get("tag") == "Latest" and '"hub/latest/' in json.dumps(entry):
                entry["version"] = new
    nav.write_text(json.dumps(docs, indent=2) + "\n")
    return changed


# ---------------------------------------------------------------------------
# Release check against the release binary
# ---------------------------------------------------------------------------

def fetch_binary(url, sha256=None):
    """Download a gaiad binary and verify its checksum before it runs."""
    clean, _, query = url.partition("?")
    m = re.search(r"checksum=sha256:([0-9a-f]{64})", query)
    expected = sha256 or (m.group(1) if m else None)
    if not expected:
        raise RuntimeError(f"no sha256 for {clean}")
    dest = Path(tempfile.mkdtemp(prefix="gaiad-")) / "gaiad"
    with urllib.request.urlopen(clean, timeout=300) as resp, open(dest, "wb") as fh:
        fh.write(resp.read())
    digest = hashlib.sha256(dest.read_bytes()).hexdigest()
    if digest != expected:
        raise RuntimeError(f"checksum mismatch for {clean}: {digest} != {expected}")
    dest.chmod(0o755)
    return dest


def release_binary_url(tag):
    """The linux/amd64 asset and its checksum from a GitHub release."""
    base = f"https://github.com/cosmos/gaia/releases/download/{tag}"
    with urllib.request.urlopen(f"{base}/SHA256SUMS-{tag}.txt", timeout=60) as resp:
        sums = resp.read().decode()
    for line in sums.splitlines():
        digest, _, name = line.partition("  ")
        if name.strip() == f"gaiad-{tag}-linux-amd64":
            return f"{base}/{name.strip()}", digest
    raise RuntimeError(f"no linux-amd64 binary in the {tag} release")


def release_check(binary, tier):
    report = Path(tempfile.mkdtemp()) / "report.json"
    proc = run([sys.executable, str(HERE / "release-check.py"), "--gaiad", str(binary),
                "--version", tier, "--json", str(report)], check=False)
    data = json.loads(report.read_text()) if report.exists() else {"failures": [{"problem": proc.stdout[-500:] + proc.stderr[-500:]}]}
    return proc.returncode == 0, data


def check_pr(repo, pr, binary_source, tier="latest"):
    """Run the release check on the PR head once per commit."""
    state, desc = commit_status(repo, pr["headRefOid"])
    if state in ("success", "failure"):
        return state == "success", desc
    run(["git", "fetch", "origin", pr["headRefOid"]])
    run(["git", "checkout", "--detach", pr["headRefOid"]])
    try:
        binary = fetch_binary(*binary_source)
        ok, data = release_check(binary, tier)
    except Exception as exc:
        set_status(repo, pr["headRefOid"], "error", f"could not run: {exc}")
        return False, f"release check could not run: {exc}"
    fails = data.get("failures", [])
    desc = f"gaiad {data.get('gaiad', '?')}: {data.get('checked', 0)} commands, {len(fails)} failures"
    set_status(repo, pr["headRefOid"], "success" if ok else "failure", desc)
    lines = [f"Release check on `hub/{tier}` against gaiad `{data.get('gaiad', '?')}`: {data.get('checked', 0)} commands, {len(fails)} failures."]
    for f in fails[:50]:
        lines.append(f"- `{f.get('file', '')}:{f.get('line', '')}` {f.get('problem', '')}")
    if data.get("stale_stamps"):
        lines.append(f"\n{len(data['stale_stamps'])} pages still carry a HubVerified stamp for an older gaia version.")
    upsert_comment(repo, pr["number"], "\n".join(lines))
    return ok, desc


# ---------------------------------------------------------------------------
# The three flows
# ---------------------------------------------------------------------------

def pick_upgrade(state, current):
    for u in state["upgrades"]:
        if u["status"] not in ("VOTING_PERIOD", "PASSED"):
            continue
        release = u.get("release") or (u["plan_name"] if version_tuple(u["plan_name"] or "") else None)
        if release and newer(release, current):
            return dict(u, release=release)
    return None


def publish_upgrade(ctx, u):
    repo, current, owners, alerts, live, plan = ctx["repo"], ctx["current"], ctx["owners"], ctx["alerts"], ctx["live"], ctx["plan"]
    release, height = u["release"], u["plan_height"]
    branch = CONFIG["branch_prefix"] + release
    key = f"hub-docs-{release}"
    log(f"Upgrade proposal {u['proposal_id']} ({u['status']}): {release} at height {height:,}, estimated {u.get('estimated_time') or 'reached'}, applied at {u['applied_height'] or 'not yet'}")
    if not version_tuple(current):
        alerts.trigger(f"{key}-setup", f"Hub docs show '{current}', not a release number, so the bot cannot freeze for {release}")
        return

    pr = find_pr(branch) if not plan else None
    if plan:
        log(f"PLAN: publish PR {branch}: freeze ARCHIVE_VERSION={current} NEW_DISPLAY_VERSION={release}")
        log(f"PLAN: content PR {CONFIG['branch_prefix']}content-{release}: release reader {current} -> {release}")
        if u["status"] == "PASSED" and not u["applied_height"]:
            log(f"PLAN: notice PR {CONFIG['branch_prefix']}notice-{release}")
        return
    if pr and pr["state"] == "MERGED":
        verify_live(ctx, release, pr)
        return
    if pr and pr["state"] == "CLOSED":
        log(f"{branch}: PR was closed by a person, leaving it alone")
        return

    content_open = publish_content(ctx, u)

    body = (
        f"Publishes the Hub docs for gaia `{release}` when mainnet applies upgrade `{u['plan_name']}` "
        f"(proposal {u['proposal_id']}, height {height:,}).\n\n"
        f"This PR is the docs freeze run on current `main`: `hub/next/` becomes `hub/latest/`, and `hub/latest/` "
        f"is archived as `hub/{current}/`. The bot regenerates it whenever `main` changes, so fixes go to "
        f"`hub/next/` in their own PRs, not here.\n\n"
        f"It merges itself when all of these hold:\n"
        f"- a Hub code owner approved it\n- the `{STATUS_CONTEXT}` status passes against the proposal's binary\n"
        f"- two independent endpoints report the upgrade applied on chain\n\n"
        f"Binaries in the proposal: {', '.join(u['binaries']) or 'none listed'}"
    )
    title = f"Hub: publish the gaia {release} docs at upgrade height {height:,}"

    # Regenerate when the PR is missing or main has moved under it.
    stale = pr is None
    if pr:
        main_sha = run(["git", "ls-remote", "origin", "refs/heads/main"]).stdout.split()[0]
        run(["git", "fetch", "origin", pr["headRefOid"]])
        parent = run(["git", "rev-parse", f"{pr['headRefOid']}^"]).stdout.strip()
        stale = parent != main_sha
    if stale:
        start_branch(branch)
        freeze(current, release)
        pushed = push_branch(branch, f"Hub: publish the gaia {release} docs\n\nFreeze of hub/next/ for upgrade {u['plan_name']} at height {height}.")
        if pr is None:
            ensure_label(repo)
            run(["gh", "pr", "create", "--base", "main", "--head", branch, "--title", title,
                 "--body", body, "--label", CONFIG["label"]])
            log(f"Opened the publish PR for {release}")
        else:
            log(f"Regenerated the publish PR for {release} on current main")
        pr = pr_at(branch, pushed) if pushed else find_pr(branch)

    pr = ensure_signed(repo, pr, branch)
    linux = u["binaries"].get("linux/amd64")
    source = (linux, None) if linux else release_binary_url(release)
    checked, desc = check_pr(repo, pr, source)
    is_approved = approved(pr, owners)
    mergeable = pr["mergeable"] != "CONFLICTING"
    ready = checked and is_approved and mergeable and not content_open
    reasons = [r for r, bad in (("no Hub code owner approval", not is_approved),
                                (f"the content PR {content_open} is not merged", bool(content_open)),
                                (f"release check: {desc}", not checked),
                                ("merge conflict", not mergeable)) if bad]
    log(f"{pr['url']}: {'ready' if ready else 'not ready: ' + '; '.join(reasons)}")

    if u["status"] == "PASSED" and not u["applied_height"]:
        publish_notice(ctx, u)

    if not u["applied_height"] and ready:
        u = watch_height(ctx, u)

    if not u["applied_height"]:
        eta = parse_time(u["estimated_time"]) if u.get("estimated_time") else None
        hours = (eta - NOW).total_seconds() / 3600 if eta else None
        due = [h for h in CONFIG["alert_hours_before"] if hours is not None and hours <= h]
        if due and not ready:
            alerts.trigger(f"{key}-not-ready",
                           f"Hub docs for {release} are not ready, upgrade in about {hours:.0f} hours: {'; '.join(reasons)}",
                           {"pr": pr["url"], "height": height})
        elif ready:
            alerts.resolve(f"{key}-not-ready")
        return

    if not ready:
        alerts.trigger(f"{key}-not-published",
                       f"Mainnet applied {u['plan_name']} at height {u['applied_height']:,} but the Hub docs PR cannot merge: {'; '.join(reasons)}",
                       {"pr": pr["url"]})
        return
    alerts.resolve(f"{key}-not-ready")
    if live:
        run(["gh", "pr", "merge", str(pr["number"]), "--squash", "--delete-branch"])
        log(f"Merged {pr['url']} after the upgrade applied at height {u['applied_height']:,}")
        alerts.resolve(f"{key}-not-published")
    else:
        upsert_comment(repo, pr["number"], f"Dry run: the upgrade applied at height {u['applied_height']:,} and this PR is ready. In live mode the bot would merge it now ({NOW:%Y-%m-%d %H:%M} UTC).")
        log("Dry run: would merge now")


def watch_height(ctx, u):
    """Near the upgrade, stay in this run and poll every 30 seconds.

    The schedule only fires every 10 minutes (often later), so without this
    the docs would switch up to half an hour after the chain did."""
    detector = load_detector()
    config = json.loads((HERE / "endpoints.json").read_text())
    deadline = datetime.now(timezone.utc) + timedelta(minutes=CONFIG["watch_minutes"] + 15)
    eta = parse_time(u["estimated_time"]) if u.get("estimated_time") else None
    if eta and eta - datetime.now(timezone.utc) > timedelta(minutes=CONFIG["watch_minutes"]):
        return u
    log(f"Upgrade {u['plan_name']} is under {CONFIG['watch_minutes']} minutes away: polling every 30 seconds")
    while datetime.now(timezone.utc) < deadline:
        state = detector.detect(CONFIG["network"], config)
        if state["agreed"]:
            for item in state["upgrades"]:
                if item["proposal_id"] == u["proposal_id"] and item["applied_height"]:
                    log(f"Chain applied {u['plan_name']} at height {item['applied_height']:,}")
                    return dict(u, applied_height=item["applied_height"])
        time.sleep(30)
    log("Stopped polling; the next scheduled run continues")
    return u


def read_release(current, u):
    """Run the release reader on the working tree. Returns the reviewer
    summary and whether the release notes were read."""
    out = Path(tempfile.mkdtemp(prefix="hub-reader-"))
    (out / "upgrade.json").write_text(json.dumps(u))
    base = [sys.executable, str(HERE / "release-reader.py"), "--from", current, "--to", u["release"],
            "--summary", str(out / "summary.md")]
    error = None
    if not (os.environ.get("CLAUDE_CODE_OAUTH_TOKEN") or os.environ.get("ANTHROPIC_API_KEY")):
        error = "no CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY secret"
    else:
        try:
            run(["npm", "install", "--global", "--silent", CONFIG["reader_package"]])
            run([*base, "--upgrade", str(out / "upgrade.json")])
        except Exception as exc:
            error = str(exc)[-600:]
    if error:
        run(["git", "reset", "--hard", "origin/main"])
        run([*base, "--no-agent"])
    return (out / "summary.md").read_text(), error


def publish_content(ctx, u):
    """The PR a person reviews: hub/next/ brought up to the new release.
    Returns the PR's URL while it is still open, so publishing waits for it."""
    repo, current, owners, alerts, live = ctx["repo"], ctx["current"], ctx["owners"], ctx["alerts"], ctx["live"]
    release = u["release"]
    branch = f"{CONFIG['branch_prefix']}content-{release}"
    key = f"hub-docs-{release}-reader"
    pr = find_pr(branch)
    if pr and pr["state"] == "CLOSED" and READER_FAILED in (pr.get("body") or ""):
        pr = None  # a person closed the number-only PR to ask for another try
    if pr and pr["state"] in ("MERGED", "CLOSED"):
        alerts.resolve(key)
        return None
    if pr is None:
        start_branch(branch)
        summary, error = read_release(current, u)
        title = f"Hub: update the upcoming docs for gaia {release}"
        intro = (f"Brings `hub/next/` up to gaia `{release}` ahead of upgrade `{u['plan_name']}` "
                 f"(proposal {u['proposal_id']}, height {u['plan_height']:,}). Nothing here is live until the publish PR "
                 f"merges at that height.\n\n")
        if error:
            intro += (f"{READER_FAILED}\nThe release notes were not read ({error.splitlines()[-1][:200]}), so this PR only "
                      f"replaces the release number. Read the gaia release notes and add what changed by hand, or close "
                      f"this PR and the bot will try again on its next run.\n\n")
            title += " (release number only)"
        else:
            intro += ("Written by `scripts/hub/release-reader.py` from the gaia release notes, changelog and code diff. "
                      "Each change is listed beside its source below. Check the table against the diff before approving.\n\n")
        pushed = push_branch(branch, f"Hub: update the upcoming docs for gaia {release}")
        if not pushed:
            log(f"{branch}: the release reader changed nothing")
            return None
        ensure_label(repo)
        run(["gh", "pr", "create", "--base", "main", "--head", branch, "--title", title,
             "--body", (intro + summary)[:60000], "--label", CONFIG["label"]])
        log(f"Opened the content PR for {release}" + (" with the release number only" if error else ""))
        pr = pr_at(branch, pushed)
    pr = ensure_signed(repo, pr, branch)
    if READER_FAILED in (pr.get("body") or ""):
        alerts.trigger(key, f"Hub docs for {release}: the release notes were not read, {pr['url']} only replaces the release number",
                       {"pr": pr["url"], "fix": "renew CLAUDE_CODE_OAUTH_TOKEN if the run log shows a login error, then close the PR and delete its branch"})
    else:
        alerts.resolve(key)
    linux = u["binaries"].get("linux/amd64")
    checked, desc = check_pr(repo, pr, (linux, None) if linux else release_binary_url(release), tier="next")
    if checked and approved(pr, owners) and pr["mergeable"] != "CONFLICTING":
        if live:
            run(["gh", "pr", "merge", str(pr["number"]), "--squash", "--delete-branch"])
            log(f"Merged the content PR {pr['url']}")
            return None
        log(f"Dry run: would merge the content PR {pr['url']}")
    else:
        log(f"{pr['url']}: waiting for approval" + ("" if checked else f"; release check: {desc}"))
    return pr["url"]


def reader_token_alert(alerts):
    """The Claude token lasts a year and does not renew itself."""
    issued = CONFIG.get("reader_token_issued")
    if not issued:
        return
    expires = datetime.strptime(issued, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=365)
    days = (expires - NOW).days
    if days <= CONFIG["reader_token_warn_days"]:
        alerts.trigger("hub-docs-reader-token",
                       f"The Hub docs bot's Claude token expires in {max(days, 0)} days ({expires:%Y-%m-%d})",
                       {"fix": "run `claude setup-token`, store it as the CLAUDE_CODE_OAUTH_TOKEN secret, update reader_token_issued in scripts/hub/bot-config.json"})
    else:
        alerts.resolve("hub-docs-reader-token")


def publish_notice(ctx, u):
    repo, owners, live = ctx["repo"], ctx["owners"], ctx["live"]
    branch = f"{CONFIG['branch_prefix']}notice-{u['release']}"
    pr = find_pr(branch)
    if pr and pr["state"] in ("MERGED", "CLOSED"):
        return
    if pr is None:
        start_branch(branch)
        set_notice({"proposal": u["proposal_id"], "release": u["release"], "height": u["plan_height"],
                    "time": u.get("estimated_time")})
        if push_branch(branch, f"Hub: announce the gaia {u['release']} upgrade"):
            ensure_label(repo)
            run(["gh", "pr", "create", "--base", "main", "--head", branch,
                 "--title", f"Hub: announce the gaia {u['release']} upgrade at height {u['plan_height']:,}",
                 "--body", f"Adds the upcoming upgrade notice to the Hub pages for proposal {u['proposal_id']}. "
                           f"Merges itself once a Hub code owner approves. The publish PR removes the notice.",
                 "--label", CONFIG["label"]])
            log(f"Opened the notice PR for {u['release']}")
        return
    if approved(pr, owners) and pr["mergeable"] != "CONFLICTING":
        if live:
            run(["gh", "pr", "merge", str(pr["number"]), "--squash", "--delete-branch"])
            log(f"Merged the notice PR {pr['url']}")
        else:
            log(f"Dry run: would merge the notice PR {pr['url']}")


def publish_patch(ctx, upgrades):
    repo, current, owners, live, plan = ctx["repo"], ctx["current"], ctx["owners"], ctx["live"], ctx["plan"]
    rel = gh_json(["release", "view", "-R", "cosmos/gaia", "--json", "tagName,isPrerelease,publishedAt"])
    tag = rel["tagName"]
    cur, new = version_tuple(current), version_tuple(tag)
    if rel["isPrerelease"] or not cur or not new or new[:2] != cur[:2] or not newer(tag, current):
        return
    if any(u.get("release") == tag for u in upgrades):
        return
    branch = CONFIG["branch_prefix"] + tag
    log(f"Patch release {tag} for the {current} docs")
    if plan:
        log(f"PLAN: patch PR {branch}: {current} -> {tag}")
        return
    pr = find_pr(branch)
    if pr and pr["state"] == "MERGED":
        verify_live(ctx, tag, pr)
        return
    if pr and pr["state"] == "CLOSED":
        return
    if pr is None:
        start_branch(branch)
        changed = patch_version(current, tag)
        pushed = push_branch(branch, f"Hub: move the docs to gaia {tag}\n\nPatch release of {current}; no upgrade proposal.")
        ensure_label(repo)
        run(["gh", "pr", "create", "--base", "main", "--head", branch,
             "--title", f"Hub: move the docs to gaia {tag}",
             "--body", f"`{tag}` is a patch release of `{current}`, which operators install by swapping the binary, "
                       f"with no upgrade proposal. This PR replaces `{current}` with `{tag}` in `hub/latest/` and `hub/next/` "
                       f"({len(changed)} files), except HubVerified stamps and the upgrade history page. Read every changed line: "
                       f"a sentence about `{current}` itself should keep the old number.\n\nMerges itself once a Hub code owner approves "
                       f"and the `{STATUS_CONTEXT}` status passes.",
             "--label", CONFIG["label"]])
        log(f"Opened the patch PR for {tag}")
        pr = pr_at(branch, pushed) if pushed else find_pr(branch)
    checked, desc = check_pr(repo, pr, release_binary_url(tag))
    if checked and approved(pr, owners) and pr["mergeable"] != "CONFLICTING":
        if live:
            run(["gh", "pr", "merge", str(pr["number"]), "--squash", "--delete-branch"])
            log(f"Merged the patch PR {pr['url']}")
        else:
            log(f"Dry run: would merge the patch PR {pr['url']}")


def verify_live(ctx, release, pr):
    key = f"hub-docs-{release}-live"
    try:
        req = urllib.request.Request(CONFIG["live_url"], headers={"User-Agent": "cosmos-docs-hub-upgrade-check"})
        html = urllib.request.urlopen(req, timeout=30).read().decode(errors="replace")
    except Exception as exc:
        html = ""
        log(f"Live check could not load {CONFIG['live_url']}: {exc}")
    if release in html:
        ctx["alerts"].resolve(key)
        return
    merged = parse_time(pr["mergedAt"])
    if NOW - merged > timedelta(minutes=CONFIG["publish_grace_minutes"]):
        ctx["alerts"].trigger(key, f"Hub docs for {release} merged at {merged:%H:%M} UTC but {CONFIG['live_url']} does not show {release}",
                              {"pr": pr["url"]})
    else:
        log(f"Waiting for the site to show {release} (merged {merged:%H:%M} UTC)")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--plan", action="store_true", help="print what would happen and change nothing")
    ap.add_argument("--network", default=CONFIG["network"], choices=["mainnet", "testnet"])
    args = ap.parse_args()

    live = CONFIG["mode"] == "live" and not args.plan
    alerts = Alerts(live)
    state = load_detector().detect(args.network, json.loads((HERE / "endpoints.json").read_text()))
    log(f"{state['chain_id']} at height {state['height']:,}: {state['fresh_endpoints']} current endpoints, agreed={state['agreed']}, mode={'plan' if args.plan else CONFIG['mode']}")
    if not state["agreed"]:
        bad = [f"{e['operator']}: {e.get('error', 'disagrees')}" for e in state["endpoints"]]
        alerts.trigger("hub-docs-sources", "Hub docs bot cannot get two independent chain endpoints to agree", {"endpoints": bad})
        log.write_summary()
        return 1
    alerts.resolve("hub-docs-sources")

    ctx = {"repo": None if args.plan else repo_name(), "current": docs_version(), "owners": hub_owners(),
           "alerts": alerts, "live": live, "plan": args.plan}
    log(f"Docs show {ctx['current']}; Hub code owners: {', '.join(sorted(ctx['owners']))}")
    if not version_tuple(ctx["current"]):
        alerts.trigger("hub-docs-version", f"Hub docs version in versions.json is {ctx['current']!r}, not a gaia release, so the bot cannot compare upgrades",
                       {"fix": "set products.hub.latestDisplayVersion to the gaia release hub/latest documents, for example with the versioning freeze"})
        log.write_summary()
        return 0 if args.plan else 1
    alerts.resolve("hub-docs-version")
    reader_token_alert(alerts)
    upgrade = pick_upgrade(state, ctx["current"])
    if upgrade:
        publish_upgrade(ctx, upgrade)
    else:
        log("No upgrade proposal newer than the docs")
    publish_patch(ctx, state["upgrades"])
    log.write_summary()
    return 0


if __name__ == "__main__":
    sys.exit(main())
