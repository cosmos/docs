"""The coverage manifest: what the runners cannot derive.

One schema for both runners. Every entry is a statement that something cannot
work as written, with a reason, so a run's output is what changed rather than
the same list every time. Where a reason is fixable it should be fixed instead
of recorded here.
"""

import tomllib
from pathlib import Path

QUERY_VOCABULARY = {"unfillable", "known-failure"}
TX_VOCABULARY = {"success", "unauthorized", "state-error", "skip", "unfillable"}

LEGACY_TABLES = ("queries", "messages", "unfillable")


class Invalid(Exception):
    """The manifest does not match the schema."""


def load(path: Path, vocabulary: set, default: str | None = None) -> dict:
    if not Path(path).exists():
        raise Invalid(f"{path} does not exist")

    document = tomllib.loads(Path(path).read_text())

    for table in LEGACY_TABLES:
        if table in document:
            raise Invalid(
                f"{path} has a legacy [{table}] table; entries belong under [cases.\"name\"]"
            )

    entries = document.get("cases", {})
    for name, entry in entries.items():
        entry.setdefault("expect", default)
        if entry["expect"] not in vocabulary:
            raise Invalid(
                f"{path}: {name} has expect = {entry['expect']!r}, "
                f"which is not one of {sorted(vocabulary)}"
            )
        # An entry whose only content is a prerequisite states an ordering, not
        # an exception, so it needs no reason. Anything else does: an exception
        # without a stated reason cannot be told apart from an oversight.
        claims_more = set(entry) - {"expect", "requires", "signer"} or entry["expect"] != default
        if claims_more and not entry.get("note"):
            raise Invalid(f"{path}: {name} has no note, so its reason is not stated")

    return entries


def orphans(entries: dict, documented) -> list:
    """Manifest entries naming something the pages no longer document."""
    return sorted(set(entries) - set(documented))


def load_errors(path: Path) -> dict:
    """Error substrings that decide whether a failure is the page's fault.

    Data rather than code, because they are tuned to one chain's wording and
    will drift when the SDK rewords an error.
    """
    document = tomllib.loads(Path(path).read_text())
    errors = document.get("errors", {})
    for key in ("malformed", "environmental"):
        if not errors.get(key):
            raise Invalid(f"{path} has no [errors] {key} list")
    return errors


def classify(output: str, errors: dict) -> str:
    """Whether a failing command failed on its own arguments.

    An error matching nothing is unclassified, not assumed benign. A release
    that rewords an error should be visible rather than silently rebucketed.
    """
    low = output.lower()
    if any(m in low for m in errors["malformed"]):
        return "malformed"
    if any(m in low for m in errors["environmental"]):
        return "environmental"
    return "unclassified"
