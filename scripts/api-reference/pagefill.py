"""Read the reference pages and fill their examples the way a reader would.

Shared by the two on-chain runners. The rule both follow: a value comes from the
page, or from something the reader legitimately owns, or it is a finding. Nothing
is taken from the proto descriptor, because the descriptor is what the page is
supposed to be explaining. A filler that consults it can be right while the page
is wrong, which is exactly the failure this is built to catch.
"""

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# What a reader brings themselves. Anything else is the page's job to state.
READER_SUPPLIED = {
    "cosmos.AddressString",
    "cosmos.ValidatorAddressString",
    "cosmos.ConsensusAddressString",
    "cosmos.Int",
}

SECTION = re.compile(r"### (?P<title>[\w (),]+)\n(?P<body>.*?)(?=\n### |\n## |\Z)", re.DOTALL)
TYPE_URL = re.compile(r"\| Type URL \| `/(?P<type>[\w.]+)` \|")
GRPC_ROW = re.compile(r"\| gRPC \| `(?P<method>[\w.]+/\w+)` \|")
FIELD_ROW = re.compile(r"^\| `(?P<field>\w+)` \| (?P<type>[^|]+) \| (?P<note>[^|]*) \|$", re.M)
TYPE_LINK = re.compile(r"\(#(?P<anchor>[a-z0-9-]+)\)")
TYPE_HEADING = re.compile(r"^### (?P<name>cosmos[\w.]+)$", re.M)
TX_JSON = re.compile(r"In a transaction:\n\n```json\n(?P<json>.*?)\n```", re.DOTALL)
GRPCURL = re.compile(
    r"```bash\ngrpcurl -plaintext(?: -d '(?P<payload>.*?)' \\\n )? *localhost:9090 "
    r"(?P<target>[\w.]+/\w+)\n```",
    re.DOTALL,
)
ONE_OF = re.compile(r"One of: (?P<options>`/[\w.]+`(?:, `/[\w.]+`)*)")
DEC_NOTE = re.compile(r"Encoded as cosmos\.Dec")
SCALAR_NOTE = re.compile(r"Encoded as (?P<name>cosmos\.\w+)")
ENUM_ROW = re.compile(r"^\| `(?P<value>[A-Z][A-Z0-9_]+)` \|", re.M)


class Unfillable(Exception):
    """The page gives a reader no way to determine this field.

    Carries the field name and, more importantly, the page's own note for
    it, resolved at the raise site against whichever field table was in
    scope there. `fill()` rebinds that table when it recurses into a nested
    type, so a caller resolving the note itself from a top-level table would
    either miss it or, worse, match an unrelated same-named field at the top
    level. Reading `note` off the exception avoids both. `field` and `note`
    are empty only for a whole-example failure not attributable to one key.
    """

    def __init__(self, message: str, field: str | None = None, note: str = ""):
        super().__init__(message)
        self.field = field
        self.note = note


class Incomplete(Exception):
    """The page parse did not cover everything the generator says it documents."""


def assert_complete(version: str, parsed, kind: str) -> None:
    """Every name the generator recorded must appear in the parse.

    The runners derive their own totals from what they parsed, so a regex that
    stops matching would shrink the test set and still exit 0. This turns that
    into a loud failure naming the exact methods.
    """
    path = REPO_ROOT / "sdk" / version / "api-reference" / "inventory.json"
    if not path.exists():
        raise Incomplete(
            f"{path} is missing; regenerate with `npm run sync -- --version {version}`"
        )

    expected = set(json.loads(path.read_text())[kind])
    missing = sorted(expected - set(parsed))
    if missing:
        raise Incomplete(
            f"the page parse found {len(set(parsed))} of {len(expected)} {kind}; "
            f"{len(missing)} missing, so a regex in pagefill.py has stopped matching:\n"
            + "\n".join(f"  {name}" for name in missing)
        )


GENERATED_FROM = re.compile(
    r"Generated from (?P<repository>[\w./-]+) at commit (?P<sha>[0-9a-f]{40}) "
    r"on ref\s+`(?P<ref>[\w./-]+)`"
)


def generated_from(version: str) -> tuple[str, str, str]:
    """Which upstream commit these pages were generated from, and on what ref.

    Recorded in the spec's own description by the generator, so a check cannot
    disagree with the artifact about what it is checking. Returns
    (repository, sha, ref).
    """
    path = REPO_ROOT / "sdk" / version / "api-reference" / "rest" / "openapi.yaml"
    found = GENERATED_FROM.search(path.read_text())
    if not found:
        raise Incomplete(f"{path} does not record the commit and ref it was generated from")
    return found.group("repository"), found.group("sha"), found.group("ref")


def read_page(page: Path) -> dict:
    """Everything one module page says, in the shape the fillers need."""
    text = page.read_text()

    # The Types section: where a reader follows a link to learn what a nested
    # field contains, and where enum values are listed.
    types, enums = {}, {}
    headings = list(TYPE_HEADING.finditer(text))
    for index, heading in enumerate(headings):
        end = headings[index + 1].start() if index + 1 < len(headings) else len(text)
        block = text[heading.end():end]
        name = heading.group("name")
        types[name] = {
            m.group("field"): (m.group("note").strip(), m.group("type").strip())
            for m in FIELD_ROW.finditer(block)
        }
        if "Written as a quoted string" in block:
            values = [v for v in ENUM_ROW.findall(block) if not v.endswith("_UNSPECIFIED")]
            if values:
                enums[name] = values[0]

    return {
        "name": page.name,
        "text": text,
        "types": types,
        "enums": enums,
        # Mintlify slugs a heading by lowercasing and replacing dots, so a link
        # in a Type column maps back to the type it names.
        "by_anchor": {name.lower().replace(".", "-"): name for name in types},
        # The page's own statement of how a Dec is written into a transaction.
        # Read rather than assumed, so the runner is testing that sentence.
        "dec_decimal": 'decimal string such as `"0.05"`' in text,
    }


def anchor_for(title: str) -> str:
    """The anchor Mintlify assigns to a `### ` heading.

    Matches `buildMethodHeadings` in lib/render.js exactly: lowercase, drop
    `(`, `)` and `,`, collapse whitespace to `-`. Most headings are just the
    method name, but gov ships v1 and v1beta1 in one module, so a page can
    hold several `### Deposit` headings disambiguated as `Deposit (Query,
    v1)`; only the generator's own slugging reproduces that anchor.
    """
    return re.sub(r"\s+", "-", re.sub(r"[(),]", "", title.lower()).strip())


def transactions_on(page: dict, source: Path):
    """Every transaction message the page documents, with its example and tables."""
    for block in SECTION.finditer(page["text"]):
        body = block.group("body")
        type_url, example = TYPE_URL.search(body), TX_JSON.search(body)
        if not type_url or not example:
            continue
        yield type_url.group("type"), {
            "example": json.loads(example.group("json")),
            "fields": _fields(body),
            "anchor": "#" + anchor_for(block.group("title")),
        }


def queries_on(page: dict):
    """Every runnable grpcurl example the page publishes, with its field table."""
    for block in SECTION.finditer(page["text"]):
        body = block.group("body")
        command = GRPCURL.search(body)
        if not command:
            continue
        payload = command.group("payload")
        yield command.group("target"), {
            "example": json.loads(payload) if payload else None,
            "fields": _fields(body),
            "anchor": "#" + anchor_for(block.group("title")),
        }


def _fields(body: str) -> dict:
    return {
        m.group("field"): (m.group("note").strip(), m.group("type").strip())
        for m in FIELD_ROW.finditer(body)
    }


def fill_value(value, note: str, type_cell: str, page: dict, fixtures: dict, field: str):
    """Resolve one placeholder from the page, or from what the reader owns."""
    if not isinstance(value, str) or not value.startswith("<"):
        return value

    one_of = ONE_OF.search(note)
    if one_of:
        return one_of.group("options").split(",")[0].strip().strip("`")

    # An enum-typed field links to its values in the page's own Types section.
    link = TYPE_LINK.search(type_cell)
    if link:
        named = page["by_anchor"].get(link.group("anchor"), "")
        if named in page["enums"]:
            return page["enums"][named]

    if DEC_NOTE.search(note):
        if not page["dec_decimal"]:
            raise Unfillable("the page does not state how a Dec is written", field=field, note=note)
        # Every Dec written into a transaction is a decimal string, including
        # the ones whose proto type is bytes.
        return "0.05"

    scalar = SCALAR_NOTE.search(note)
    if scalar and scalar.group("name") in READER_SUPPLIED:
        return fixtures[scalar.group("name")]

    if field == "denom" or "denomination" in note.lower():
        return fixtures["denom"]

    quoted = re.search(r'"([a-z][a-z0-9_]{2,})"', note)
    if quoted:
        return quoted.group(1)

    # A constrained format is the page's responsibility to state. Free text is
    # not: a reader supplies their own memo or moniker without being told.
    constrained = (
        value != "<string>"
        or field.endswith(("_url", "_hash", "_id", "_key", "_bytes", "_type", "_address"))
        or re.search(r"hex|base64|RFC|must (be|match)|identifier|type URL|query", note, re.I)
    )
    if constrained:
        raise Unfillable(f"no value or form for `{field}` (placeholder {value})", field=field, note=note)
    return "test"


def fill(body, page: dict, fixtures: dict, fields=None):
    """Fill a whole example, following the page's links into nested types."""
    if isinstance(body, list):
        return [fill(v, page, fixtures, fields) for v in body]
    if not isinstance(body, dict):
        return body

    fields = {} if fields is None else fields
    out = {}
    for key, value in body.items():
        if key == "@type":
            out[key] = value
            continue

        note, type_cell = fields.get(key, ("", ""))

        # An Any field may be repeated, in which case the placeholder sits
        # inside a list rather than directly under the key.
        candidate = value[0] if isinstance(value, list) and value else value
        if isinstance(candidate, dict) and candidate.get("@type", "").startswith("/cosmos.example."):
            wrap = (lambda v: [v]) if isinstance(value, list) else (lambda v: v)
            one_of = ONE_OF.search(note)
            if one_of:
                out[key] = wrap({"@type": one_of.group("options").split(",")[0].strip().strip("`")})
                continue
            if "implementing cosmos.base.v1beta1.Msg" in note:
                out[key] = wrap({
                    "@type": "/cosmos.bank.v1beta1.MsgSend",
                    "from_address": fixtures["cosmos.AddressString"],
                    "to_address": fixtures["cosmos.AddressString"],
                    "amount": [{"denom": fixtures["denom"], "amount": "1"}],
                })
                continue
            raise Unfillable(f"`{key}` is an Any and the page names no concrete type", field=key, note=note)

        if isinstance(value, (dict, list)):
            link = TYPE_LINK.search(type_cell)
            nested = page["types"].get(page["by_anchor"].get(link.group("anchor"), "")) if link else None
            out[key] = fill(value, page, fixtures, nested or {})
        else:
            out[key] = fill_value(value, note, type_cell, page, fixtures, key)
    return out


def pages_for(version: str):
    directory = REPO_ROOT / "sdk" / version / "api-reference" / "grpc"
    for path in sorted(directory.glob("*.mdx")):
        if path.name != "index.mdx":
            yield path, read_page(path)
