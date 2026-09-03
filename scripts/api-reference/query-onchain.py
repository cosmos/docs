#!/usr/bin/env python3
"""Run every documented query against a chain, filled the way a reader would fill it.

The reference publishes a grpcurl command for every query method. This runs all
of them, substituting placeholders using only what the page states or what a
reader legitimately owns, so a command that cannot be used as written fails here.

Two outcomes are defects:

  the command errors on its own arguments   the page's payload is wrong
  a placeholder cannot be resolved          the page never says what to put there

Everything else is not: a query that returns nothing, or that names a module this
chain does not register, was still a well-formed request.

Known exceptions live in query-coverage.toml with a reason, so the output is what
changed rather than the same list every run. Entries are diffed against the pages
each time, so one whose method is gone is reported instead of silently ignored.

Usage:
    python3 query-onchain.py --grpc localhost:9090 --rest http://localhost:1317
"""

import argparse
import json
import subprocess
import sys
import tomllib
import urllib.request
from pathlib import Path

import pagefill

HERE = Path(__file__).resolve().parent

# The request itself was malformed. These are documentation defects.
MALFORMED = (
    "invalid character", "illegal base64", "unknown field", "invalid value for enum",
    "hrp does not match", "cannot unmarshal", "invalid validator status",
    "expecting number", "bad input", "unable to resolve type", "no such method",
    "decoding bech32 failed", "empty address", "unknown params type",
    "invalid evidence hash", "disfix json wrapper", "unsupported abci query path",
    "wanted tag", "is not allowed",
)

# The request was fine; the chain had nothing to say, or does not run that module.
ENVIRONMENTAL = (
    "not expose service", "not found", "doesn't exist", "no delegation",
    "client metadata for denom", "identifier not available", "not available",
)


def fixtures(rest: str) -> dict:
    def get(path):
        with urllib.request.urlopen(f"{rest}{path}", timeout=20) as response:
            return json.load(response)

    values = {"denom": get("/cosmos/staking/v1beta1/params")["params"]["bond_denom"]}

    validators = get("/cosmos/staking/v1beta1/validators?pagination.limit=1").get("validators", [])
    if validators:
        values["cosmos.ValidatorAddressString"] = validators[0]["operator_address"]

    for account in get("/cosmos/auth/v1beta1/accounts?pagination.limit=5").get("accounts", []):
        address = account.get("address") or account.get("base_account", {}).get("address")
        if address and address.startswith("cosmos1"):
            values["cosmos.AddressString"] = address
            break

    infos = get("/cosmos/slashing/v1beta1/signing_infos?pagination.limit=1").get("info", [])
    if infos:
        values["cosmos.ConsensusAddressString"] = infos[0]["address"]

    values["cosmos.Int"] = "1"
    return values


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="latest", choices=["latest", "next"])
    parser.add_argument("--grpc", default="localhost:9090")
    parser.add_argument("--rest", default="http://localhost:1317")
    args = parser.parse_args()

    try:
        values = fixtures(args.rest)
    except Exception as error:  # noqa: BLE001
        print(f"could not reach the chain: {error}", file=sys.stderr)
        print("start a local simapp with its API and gRPC servers enabled", file=sys.stderr)
        return 1

    manifest_path = HERE / "query-coverage.toml"
    manifest = (
        tomllib.loads(manifest_path.read_text()).get("queries", {})
        if manifest_path.exists() else {}
    )

    commands = {}
    for path, page in pagefill.pages_for(args.version):
        for target, block in pagefill.queries_on(page):
            commands[target] = (page, block)

    orphaned = sorted(set(manifest) - set(commands))
    if orphaned:
        print("Manifest entries with no matching method, delete them:")
        for name in orphaned:
            print(f"  {name}")
        print()

    counts = {"pass": 0, "known": 0, "environmental": 0}
    findings, unfillable = [], []

    for target in sorted(commands):
        page, block = commands[target]
        entry = manifest.get(target, {})

        try:
            payload = pagefill.fill(block["example"] or {}, page, values, block["fields"])
        except pagefill.Unfillable as reason:
            if entry.get("expect") == "unfillable":
                counts["known"] += 1
                print(f"  KNOWN   {target:52} {entry.get('note', '')[:56]}")
            else:
                unfillable.append((page["name"], target, str(reason)))
                print(f"  UNFILL  {target:52} {reason}")
            continue

        command = ["grpcurl", "-plaintext"]
        if block["example"] is not None:
            command += ["-d", json.dumps(payload)]
        command += [args.grpc, target]

        result = subprocess.run(command, capture_output=True, text=True, timeout=60)
        output = (result.stdout + result.stderr).strip()
        low = output.lower()

        if result.returncode == 0 and not any(m in low for m in MALFORMED):
            counts["pass"] += 1
            print(f"  PASS    {target:52} ok")
        elif any(m in low for m in ENVIRONMENTAL) and not any(m in low for m in MALFORMED):
            counts["environmental"] += 1
            print(f"  SKIP    {target:52} chain state or module not registered")
        elif entry.get("expect") == "known-failure":
            counts["known"] += 1
            print(f"  KNOWN   {target:52} {entry.get('note', '')[:56]}")
        else:
            findings.append((page["name"], target, output.splitlines()[-1][:150]))
            print(f"  FAIL    {target:52} {output.splitlines()[-1][:56]}")

    total = len(commands)
    print(
        f"\n{total} documented queries: {counts['pass']} ran, "
        f"{counts['environmental']} needed chain state, {counts['known']} known exceptions"
    )

    if unfillable:
        print(f"\n{len(unfillable)} a reader could not fill from the page:")
        for page_name, target, reason in unfillable:
            print(f"  {page_name:18} {target}\n    {reason}")

    if findings:
        print(f"\n{len(findings)} failed on their own arguments:")
        for page_name, target, output in findings:
            print(f"  {page_name:18} {target}\n    {output}")

    return 1 if findings or unfillable else 0


if __name__ == "__main__":
    sys.exit(main())
