"""The structured result of a runner.

One document per run, with the terminal summary rendered from it rather than
printed alongside it, so what a person reads and what a later repair step
consumes cannot disagree.

The document is a run artifact. It is never committed: it describes one chain
at one moment, and a committed copy would go stale silently.
"""

import json
from dataclasses import dataclass, asdict
from pathlib import Path

# "stale-manifest-entry" is about the manifest rather than the page: what the
# manifest records is no longer true of the documentation, usually because
# upstream supplied what a page was missing. Surfacing that is the whole point
# of diffing the manifest against the pages every run.
VERDICTS = ("page-defect", "unfillable", "environmental", "known", "unclassified",
            "stale-manifest-entry")


@dataclass
class Finding:
    page: str
    anchor: str
    method: str
    claim: str
    sent: dict | None
    response: str
    verdict: str
    manifest_entry: str | None


def claim_for(fields: dict, sent: dict | None) -> str:
    """What the page told the reader to put in the fields that were actually sent.

    A finding whose claim is empty is not the contract DESIGN.md section 5
    describes: a repair step reading the file has to be told what the page said
    before it can decide whether the page or the chain is wrong. The page's own
    field table is in hand wherever a chain rejection is recorded, so the notes
    for the fields present in the payload are joined and carried along.
    """
    if not sent or not fields:
        return ""
    notes = []
    for key in sent:
        note = fields.get(key, ("", ""))[0]
        if note:
            notes.append(f"{key}: {note}")
    return " ".join(notes)


def document(version: str, repository: str, ref: str, sha: str, runner: str,
             totals: dict, items) -> dict:
    items = list(items)
    for item in items:
        if item.verdict not in VERDICTS:
            raise ValueError(f"{item.verdict!r} is not one of {VERDICTS}")

    return {
        "version": version,
        "repository": repository,
        "ref": ref,
        "sha": sha,
        "runner": runner,
        "totals": {**totals, "findings": len(items)},
        "findings": [asdict(item) for item in items],
    }


def write(path, document: dict) -> None:
    Path(path).write_text(f"{json.dumps(document, indent=2, sort_keys=False)}\n")


def render(document: dict) -> str:
    totals = ", ".join(f"{value} {key}" for key, value in document["totals"].items() if value)
    lines = [
        f"{document['runner']} on {document['version']} at "
        f"{document['repository']}@{document['ref']} ({document['sha'][:12]}): {totals}"
    ]

    if not document["findings"]:
        lines.append("no findings")
        return "\n".join(lines)

    for item in document["findings"]:
        lines.append(f"\n  {item['page']}{item['anchor']}  {item['method']}")
        lines.append(f"    verdict  {item['verdict']}")
        if item["claim"]:
            lines.append(f"    page says  {item['claim']}")
        if item["sent"] is not None:
            lines.append(f"    sent  {json.dumps(item['sent'])}")
        lines.append(f"    chain said  {item['response']}")

    return "\n".join(lines)
