#!/usr/bin/env python3
"""Read Cosmos Hub software upgrades from the chain.

Asks every REST endpoint in endpoints.json for the same facts and keeps an
answer only when at least two endpoints run by different operators agree on
it. An endpoint counts only when it serves the expected chain id and its latest
block is recent, so a stalled node or a node on the wrong network can never
decide anything on its own.

    python3 scripts/hub/detect-upgrade.py --network mainnet
    python3 scripts/hub/detect-upgrade.py --network testnet --json state.json

Prints one JSON document: the agreed height and block time, the average block
time, every software upgrade proposal with its plan, an estimated upgrade time
for plans not yet reached, and the height each plan was applied at (0 when it
has not run yet).
"""

import argparse
import json
import re
import sys
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
UPGRADE_MSG = "/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade"
FRESH_SECONDS = 300
SAMPLE_BLOCKS = 10000
TIMEOUT = 15


def get(base, path):
    req = urllib.request.Request(base.rstrip("/") + path, headers={"User-Agent": "cosmos-docs-hub-upgrade-check"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.load(resp)


def parse_time(value):
    # Node timestamps carry nanoseconds; datetime takes microseconds.
    head, _, frac = value.rstrip("Z").partition(".")
    return datetime.fromisoformat(head + ("." + frac[:6] if frac else "")).replace(tzinfo=timezone.utc)


def upgrade_proposals(base):
    """Software upgrade proposals, newest first, from the gov v1 API."""
    data = get(base, "/cosmos/gov/v1/proposals?pagination.reverse=true&pagination.limit=50")
    found = []
    for prop in data.get("proposals", []):
        for msg in prop.get("messages", []):
            if msg.get("@type") != UPGRADE_MSG:
                continue
            plan = msg.get("plan", {})
            found.append({
                "proposal_id": int(prop["id"]),
                "status": prop["status"].replace("PROPOSAL_STATUS_", ""),
                "title": prop.get("title", ""),
                "expedited": bool(prop.get("expedited")),
                "voting_end_time": prop.get("voting_end_time"),
                "plan_name": plan.get("name"),
                "plan_height": int(plan.get("height", 0)),
                "plan_info": plan.get("info", ""),
            })
    return found


def binaries(info):
    """The binaries map from a plan's info field, when it holds one."""
    try:
        return json.loads(info).get("binaries", {})
    except (ValueError, AttributeError):
        return {}


def release_tag(bins):
    """The gaia release tag in the plan's download URLs, if they agree on one."""
    tags = {m.group(1) for url in bins.values() for m in [re.search(r"/releases/download/([^/]+)/", url)] if m}
    return tags.pop() if len(tags) == 1 else None


def read_endpoint(ep, chain_id, now):
    out = {"operator": ep["operator"], "url": ep["url"], "fresh": False}
    try:
        header = get(ep["url"], "/cosmos/base/tendermint/v1beta1/blocks/latest")["block"]["header"]
        out["chain_id"] = header["chain_id"]
        out["height"] = int(header["height"])
        out["time"] = header["time"]
        age = (now - parse_time(header["time"])).total_seconds()
        if header["chain_id"] != chain_id:
            out["error"] = f"serves {header['chain_id']}, expected {chain_id}"
            return out
        if age > FRESH_SECONDS:
            out["error"] = f"latest block is {int(age)} seconds old"
            return out
        out["fresh"] = True
        out["proposals"] = upgrade_proposals(ep["url"])
        out["current_plan"] = get(ep["url"], "/cosmos/upgrade/v1beta1/current_plan").get("plan")
        out["applied"] = {}
        for prop in out["proposals"]:
            name = prop["plan_name"]
            if name and name not in out["applied"]:
                applied = get(ep["url"], f"/cosmos/upgrade/v1beta1/applied_plan/{name}")
                out["applied"][name] = int(applied.get("height", 0))
        older = max(out["height"] - SAMPLE_BLOCKS, 1)
        then = get(ep["url"], f"/cosmos/base/tendermint/v1beta1/blocks/{older}")["block"]["header"]["time"]
        out["block_seconds"] = (parse_time(header["time"]) - parse_time(then)).total_seconds() / (out["height"] - older)
    except Exception as exc:  # any failure only removes this endpoint from the vote
        out["fresh"] = False
        out["error"] = f"{type(exc).__name__}: {exc}"
    return out


def agreed(endpoints, key):
    """The value at least two fresh endpoints from different operators return."""
    votes = Counter()
    operators = {}
    for ep in endpoints:
        if not ep["fresh"] or key not in ep:
            continue
        blob = json.dumps(ep[key], sort_keys=True)
        if ep["operator"] in operators.setdefault(blob, set()):
            continue
        operators[blob].add(ep["operator"])
        votes[blob] += 1
    if not votes:
        return False, None
    blob, count = votes.most_common(1)[0]
    return (count >= 2), (json.loads(blob) if count >= 2 else None)


def detect(network, config):
    net = config[network]
    now = datetime.now(timezone.utc)
    endpoints = [read_endpoint(ep, net["chain_id"], now) for ep in net["rest"]]
    fresh = [ep for ep in endpoints if ep["fresh"]]

    ok_props, props = agreed(endpoints, "proposals")
    ok_plan, _ = agreed(endpoints, "current_plan")
    current_plan = next((ep["current_plan"] for ep in fresh), None) if ok_plan else None
    ok_applied, applied = agreed(endpoints, "applied")

    height = min((ep["height"] for ep in fresh), default=None)
    block_time = min((ep["time"] for ep in fresh), default=None)
    seconds = sorted(ep["block_seconds"] for ep in fresh if "block_seconds" in ep)
    block_seconds = seconds[len(seconds) // 2] if seconds else None

    upgrades = []
    for prop in props or []:
        item = dict(prop, binaries=binaries(prop.pop("plan_info")))
        item["release"] = release_tag(item["binaries"])
        item["applied_height"] = (applied or {}).get(prop["plan_name"]) if ok_applied else None
        if height and block_seconds and item["plan_height"] > height:
            eta = parse_time(block_time) + timedelta(seconds=(item["plan_height"] - height) * block_seconds)
            item["estimated_time"] = eta.strftime("%Y-%m-%dT%H:%M:%SZ")
        upgrades.append(item)

    return {
        "network": network,
        "chain_id": net["chain_id"],
        "checked_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "agreed": ok_props and ok_plan and ok_applied,
        "fresh_endpoints": len(fresh),
        "height": height,
        "block_time": block_time,
        "block_seconds": round(block_seconds, 3) if block_seconds else None,
        "current_plan": current_plan,
        "upgrades": upgrades,
        "endpoints": [
            {k: ep.get(k) for k in ("operator", "url", "fresh", "height", "time", "error") if ep.get(k) is not None}
            for ep in endpoints
        ],
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--network", choices=["mainnet", "testnet"], default="mainnet")
    ap.add_argument("--config", default=str(HERE / "endpoints.json"))
    ap.add_argument("--json", help="also write the result to this file")
    args = ap.parse_args()

    state = detect(args.network, json.loads(Path(args.config).read_text()))
    text = json.dumps(state, indent=2)
    print(text)
    if args.json:
        Path(args.json).write_text(text + "\n")
    return 0 if state["agreed"] else 2


if __name__ == "__main__":
    sys.exit(main())
