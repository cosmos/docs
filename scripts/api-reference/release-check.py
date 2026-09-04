#!/usr/bin/env python3
"""The release gate: regenerate, verify offline, then execute every documented
call against a chain built from the same commit.

Run before a freeze. This is the only thing that proves the pages a reader will
copy actually work, so a freeze should not proceed while it is failing.

    python3 release-check.py --version next --ref release/v0.54.x
    python3 release-check.py --version next --dry-run

The chain is built from the commit the pages record, not pointed at a public
endpoint, because version skew produces false failures that cost more to
discount than the build costs to run. It also runs on its own ports, so a
developer chain already up on this machine is neither disturbed nor mistaken
for the one under test.
"""

import argparse
import os
import difflib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import chain
import pagefill

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent


# What the generator writes, and therefore what a dry run has to put back.
def generated_paths(version: str) -> list:
    return [REPO_ROOT / "sdk" / version / "api-reference", REPO_ROOT / "docs.json"]


def step(name: str, args: list, **kwargs) -> bool:
    # flush, always: the runners write straight to the terminal while this
    # script's own output sits in a pipe buffer, and an unflushed banner lands
    # after the output it was supposed to label.
    print(f"\n=== {name}", flush=True)
    result = subprocess.run(args, cwd=str(HERE), **kwargs)
    ok = result.returncode == 0
    print(f"=== {name}: {'ok' if ok else 'FAILED'}", flush=True)
    return ok


def preflight(tools: list) -> bool:
    """Fail before the expensive part, naming what is missing.

    A gate that skips a check because its tool is absent is how a green run stops
    meaning anything, so a missing tool is fatal rather than a warning.
    """
    hints = {
        "go": "install Go 1.25 or later",
        "schemathesis": "pip install schemathesis",
        "node": "install Node 20 or later",
        "git": "install git",
    }
    missing = [tool for tool in tools if shutil.which(tool) is None]
    for tool in missing:
        hint = hints.get(tool, "not on PATH")
        print(f"missing: {tool} ({hint})", file=sys.stderr)

    # Not a tool, but the same class of problem. The generator makes exactly one
    # authenticated request, resolving a branch name to a commit SHA, so it is
    # never rate-limited by its own volume. Unauthenticated api.github.com
    # allows 60 requests an hour per IP, which a shared CI runner can have
    # already spent, and then that one request 403s. Checked here so the
    # operator reads "missing: GITHUB_TOKEN" rather than a 403 from a URL that
    # looks unrelated to the credential they forgot.
    if not os.environ.get("GITHUB_TOKEN"):
        print(
            "missing: GITHUB_TOKEN (export GITHUB_TOKEN=$(gh auth token))",
            file=sys.stderr,
        )
        missing = missing + ["GITHUB_TOKEN"]

    return not missing


def snapshot(paths: list, into: Path) -> dict:
    """Copy the generated tree aside, verbatim.

    Not `git checkout`: the working tree during a release commonly holds other
    uncommitted work, and restoring from the index would take that with it.
    """
    saved = {}
    for index, path in enumerate(paths):
        if not path.exists():
            continue
        target = into / f"{index}-{path.name}"
        if path.is_dir():
            shutil.copytree(path, target)
        else:
            shutil.copy2(path, target)
        saved[path] = target
    return saved


def restore(saved: dict) -> None:
    for path, target in saved.items():
        if path.is_dir():
            shutil.rmtree(path)
            shutil.copytree(target, path)
        else:
            shutil.copy2(target, path)


def report_diff(saved: dict) -> None:
    """What a real run would have changed, per file."""
    changed = 0
    for path, target in saved.items():
        for before, after in _pairs(target, path):
            plus, minus = _line_delta(before, after)
            if plus or minus:
                changed += 1
                name = after.relative_to(REPO_ROOT) if after.exists() else before.name
                print(f"  {name}: +{plus} -{minus}")
    print(f"  {changed} file(s) would change" if changed else "  nothing would change")


def _pairs(before: Path, after: Path):
    """Walk both sides together, so a file added or removed on either is seen."""
    if before.is_dir() or after.is_dir():
        names = set()
        for side in (before, after):
            if side.is_dir():
                names.update(child.name for child in side.iterdir())
        for name in sorted(names):
            yield from _pairs(before / name, after / name)
        return
    yield before, after


def _line_delta(before: Path, after: Path) -> tuple:
    old = before.read_text().splitlines() if before.is_file() else []
    new = after.read_text().splitlines() if after.is_file() else []
    plus = minus = 0
    for line in difflib.unified_diff(old, new, n=0, lineterm=""):
        if line.startswith("+++") or line.startswith("---"):
            continue
        if line.startswith("+"):
            plus += 1
        elif line.startswith("-"):
            minus += 1
    return plus, minus


def dry_run(version: str, sync: list) -> int:
    scratch = Path(tempfile.mkdtemp(prefix="release-check-"))
    saved = snapshot(generated_paths(version), scratch)
    # Named before anything is overwritten. The regeneration happens in place
    # and the originals live only here until restore() puts them back, so an
    # interrupt the finally cannot cover (SIGKILL, a lost terminal, a crash)
    # leaves the operator with the only copy and no way to find it.
    print(f"Originals copied to {scratch}. Restored on exit; if this run is killed "
          f"outright, copy them back from there.", flush=True)
    try:
        if not step("regenerate (dry run)", sync):
            return 1
        print("\nWhat a real run would change:")
        report_diff(saved)
    finally:
        restore(saved)
        shutil.rmtree(scratch, ignore_errors=True)
    print("\nDry run: the working tree is back as it was. Nothing above was kept.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="next", choices=["next", "latest"])
    parser.add_argument("--ref", default=None,
                        help="upstream ref to generate from; the release branch before a freeze")
    parser.add_argument("--dry-run", action="store_true",
                        help="regenerate into a scratch copy and report the diff, changing nothing")
    parser.add_argument("--workdir", default="/tmp/docs-release-check")
    args = parser.parse_args()

    sync = ["node", "sync-sdk-api-reference.js", "--version", args.version]
    if args.ref:
        sync += ["--ref", args.ref]

    if args.dry_run:
        if not preflight(["git", "node"]):
            return 1
        return dry_run(args.version, sync)

    if not preflight(["git", "node", "go", "schemathesis"]):
        return 1

    if not step("regenerate", sync):
        return 1

    offline = [
        ("unit tests", ["npm", "test"]),
        ("python unit tests", ["npm", "run", "test-py"]),
        ("example encoding", ["python3", "verify-transaction-examples.py"]),
    ]
    for name, command in offline:
        if not step(name, command):
            return 1

    repository, sha, ref = pagefill.generated_from(args.version)
    print(f"\nBuilding a chain at {repository}@{sha[:12]} ({ref})", flush=True)

    failed = []
    with chain.running(repository, sha, Path(args.workdir)) as node:
        print(f"Chain up: rpc {node['node']}, rest {node['rest']}, grpc {node['grpc']}",
              flush=True)
        onchain = [
            ("REST conformance", ["python3", "conformance.py",
                                  "--version", args.version, "--url", node["rest"]]),
            ("documented queries", ["python3", "query-onchain.py", "--version", args.version,
                                    "--grpc", node["grpc"], "--rest", node["rest"]]),
            ("documented transactions", ["python3", "tx-onchain.py", "--version", args.version,
                                         "--simd", node["simd"], "--home", node["home"],
                                         "--chain-id", node["chain_id"], "--node", node["node"],
                                         "--rest", node["rest"], "--from", node["key"],
                                         "--second-key", node["second_key"],
                                         # The gentx was signed by the primary key,
                                         # so that account operates the validator.
                                         "--validator-key", node["key"]]),
        ]
        failed = [name for name, command in onchain if not step(name, command)]

    if failed:
        print(f"\n{len(failed)} check(s) failed: {', '.join(failed)}")
        print("Findings are in findings-*.json. Do not freeze until these are resolved or recorded.")
        return 1

    # The gate proves the pages work. It never reads them as English, so the
    # prose pass is the step that catches a correct example beside a sentence
    # that misleads. Naming it here because a step nobody is reminded of is a
    # step nobody runs.
    print("\nAll checks passed.")
    print("Last step before freezing: read the generated prose.")
    print("  Use the review-generated-prose skill on the regenerated pages.")
    print("  Do not edit a generated page: fixes go in lib/render.js or upstream.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
