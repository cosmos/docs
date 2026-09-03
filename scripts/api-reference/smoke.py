#!/usr/bin/env python3
"""Run a representative sample of the reference's own commands against a chain.

The other checks verify structure: that examples parse, that schemas match
responses. This checks the thing neither can, which is whether a command a
reader copies actually works.

It is deliberately a sample rather than an exhaustive run. Every defect found so
far has been a class rather than an instance, because a generator makes the same
mistake everywhere, so a dozen commands spanning the distinct shapes finds what
137 would. Exhaustive execution also cannot tell a wrong documented value from
missing chain state, which is the limit worth being honest about.

Point it at a local simapp: it runs the documented SDK version and registers
every module, so a failure is a real defect rather than version skew.

Usage:
    python3 smoke.py --grpc localhost:9090 --rest http://localhost:1317
"""

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent

# Errors that mean the request itself was malformed. These are documentation
# defects. Anything else, including "not found" or a business rule, means the
# request was well formed and the chain simply had nothing to say.
MALFORMED = (
    "invalid character",
    "illegal base64",
    "unknown field",
    "invalid value for enum",
    "hrp does not match",
    "cannot unmarshal",
    "invalid validator status",
    "expecting number",
    "bad input",
    "unable to resolve type",
    "no such method",
    "not expose service",
)


def run(command: list[str]) -> tuple[int, str]:
    result = subprocess.run(command, capture_output=True, text=True, timeout=60)
    return result.returncode, (result.stdout + result.stderr).strip()


def fetch(url: str) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()
    except Exception as error:  # noqa: BLE001
        return 0, str(error)


def discover(rest: str) -> dict:
    """Real values for a chain we did not create, learned from the chain."""
    fixtures = {}
    _, body = fetch(f"{rest}/cosmos/staking/v1beta1/params")
    fixtures["denom"] = json.loads(body)["params"]["bond_denom"]

    _, body = fetch(f"{rest}/cosmos/staking/v1beta1/validators?pagination.limit=1")
    validators = json.loads(body).get("validators", [])
    if validators:
        fixtures["validator"] = validators[0]["operator_address"]

    _, body = fetch(f"{rest}/cosmos/auth/v1beta1/accounts?pagination.limit=5")
    for account in json.loads(body).get("accounts", []):
        address = account.get("address") or account.get("base_account", {}).get("address")
        if address and address.startswith("cosmos1"):
            fixtures["address"] = address
            break
    return fixtures


def cases(grpc: str, rest: str, f: dict) -> list[tuple[str, str, list[str] | str]]:
    """One case per distinct shape the reference documents.

    Chosen so that each covers something a different check cannot: a reflection
    recipe from the prose, an enum request value, a paginated round trip, the two
    address spaces, a decimal encoding, and the claim that Msg is not served.
    """
    g = ["grpcurl", "-plaintext"]
    return [
        # The reflection recipes the gRPC intro tells a newcomer to start with.
        ("reflection: list services", "grpc", g + [grpc, "list"]),
        ("reflection: describe a method", "grpc",
         g + [grpc, "describe", "cosmos.bank.v1beta1.Query.AllBalances"]),

        # A query with no arguments, the simplest documented shape.
        ("query with no arguments", "grpc",
         g + [grpc, "cosmos.staking.v1beta1.Query/Pool"]),

        # An enum request value: the page must give one that works.
        ("enum request value", "grpc",
         g + ["-d", '{"status":"BOND_STATUS_BONDED","pagination":{"limit":"1"}}',
              grpc, "cosmos.staking.v1beta1.Query/Validators"]),

        # The generated pagination stanza, which must not set key and offset together.
        ("generated pagination stanza", "grpc",
         g + ["-d", '{"pagination":{"limit":"1"}}', grpc,
              "cosmos.bank.v1beta1.Query/DenomsMetadata"]),

        # An account address where an account address belongs.
        ("account address", "grpc",
         g + ["-d", json.dumps({"address": f.get("address", "")}), grpc,
              "cosmos.bank.v1beta1.Query/AllBalances"]),

        # A validator operator address, a different address space.
        ("validator operator address", "grpc",
         g + ["-d", json.dumps({"validator_addr": f.get("validator", "")}), grpc,
              "cosmos.staking.v1beta1.Query/Validator"]),

        # The documented failure when the two address spaces are confused.
        ("crossed address spaces are rejected", "grpc-expect-error",
         g + ["-d", json.dumps({"validator_addr": f.get("address", "")}), grpc,
              "cosmos.staking.v1beta1.Query/Validator"]),

        # Msg is not served on the gRPC query router, as the reference states.
        ("Msg is not served on 9090", "grpc-expect-error",
         g + ["-d", "{}", grpc, "cosmos.bank.v1beta1.Msg/Send"]),

        # A decimal-carrying response, where the encoding claim can be checked.
        ("decimal encoding over gRPC", "grpc",
         g + [grpc, "cosmos.mint.v1beta1.Query/Params"]),

        # The same field over REST, which the page says is always a decimal string.
        ("decimal encoding over REST", "rest", f"{rest}/cosmos/mint/v1beta1/params"),

        # A REST route with a path parameter.
        ("REST path parameter", "rest",
         f"{rest}/cosmos/bank/v1beta1/balances/{f.get('address', '')}"),

        # The node config the transactions page points at for minimum gas price.
        ("node config for gas price", "grpc",
         g + [grpc, "cosmos.base.node.v1beta1.Service/Config"]),

        # Chain id discovery, which signing needs.
        ("chain id discovery", "grpc",
         g + [grpc, "cosmos.base.tendermint.v1beta1.Service/GetNodeInfo"]),

        # Account number and sequence discovery, the other half of signing.
        ("account number discovery", "grpc",
         g + ["-d", json.dumps({"address": f.get("address", "")}), grpc,
              "cosmos.auth.v1beta1.Query/AccountInfo"]),
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--grpc", default="localhost:9090")
    parser.add_argument("--rest", default="http://localhost:1317")
    args = parser.parse_args()

    print(f"Discovering fixtures from {args.rest}")
    try:
        fixtures = discover(args.rest)
    except Exception as error:  # noqa: BLE001
        print(f"  could not reach the chain: {error}", file=sys.stderr)
        print("  start a local simapp with its API and gRPC servers enabled", file=sys.stderr)
        return 1
    for name, value in fixtures.items():
        print(f"  {name}: {value}")
    print()

    failures = []
    for name, kind, command in cases(args.grpc, args.rest, fixtures):
        if kind == "rest":
            status, output = fetch(command)
            ok = status == 200
            detail = f"HTTP {status}"
        else:
            code, output = run(command)
            malformed = any(m in output.lower() for m in MALFORMED)
            if kind == "grpc-expect-error":
                # The reference claims this fails. Succeeding would mean the
                # documentation is wrong in the other direction.
                ok = code != 0
                detail = "rejected as documented" if ok else "unexpectedly succeeded"
            else:
                ok = code == 0 and not malformed
                detail = "ok" if ok else output.splitlines()[0][:90] if output else "failed"

        print(f"  {'PASS' if ok else 'FAIL'}  {name:38} {detail}")
        if not ok:
            failures.append((name, output[:300]))

    print()
    if failures:
        print(f"{len(failures)} of {len(cases(args.grpc, args.rest, fixtures))} failed:\n")
        for name, output in failures:
            print(f"  {name}\n    {output}\n")
        return 1

    print(f"all {len(cases(args.grpc, args.rest, fixtures))} passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
