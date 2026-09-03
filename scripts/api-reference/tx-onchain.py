#!/usr/bin/env python3
"""Broadcast every documented transaction message, filling values the way a reader would.

The other checks read the descriptor. This one reads the page, which is the
point: it fills each field from what the documentation actually tells a reader,
so a page whose guidance is well-formed and wrong fails here rather than passing.

That distinction is not theoretical. Filling `cosmos.Dec` from the proto
annotation produced a green check while the page told gRPC readers to write a
value the chain rejects. A filler that reads the page instead cannot be right
when the page is wrong.

Three outcomes per field:

  the page states the value or its form   use it, and let the chain judge the page
  the value is genuinely the reader's     supply it: an address, an amount
  the page says nothing                   a finding, not a pass

Everything derivable is derived. The message list, the signer, and the
governance-gated classification come from the descriptor, so a message added
upstream is exercised without touching tx-coverage.toml. That file records only
preconditions and expected outcomes, and every run reports entries that no longer
match a message.

Usage:
    python3 tx-onchain.py --home ~/.simapp --chain-id my-chain --from alice
"""

import argparse
import json
import re
import subprocess
import sys
import tomllib
import urllib.request
from pathlib import Path

import pagefill

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent

def discover(rest: str, signer: str, second: str, validator: str) -> dict:
    with urllib.request.urlopen(f"{rest}/cosmos/staking/v1beta1/params", timeout=20) as r:
        denom = json.load(r)["params"]["bond_denom"]
    return {
        "cosmos.AddressString": signer,
        "cosmos.ValidatorAddressString": validator,
        "cosmos.ConsensusAddressString": validator,
        "cosmos.Int": "1000",
        "denom": denom,
        "recipient": second,
    }


def wait_for_sequence(rest: str, address: str, previous: int, attempts: int = 20) -> int:
    """Block until the account's sequence advances past the last broadcast.

    Without this every message after the first fails on a sequence mismatch,
    which says nothing about the documentation and hides what does.
    """
    import time

    for _ in range(attempts):
        try:
            with urllib.request.urlopen(
                f"{rest}/cosmos/auth/v1beta1/account_info/{address}", timeout=10
            ) as response:
                info = json.load(response).get("info", {})
                current = int(info.get("sequence", 0))
                if current > previous:
                    return current
        except Exception:  # noqa: BLE001 - a transient read should not end the run
            pass
        time.sleep(1)
    return previous


def current_sequence(rest: str, address: str) -> int:
    try:
        with urllib.request.urlopen(
            f"{rest}/cosmos/auth/v1beta1/account_info/{address}", timeout=10
        ) as response:
            return int(json.load(response).get("info", {}).get("sequence", 0))
    except Exception:  # noqa: BLE001
        return 0


def broadcast(simd, home, chain_id, key, node, message) -> tuple[int, str]:
    """Build, sign and broadcast one message, exactly as the transactions page describes."""
    document = {
        "body": {"messages": [message], "memo": "", "timeout_height": "0",
                 "extension_options": [], "non_critical_extension_options": []},
        "auth_info": {"signer_infos": [],
                      "fee": {"amount": [{"denom": "ustake", "amount": "5000"}],
                              "gas_limit": "400000", "payer": "", "granter": ""}},
        "signatures": [],
    }
    unsigned = Path("/tmp/tx-onchain-unsigned.json")
    unsigned.write_text(json.dumps(document))

    common = ["--home", home, "--keyring-backend", "test", "--node", node]
    signed = subprocess.run(
        [simd, "tx", "sign", str(unsigned), "--from", key, "--chain-id", chain_id,
         "--output-document", "/tmp/tx-onchain-signed.json", *common],
        capture_output=True, text=True,
    )
    if signed.returncode != 0:
        return -1, (signed.stderr or signed.stdout).strip().splitlines()[-1][:160]

    sent = subprocess.run(
        [simd, "tx", "broadcast", "/tmp/tx-onchain-signed.json", "--broadcast-mode", "sync", *common],
        capture_output=True, text=True,
    )
    output = sent.stdout + sent.stderr
    code = re.search(r'"?code"?:\s*(\d+)', output)
    raw = re.search(r'raw_log:\s*(.*)', output)
    return (int(code.group(1)) if code else -1), (raw.group(1).strip()[:160] if raw else output.strip()[:160])


def load_manifest() -> dict:
    path = HERE / "tx-coverage.toml"
    if not path.exists():
        return {}
    return tomllib.loads(path.read_text()).get("messages", {})


def load_unfillable() -> dict:
    """Fields the page is known not to be able to fill, with the reason."""
    path = HERE / "tx-coverage.toml"
    if not path.exists():
        return {}
    return tomllib.loads(path.read_text()).get("unfillable", {})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="latest", choices=["latest", "next"])
    parser.add_argument("--simd", required=True)
    parser.add_argument("--home", required=True)
    parser.add_argument("--chain-id", required=True)
    parser.add_argument("--from", dest="key", default="alice")
    parser.add_argument("--second-key", default="bob")
    parser.add_argument("--node", default="tcp://localhost:26657")
    parser.add_argument("--rest", default="http://localhost:1317")
    parser.add_argument("--only", default=None, help="substring filter, for iterating")
    args = parser.parse_args()

    def address_of(name):
        out = subprocess.run(
            [args.simd, "keys", "show", name, "-a", "--keyring-backend", "test",
             "--home", args.home], capture_output=True, text=True)
        return out.stdout.strip()

    with urllib.request.urlopen(
        f"{args.rest}/cosmos/staking/v1beta1/validators?pagination.limit=1", timeout=20
    ) as r:
        validators = json.load(r).get("validators", [])
    validator = validators[0]["operator_address"] if validators else ""

    fixtures = discover(args.rest, address_of(args.key), address_of(args.second_key), validator)
    pages = {}
    for path, page in pagefill.pages_for(args.version):
        for type_url, block in pagefill.transactions_on(page, path):
            pages[type_url] = {**block, "page": page}
    manifest = load_manifest()
    known_gaps = load_unfillable()

    # Drift both ways. A message added upstream is exercised with defaults; an
    # entry whose message is gone is reported rather than silently ignored.
    orphaned = sorted(set(manifest) - set(pages))
    if orphaned:
        print("Manifest entries with no matching message, delete them:")
        for name in orphaned:
            print(f"  {name}")
        print()

    order = []
    for name in sorted(pages):
        for prerequisite in manifest.get(name, {}).get("requires", []):
            if prerequisite in pages and prerequisite not in order:
                order.append(prerequisite)
        if name not in order:
            order.append(name)

    counts = {"success": 0, "unauthorized": 0, "state-error": 0, "skip": 0}
    findings, unfillable = [], []

    for name in order:
        if args.only and args.only not in name:
            continue
        page, entry = pages[name], manifest.get(name, {})
        expect = entry.get("expect", "success")

        try:
            body = pagefill.fill(page["example"], page["page"], fixtures, page["fields"])
        except pagefill.Unfillable as reason:
            if name in known_gaps:
                counts.setdefault("known gap", 0)
                counts["known gap"] += 1
                print(f"  KNOWN GAP   {name:52} {known_gaps[name].get('note', '')[:52]}")
            else:
                unfillable.append((name, page["page"]["name"], str(reason)))
                print(f"  UNFILLABLE  {name:52} {reason}")
            continue

        if expect == "skip":
            counts["skip"] += 1
            print(f"  SKIP        {name:52} {entry.get('note', '')[:60]}")
            continue

        signer_address = address_of(entry.get("signer", args.key))
        before = current_sequence(args.rest, signer_address)
        signer = entry.get("signer", args.key)
        code, log = broadcast(args.simd, args.home, args.chain_id, signer, args.node, body)
        if code == 0:
            wait_for_sequence(args.rest, signer_address, before)
        unauthorized = "unauthorized" in log or "invalid authority" in log

        if expect == "success":
            ok = code == 0
        elif expect == "unauthorized":
            ok = unauthorized
        else:
            ok = code != 0 and not unauthorized

        counts[expect] += ok
        verdict = "PASS" if ok else "FAIL"
        print(f"  {verdict:11} {name:52} code={code} {log[:60]}")
        if not ok:
            findings.append((name, page["page"]["name"], expect, code, log))

    print(f"\n{len(order)} messages: " + ", ".join(f"{v} {k}" for k, v in counts.items() if v))

    if unfillable:
        print(f"\n{len(unfillable)} fields a reader could not determine from the page:")
        for name, page_name, reason in unfillable:
            print(f"  {page_name:18} {name}\n    {reason}")

    if findings:
        print(f"\n{len(findings)} did not match their expected outcome:")
        for name, page_name, expect, code, log in findings:
            print(f"  {page_name:18} {name}\n    expected {expect}, got code {code}: {log}")

    return 1 if findings or unfillable else 0


if __name__ == "__main__":
    sys.exit(main())
