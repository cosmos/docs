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
import urllib.request
from pathlib import Path

import findings
import manifest
import pagefill

HERE = Path(__file__).resolve().parent


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


def assertions(grpc: str, rest: str, values: dict, counts: dict) -> list:
    """Claims the enumerated commands cannot express.

    Two are negative: they pass by failing. They are worth keeping precisely
    because they would start passing silently if the chain changed, which no
    positive assertion, run over and over against a chain that keeps agreeing
    with the page, would ever notice.

    ``values["cosmos.AddressString"]`` is only set when fixtures() happens to
    see a cosmos1-prefixed account among the first five accounts the chain
    returns. On a chain with a different bech32 prefix, or one whose first
    five accounts are all module accounts, the key is absent. The two checks
    that need an account address are skipped rather than raising: a KeyError
    here would take down the run before the other 123 queries execute, which
    is a worse outcome than losing two of four assertions.
    """
    items = []
    address = values.get("cosmos.AddressString")

    def expect_error(name, args_, claim, page):
        result = subprocess.run(["grpcurl", "-plaintext", *args_], capture_output=True,
                                 text=True, timeout=60)
        if result.returncode == 0:
            items.append(findings.Finding(
                page=page, anchor="", method=name, claim=claim,
                sent=None, response="succeeded, but the page says it cannot",
                verdict="page-defect", manifest_entry=None))
            print(f"  FAIL    {name:52} unexpectedly succeeded")
        else:
            counts["pass"] += 1
            print(f"  PASS    {name:52} rejected as documented")

    if address:
        expect_error(
            "cosmos.staking.v1beta1.Query/Validator",
            ["-d", json.dumps({"validator_addr": address}), grpc,
             "cosmos.staking.v1beta1.Query/Validator"],
            "an account address is rejected where a validator operator address belongs",
            "grpc/index.mdx",
        )
    else:
        print("  SKIP    cosmos.staking.v1beta1.Query/Validator (crossed spaces)  "
              "no cosmos1 address fixture")

    expect_error(
        "cosmos.bank.v1beta1.Msg/Send",
        ["-d", "{}", grpc, "cosmos.bank.v1beta1.Msg/Send"],
        "Msg is not served on the gRPC query port",
        "grpc/index.mdx",
    )

    rest_checks = [
        ("/cosmos/mint/v1beta1/params", "a decimal is always a decimal string over REST"),
    ]
    if address:
        rest_checks.append((
            f"/cosmos/bank/v1beta1/balances/{address}",
            "a REST path parameter takes a bech32 address",
        ))
    else:
        print("  SKIP    GET /cosmos/bank/v1beta1/balances/{address}  "
              "no cosmos1 address fixture")

    for path, claim in rest_checks:
        try:
            with urllib.request.urlopen(f"{rest}{path}", timeout=20) as response:
                json.load(response)
            counts["pass"] += 1
            print(f"  PASS    GET {path:48} ok")
        except Exception as error:  # noqa: BLE001
            items.append(findings.Finding(
                page="index.mdx", anchor="", method=f"GET {path}", claim=claim,
                sent=None, response=str(error), verdict="page-defect", manifest_entry=None))
            print(f"  FAIL    GET {path:48} {error}")

    return items


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="latest", choices=["latest", "next"])
    parser.add_argument("--grpc", default="localhost:9090")
    parser.add_argument("--rest", default="http://localhost:1317")
    parser.add_argument("--findings", default="findings-query-onchain.json")
    args = parser.parse_args()

    try:
        values = fixtures(args.rest)
    except Exception as error:  # noqa: BLE001
        print(f"could not reach the chain: {error}", file=sys.stderr)
        print("start a local simapp with its API and gRPC servers enabled", file=sys.stderr)
        return 1

    commands = {}
    for path, page in pagefill.pages_for(args.version):
        for target, block in pagefill.queries_on(page):
            commands[target] = (page, block)

    try:
        pagefill.assert_complete(args.version, commands, "queries")
    except pagefill.Incomplete as reason:
        print(f"\n{reason}", file=sys.stderr)
        return 1

    try:
        entries = manifest.load(HERE / "query-coverage.toml", manifest.QUERY_VOCABULARY)
        errors = manifest.load_errors(HERE / "query-coverage.toml")
    except manifest.Invalid as reason:
        print(reason, file=sys.stderr)
        return 1

    counts = {"pass": 0, "known": 0, "environmental": 0}
    items = []

    # An orphan is a finding, not a printed aside. Inside release-check this
    # runner's output is one of several multi-minute logs, and a list that
    # scrolls past a step reporting ok is not the visible trace the manifest
    # diff is supposed to leave. Recording it here puts it in the findings file
    # and makes the run exit non-zero.
    for name in manifest.orphans(entries, commands):
        counts.setdefault("stale entry", 0)
        counts["stale entry"] += 1
        items.append(findings.Finding(
            page="query-coverage.toml", anchor="", method=name,
            claim=entries[name].get("note", ""), sent=None,
            response="the manifest names a method the pages no longer document; "
                     "delete the entry",
            verdict="stale-manifest-entry", manifest_entry=name,
        ))
        print(f"  STALE   {name:52} no matching method, delete the entry")

    for target in sorted(commands):
        page, block = commands[target]
        entry = entries.get(target, {})

        try:
            payload = pagefill.fill(block["example"] or {}, page, values, block["fields"])
        except pagefill.Unfillable as reason:
            if entry.get("expect") == "unfillable":
                counts["known"] += 1
                print(f"  KNOWN   {target:52} {entry.get('note', '')[:56]}")
            else:
                claim = reason.note
                items.append(findings.Finding(
                    page=page["name"], anchor=block["anchor"], method=target, claim=claim,
                    sent=None, response=str(reason), verdict="unfillable",
                    manifest_entry=target if entry else None,
                ))
                print(f"  UNFILL  {target:52} {reason}")
            continue

        if entry.get("expect") == "unfillable":
            # The manifest says a reader cannot fill this query, and it just
            # filled. Running it anyway would pass and hide the drift, which is
            # usually upstream supplying the form the page was missing. What is
            # wrong now is the recorded expectation, so that is what is reported.
            counts.setdefault("stale entry", 0)
            counts["stale entry"] += 1
            items.append(findings.Finding(
                page=page["name"], anchor=block["anchor"], method=target,
                claim=entry.get("note", ""), sent=payload,
                response="the manifest records this as unfillable, but the page filled it; "
                         "delete the entry or give it an outcome",
                verdict="stale-manifest-entry", manifest_entry=target,
            ))
            print(f"  STALE   {target:52} recorded unfillable, but it filled")
            continue

        command = ["grpcurl", "-plaintext"]
        if block["example"] is not None:
            command += ["-d", json.dumps(payload)]
        command += [args.grpc, target]

        result = subprocess.run(command, capture_output=True, text=True, timeout=60)
        output = (result.stdout + result.stderr).strip()

        verdict = manifest.classify(output, errors)

        if result.returncode == 0 and verdict != "malformed":
            if entry.get("expect") == "known-failure":
                # Recorded as failing, and it succeeded. Counting it as a plain
                # PASS would leave a stale exception in the manifest forever,
                # understating what the documentation already gets right.
                counts.setdefault("stale entry", 0)
                counts["stale entry"] += 1
                items.append(findings.Finding(
                    page=page["name"], anchor=block["anchor"], method=target,
                    claim=entry.get("note", ""), sent=payload if block["example"] is not None else None,
                    response="the manifest records this as a known failure, but it succeeded; "
                             "delete the entry",
                    verdict="stale-manifest-entry", manifest_entry=target,
                ))
                print(f"  STALE   {target:52} recorded known-failure, but it succeeded")
                continue
            counts["pass"] += 1
            print(f"  PASS    {target:52} ok")
        elif verdict == "environmental":
            counts["environmental"] += 1
            print(f"  SKIP    {target:52} chain state or module not registered")
        elif entry.get("expect") == "known-failure":
            counts["known"] += 1
            print(f"  KNOWN   {target:52} {entry.get('note', '')[:56]}")
        else:
            sent = payload if block["example"] is not None else None
            items.append(findings.Finding(
                page=page["name"], anchor=block["anchor"], method=target,
                claim=findings.claim_for(block["fields"], sent),
                sent=sent,
                response=output.splitlines()[-1][:150],
                verdict="page-defect" if verdict == "malformed" else "unclassified",
                manifest_entry=target if entry else None,
            ))
            label = "UNCLASS" if verdict == "unclassified" else "FAIL"
            print(f"  {label:7} {target:52} {output.splitlines()[-1][:56]}")

    items.extend(assertions(args.grpc, args.rest, values, counts))

    repository, sha, ref = pagefill.generated_from(args.version)
    document = findings.document(args.version, repository, ref, sha, "query-onchain", counts, items)
    findings.write(args.findings, document)
    print()
    print(findings.render(document))
    return 1 if document["totals"]["findings"] else 0


if __name__ == "__main__":
    sys.exit(main())
