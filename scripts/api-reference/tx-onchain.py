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
import urllib.request
from pathlib import Path

import findings
import manifest
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


def broadcast(simd, home, chain_id, key, node, message, denom) -> tuple[int, str]:
    """Build, sign and broadcast one message, exactly as the transactions page describes."""
    # The fee denom is the chain's, not a constant: a hardcoded one turns every
    # message on a chain that names its stake token differently into a fee
    # failure, which reads as a documentation defect and is not one.
    document = {
        "body": {"messages": [message], "memo": "", "timeout_height": "0",
                 "extension_options": [], "non_critical_extension_options": []},
        "auth_info": {"signer_infos": [],
                      "fee": {"amount": [{"denom": denom, "amount": "5000"}],
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="latest", choices=["latest", "next"])
    parser.add_argument("--simd", required=True)
    parser.add_argument("--home", required=True)
    parser.add_argument("--chain-id", required=True)
    parser.add_argument("--from", dest="key", default="alice")
    parser.add_argument("--second-key", default="bob")
    parser.add_argument("--validator-key", default=None,
                        help="key behind the validator operator account; defaults to --from")
    parser.add_argument("--node", default="tcp://localhost:26657")
    parser.add_argument("--rest", default="http://localhost:1317")
    parser.add_argument("--only", default=None, help="substring filter, for iterating")
    parser.add_argument("--findings", default="findings-tx-onchain.json")
    args = parser.parse_args()

    def address_of(name, bech="acc"):
        out = subprocess.run(
            [args.simd, "keys", "show", name, "-a", "--bech", bech,
             "--keyring-backend", "test", "--home", args.home],
            capture_output=True, text=True)
        return out.stdout.strip()

    with urllib.request.urlopen(
        f"{args.rest}/cosmos/staking/v1beta1/validators?pagination.limit=1", timeout=20
    ) as r:
        validators = json.load(r).get("validators", [])
    validator = validators[0]["operator_address"] if validators else ""

    fixtures = discover(args.rest, address_of(args.key), address_of(args.second_key), validator)

    def resolve_validator_key() -> str:
        """The key behind the validator operator address, verified, not assumed.

        Two entries exist precisely to assert that a validator-only message is
        signed by the validator's own account and not an arbitrary one. Quietly
        falling back to --from would sign them with an arbitrary account, and
        they would be recorded as page defects when the page is fine. So the
        claim is checked against the chain and a mismatch is fatal.
        """
        candidate = args.validator_key or args.key
        if not validator:
            raise SystemExit(
                "the coverage file uses signer = \"validator\" but the chain reports no "
                "validator; point --rest at a chain that has one"
            )
        if address_of(candidate, bech="val") != validator:
            raise SystemExit(
                f"--validator-key {candidate!r} is not the account behind {validator}. "
                "Two entries assert that a validator-only message is signed by the "
                "validator's own account; signing them with another account would "
                "record a page defect that is not one. Pass the operator's key."
            )
        return candidate

    def signer_for(entry):
        """Which key signs, given the manifest may name a role rather than a key.

        A validator-only message has to be signed by whoever operates the
        validator, and that is a fact about the chain under test, not about the
        page. Naming the role keeps a key from one machine's keyring out of the
        manifest.
        """
        name = entry.get("signer")
        if name is None:
            return args.key
        if name == "validator":
            return resolve_validator_key()
        return name

    pages = {}
    for path, page in pagefill.pages_for(args.version):
        for type_url, block in pagefill.transactions_on(page, path):
            pages[type_url] = {**block, "page": page}

    try:
        pagefill.assert_complete(args.version, pages, "messages")
    except pagefill.Incomplete as reason:
        print(f"\n{reason}", file=sys.stderr)
        return 1

    try:
        entries = manifest.load(HERE / "tx-coverage.toml", manifest.TX_VOCABULARY,
                                default="success")
    except manifest.Invalid as reason:
        print(reason, file=sys.stderr)
        return 1

    counts = {"success": 0, "unauthorized": 0, "state-error": 0, "skip": 0}
    items = []

    # Drift both ways. A message added upstream is exercised with defaults; an
    # entry whose message is gone is a finding rather than a printed aside.
    # Inside release-check this runner's output is one of several multi-minute
    # logs, and a list that scrolls past a step reporting ok is not the visible
    # trace the manifest diff is supposed to leave, so recording it here puts it
    # in the findings file and makes the run exit non-zero.
    for name in manifest.orphans(entries, pages):
        counts.setdefault("stale entry", 0)
        counts["stale entry"] += 1
        items.append(findings.Finding(
            page="tx-coverage.toml", anchor="", method=name,
            claim=entries[name].get("note", ""), sent=None,
            response="the manifest names a message the pages no longer document; "
                     "delete the entry",
            verdict="stale-manifest-entry", manifest_entry=name,
        ))
        print(f"  STALE       {name:52} no matching message, delete the entry")

    order = []
    for name in sorted(pages):
        for prerequisite in entries.get(name, {}).get("requires", []):
            if prerequisite in pages and prerequisite not in order:
                order.append(prerequisite)
        if name not in order:
            order.append(name)

    # Resolved before anything is broadcast, not lazily inside the loop. A
    # mismatch raises SystemExit, and raising it partway through would abandon
    # the run after messages had already gone to the chain, with findings.write
    # never reached: release-check would then point the operator at a findings
    # file still holding the previous run's contents.
    selected = [name for name in order if not args.only or args.only in name]
    if any(entries.get(name, {}).get("signer") == "validator" for name in selected):
        resolve_validator_key()

    for name in order:
        if args.only and args.only not in name:
            continue
        page, entry = pages[name], entries.get(name, {})
        expect = entry.get("expect", "success")

        try:
            body = pagefill.fill(page["example"], page["page"], fixtures, page["fields"])
        except pagefill.Unfillable as reason:
            if entry.get("expect") == "unfillable":
                counts.setdefault("known gap", 0)
                counts["known gap"] += 1
                print(f"  KNOWN GAP   {name:52} {entry.get('note', '')[:52]}")
            else:
                claim = reason.note
                items.append(findings.Finding(
                    page=page["page"]["name"], anchor=page["anchor"], method=name, claim=claim,
                    sent=None, response=str(reason), verdict="unfillable",
                    manifest_entry=name if entry else None,
                ))
                print(f"  UNFILLABLE  {name:52} {reason}")
            continue

        if expect == "unfillable":
            # The manifest says a reader cannot fill this message, and it just
            # filled. That is the drift the manifest exists to surface, usually
            # upstream adding the example the page was missing. Reported rather
            # than broadcast: the recorded expectation is what is now wrong.
            counts.setdefault("stale entry", 0)
            counts["stale entry"] += 1
            items.append(findings.Finding(
                page=page["page"]["name"], anchor=page["anchor"], method=name,
                claim=entry.get("note", ""), sent=body,
                response="the manifest records this as unfillable, but the page filled it; "
                         "delete the entry or give it an outcome",
                verdict="stale-manifest-entry", manifest_entry=name,
            ))
            print(f"  STALE       {name:52} recorded unfillable, but it filled")
            continue

        if expect == "skip":
            counts["skip"] += 1
            print(f"  SKIP        {name:52} {entry.get('note', '')[:60]}")
            continue

        signer = signer_for(entry)
        signer_address = address_of(signer)
        before = current_sequence(args.rest, signer_address)
        code, log = broadcast(args.simd, args.home, args.chain_id, signer, args.node, body,
                              fixtures["denom"])
        if code == 0:
            wait_for_sequence(args.rest, signer_address, before)
        unauthorized = "unauthorized" in log or "invalid authority" in log

        if expect == "success":
            ok = code == 0
        elif expect == "unauthorized":
            ok = unauthorized
        else:
            ok = code != 0 and not unauthorized

        counts[expect] = counts.get(expect, 0) + ok
        verdict = "PASS" if ok else "FAIL"
        print(f"  {verdict:11} {name:52} code={code} {log[:60]}")
        if not ok:
            items.append(findings.Finding(
                page=page["page"]["name"], anchor=page["anchor"], method=name,
                claim=findings.claim_for(page["fields"], body),
                sent=body, response=f"expected {expect}, got code {code}: {log}",
                verdict="page-defect", manifest_entry=name if entry else None,
            ))

    repository, sha, ref = pagefill.generated_from(args.version)
    document = findings.document(args.version, repository, ref, sha, "tx-onchain", counts, items)
    findings.write(args.findings, document)
    print()
    print(findings.render(document))
    return 1 if document["totals"]["findings"] else 0


if __name__ == "__main__":
    sys.exit(main())
