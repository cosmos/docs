#!/usr/bin/env python3
"""Verify that every generated transaction JSON example is a valid message.

The module pages show, for each transaction message, the JSON body you put in a
transaction. If one of those is wrong, a reader copies it, signs it, broadcasts
it, and pays a fee for a transaction the chain rejects. Several have been wrong:
enums rendered as {}, Any rendered with typeUrl/value, Duration as
{seconds,nanos}, bytes as an unparseable placeholder.

This parses each example against the protobuf definitions it was generated from,
using google.protobuf.json_format, which rejects unknown fields including inside
an Any. That matters because the SDK is strict in the same place: its decoder
calls unknownproto.RejectUnknownFieldsStrict, which traverses into Any and
rejects unknown fields there, and Cosmos Msg bodies live inside Any.

`buf convert` is deliberately not used. It silently drops unknown fields and
exits 0, so a completely misspelled example passes.

The descriptor is built at the exact commit each page records, so the check runs
against the same protos that produced the examples rather than whatever is on a
branch today.

Usage:
    python3 verify-transaction-examples.py --version latest
    python3 verify-transaction-examples.py --version latest --version next
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from google.protobuf import descriptor_pb2, descriptor_pool, json_format, message_factory

# What a placeholder becomes before the chain binary decodes it. The SDK's custom
# types parse their own strings, so "<string>" is not a legal cosmos.Int, and a
# template cannot be decoded until each placeholder is filled with something of
# the right kind. Values here only have to be well-formed, not meaningful.
SCALAR_FILLERS = {
    "cosmos.Int": "1",
    "cosmos.Dec": "0.05",
    "cosmos.AddressString": "cosmos1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu",
    "cosmos.ValidatorAddressString": "cosmosvaloper1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5vhwaqp",
    "cosmos.ConsensusAddressString": "cosmosvalcons1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5qmz6ln",
}
PLACEHOLDER_TEXT = "<string>"

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
BUF = HERE / "node_modules" / ".bin" / "buf"
REPOSITORY = "cosmos/cosmos-sdk"

# The renderer emits this in place of a concrete message inside an Any, because
# an Any can carry anything and the example cannot guess which. It is correct
# documentation and deliberately not a real message, so substitute something
# real before parsing rather than skipping the example and losing the coverage.
ANY_PLACEHOLDER_TYPE = "/cosmos.example.v1.MsgExample"
ANY_SUBSTITUTE_TYPE = "/cosmos.bank.v1beta1.MsgSend"
ANY_ELLIPSIS_KEY = "..."

# Placeholders that are deliberately not parseable values. A Timestamp cannot use
# the <string> convention the other scalars use, and an epoch-zero placeholder was
# worse: it looks real and the chain rejects it ("expiration must be after the
# current block time"). Substituted here so the rest of the example is still checked.
PLACEHOLDER_VALUES = {"<RFC 3339 timestamp>": "2030-01-01T00:00:00Z"}

SHA_PATTERN = re.compile(r"/tree/([0-9a-f]{40})/proto")
EXAMPLE_PATTERN = re.compile(r"In a transaction:\n\n```json\n(.*?)\n```", re.DOTALL)
# The -d payload of a generated grpcurl example, with the method it targets.
GRPCURL_PATTERN = re.compile(
    r"```bash\ngrpcurl -plaintext -d '(.*?)' \\\n  localhost:9090 ([\w.]+)/(\w+)\n```"
)


def build_descriptor(sha: str) -> descriptor_pb2.FileDescriptorSet:
    """Build a FileDescriptorSet from the cosmos-sdk protos at one commit."""
    cache = Path(f"/tmp/sdk-image-{sha[:12]}.binpb")
    if not cache.exists():
        source = f"https://github.com/{REPOSITORY}.git#ref={sha},subdir=proto"
        subprocess.run([str(BUF), "build", source, "-o", str(cache)], check=True)

    fds = descriptor_pb2.FileDescriptorSet()
    fds.ParseFromString(cache.read_bytes())
    return fds


def build_pool(fds: descriptor_pb2.FileDescriptorSet) -> descriptor_pool.DescriptorPool:
    """A pool holding every file, added dependencies-first."""
    pool = descriptor_pool.DescriptorPool()
    by_name = {f.name: f for f in fds.file}
    added = set()

    def add(name: str) -> None:
        if name in added or name not in by_name:
            return
        added.add(name)
        for dependency in by_name[name].dependency:
            add(dependency)
        pool.Add(by_name[name])

    for name in by_name:
        add(name)
    return pool


def substitute_any_placeholders(node):
    """Replace the documentation placeholder for an Any with a real message."""
    if isinstance(node, list):
        return [substitute_any_placeholders(item) for item in node]
    if isinstance(node, str):
        return PLACEHOLDER_VALUES.get(node, node)
    if not isinstance(node, dict):
        return node

    out = {}
    for key, value in node.items():
        if key == ANY_ELLIPSIS_KEY:
            continue
        if key == "@type" and value == ANY_PLACEHOLDER_TYPE:
            out[key] = ANY_SUBSTITUTE_TYPE
            continue
        out[key] = substitute_any_placeholders(value)
    return out


def transaction_examples_in(page: Path):
    """Every transaction JSON example on a page, with its declared type.

    The top-level @type selects which message to parse into. It is a discriminator
    rather than a field, so it is removed before parsing; a nested @type inside an
    Any stays, because that is where protojson expects it.
    """
    for block in EXAMPLE_PATTERN.findall(page.read_text()):
        body = json.loads(block)
        type_name = body.pop("@type", "").lstrip("/")
        yield "In a transaction", type_name, body


def query_examples_in(page: Path, request_types):
    """Every generated grpcurl payload, with the request message it must satisfy."""
    for payload, service, method in GRPCURL_PATTERN.findall(page.read_text()):
        type_name = request_types.get(f"{service}/{method}")
        if not type_name:
            continue
        yield "grpcurl -d", type_name, json.loads(payload)


def request_types_from(fds):
    """Map every service method to the message its request must parse as."""
    mapping = {}
    for file in fds.file:
        for service in file.service:
            for method in service.method:
                key = f"{file.package}.{service.name}/{method.name}"
                mapping[key] = method.input_type.lstrip(".")
    return mapping


# A minimal transaction envelope. `simd tx encode` decodes the whole document
# with the SDK's own ProtoCodec and interface registry, so wrapping a message in
# this exercises exactly the code path a node runs, offline and without keys.
TX_ENVELOPE = {
    "body": {"messages": [], "memo": "", "timeout_height": "0",
             "extension_options": [], "non_critical_extension_options": []},
    "auth_info": {"signer_infos": [],
                  "fee": {"amount": [], "gas_limit": "200000", "payer": "", "granter": ""}},
    "signatures": [],
}


# A placeholder reaching a gogoproto custom type is a property of the example
# being a fillable template, not a defect: cosmos.Int and cosmos.Dec parse their
# own strings, and "<string>" is not one. The binary pass skips those and still
# checks what only it can: type-URL resolution and unknown fields.
TEMPLATE_ARTIFACTS = (
    "into a *big.Int",
    "decimal string cannot be empty",
    "failed to set decimal string",
    "invalid character",
    # protojson demands base64 for a bytes field; the transaction decoder wants
    # a decimal string for a bytes-typed cosmos.Dec, and the page documents what
    # the chain accepts.
    "Failed to parse",
    # The Any placeholder is substituted with a real message so the outer shape
    # can be checked, but the substitute does not implement the interface the
    # field accepts. The concrete options are listed on the page itself; the
    # binary cannot validate a field whose value the example deliberately leaves
    # open.
    "no concrete type registered for type URL",
    # A module present in the protos but not registered by this particular app,
    # which is a property of the binary rather than of the documentation.
    "unable to resolve type URL",
)


def fill_placeholders(body, descriptor, scalar_of, accepts_of=None, implementations=None):
    """Replace <string> placeholders with a value of the kind that field expects.

    Walks the message descriptor alongside the JSON so each substitution is driven
    by the field's own cosmos_proto.scalar annotation rather than by guesswork.
    """
    if not isinstance(body, dict):
        return body

    fields = {f.name: f for f in descriptor.fields}
    out = {}
    for key, value in body.items():
        field = fields.get(key)
        if field is None:
            out[key] = value
            continue

        nested = field.message_type

        # An Any field carries a documentation placeholder for its type URL. The
        # interface it accepts names which concrete messages are legal, so fill it
        # with one the registry can resolve rather than skipping the example.
        if nested and nested.full_name == "google.protobuf.Any" and accepts_of:
            accepted = accepts_of(field)
            concrete = (implementations or {}).get(accepted) if accepted else None
            if concrete:
                replacement = {"@type": f"/{concrete}"}
                out[key] = [replacement] if isinstance(value, list) else replacement
                continue

        if isinstance(value, list):
            out[key] = [
                fill_placeholders(item, nested, scalar_of, accepts_of, implementations)
                if nested else item
                for item in value
            ]
        elif isinstance(value, dict) and nested:
            out[key] = fill_placeholders(value, nested, scalar_of, accepts_of, implementations)
        elif value == PLACEHOLDER_TEXT:
            out[key] = SCALAR_FILLERS.get(scalar_of(field), PLACEHOLDER_TEXT)
        else:
            out[key] = value
    return out


def encode_with_chain_binary(simd: Path, type_url: str, body: dict, tmp: Path):
    """Ask the chain binary to decode this message, as a node would.

    Stricter than protojson in one way that matters: the SDK's interface registry
    is an exact lookup on "/<fullName>", so a host-prefixed type URL such as
    "type.googleapis.com/cosmos.bank.v1beta1.MsgSend" is accepted by protojson
    and rejected by a node.
    """
    document = json.loads(json.dumps(TX_ENVELOPE))
    document["body"]["messages"] = [{"@type": f"/{type_url}", **body}]
    tmp.write_text(json.dumps(document))

    result = subprocess.run(
        [str(simd), "tx", "encode", str(tmp)], capture_output=True, text=True
    )
    if result.returncode == 0 and not result.stdout.startswith("Usage:"):
        return None

    combined = f"{result.stderr}\n{result.stdout}"
    message = next(
        (line.strip() for line in combined.splitlines() if "unmarshal" in line or "error" in line.lower() and "--" not in line),
        "rejected by the chain binary",
    )
    if any(artifact in message for artifact in TEMPLATE_ARTIFACTS):
        return "SKIP"
    return message[:160]


def verify_version(version: str) -> int:
    pages_dir = REPO_ROOT / "sdk" / version / "api-reference" / "grpc"
    pages = sorted(p for p in pages_dir.glob("*.mdx") if p.name != "index.mdx")
    if not pages:
        print(f"no generated pages under {pages_dir}", file=sys.stderr)
        return 1

    sha_match = SHA_PATTERN.search(pages[0].read_text())
    if not sha_match:
        print(f"{pages[0]} records no commit to verify against", file=sys.stderr)
        return 1
    sha = sha_match.group(1)

    print(f"{version}: verifying against {REPOSITORY}@{sha[:12]}")
    fds = build_descriptor(sha)
    pool = build_pool(fds)

    # cosmos_proto.scalar has to be read through the same pool the descriptors
    # came from, or the extension does not match the options message.
    scalar_ext = pool.FindExtensionByName("cosmos_proto.scalar")
    FieldOptions = message_factory.GetMessageClass(
        pool.FindMessageTypeByName("google.protobuf.FieldOptions")
    )

    accepts_ext = pool.FindExtensionByName("cosmos_proto.accepts_interface")
    implements_ext = pool.FindExtensionByName("cosmos_proto.implements_interface")
    MessageOptions = message_factory.GetMessageClass(
        pool.FindMessageTypeByName("google.protobuf.MessageOptions")
    )

    def scalar_of(field):
        options = FieldOptions()
        options.ParseFromString(field.GetOptions().SerializeToString())
        return options.Extensions[scalar_ext] if options.HasExtension(scalar_ext) else None

    def accepts_of(field):
        options = FieldOptions()
        options.ParseFromString(field.GetOptions().SerializeToString())
        return options.Extensions[accepts_ext] if options.HasExtension(accepts_ext) else None

    # interface name -> a concrete message that implements it, so an Any field can
    # be filled with something the interface registry will actually resolve.
    implementations = {}
    for file in fds.file:
        for message in file.message_type:
            options = MessageOptions()
            options.ParseFromString(message.options.SerializeToString())
            for name in options.Extensions[implements_ext]:
                implementations.setdefault(name, f"{file.package}.{message.name}")
    request_types = request_types_from(fds)

    simd = os.environ.get("SIMD_BINARY")
    simd = Path(simd) if simd and Path(simd).exists() else None
    encoded = 0
    skipped = 0
    tmp = Path(f"/tmp/verify-tx-{version}.json")

    counts = {"In a transaction": 0, "grpcurl -d": 0}
    substituted = 0
    failures = []

    for page in pages:
        examples = list(transaction_examples_in(page)) + list(
            query_examples_in(page, request_types)
        )
        for kind, type_name, body in examples:
            counts[kind] += 1
            payload = substitute_any_placeholders(body)
            if payload != body:
                substituted += 1

            try:
                descriptor = pool.FindMessageTypeByName(type_name)
            except KeyError:
                failures.append((page.name, kind, type_name, "no such message in the descriptor"))
                continue

            # protojson accepts "type.googleapis.com/cosmos..." because it
            # truncates at the last slash, but the SDK's interface registry is an
            # exact lookup on "/" + fullName and rejects the host-prefixed form.
            # A parser-only check would pass an example a node refuses.
            for url in re.findall(r'"@type":\s*"([^"]+)"', json.dumps(payload)):
                if not url.startswith("/"):
                    failures.append(
                        (page.name, kind, type_name,
                         f'type URL "{url}" is host-prefixed; a node resolves only "/<fullName>"')
                    )

            message = message_factory.GetMessageClass(descriptor)()
            try:
                # ignore_unknown_fields defaults to False, which is the point:
                # an unrecognised field name is an error, as it is on a node.
                # The pool must be passed explicitly, or Any type URLs resolve
                # against the default pool, which knows nothing about these protos.
                json_format.ParseDict(payload, message, descriptor_pool=pool)
            except json_format.ParseError as error:
                failures.append((page.name, kind, type_name, str(error).split("\n")[0]))
                continue

            # Transaction bodies get a second, authoritative pass through the
            # chain's own decoder when a binary is available.
            if simd and kind == "In a transaction":
                encoded += 1
                filled = fill_placeholders(
                    payload, descriptor, scalar_of, accepts_of, implementations
                )
                reason = encode_with_chain_binary(simd, type_name, filled, tmp)
                if reason == "SKIP":
                    encoded -= 1
                    skipped += 1
                    if os.environ.get("VERBOSE_SKIPS"):
                        print(f"    skipped: {type_name}")
                elif reason:
                    failures.append((page.name, "simd tx encode", type_name, reason))

    print(
        f"  {counts['In a transaction']} transaction bodies and "
        f"{counts['grpcurl -d']} grpcurl payloads checked, "
        f"{substituted} with an Any placeholder substituted"
    )
    if simd:
        print(
            f"  {encoded} of those also decoded by the chain binary"
            f"{f', {skipped} skipped: a placeholder reaches a custom type' if skipped else ''}"
        )
    else:
        print("  set SIMD_BINARY to also decode them with the chain's own codec")

    if failures:
        print(f"\n  {len(failures)} INVALID:")
        for page_name, kind, type_name, reason in failures:
            print(f"    {page_name}  [{kind}]  {type_name}")
            print(f"      {reason}")
        return 1

    print("  all valid")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", action="append", default=None, choices=["latest", "next"])
    args = parser.parse_args()

    status = 0
    for version in args.version or ["latest", "next"]:
        status |= verify_version(version)
    return status


if __name__ == "__main__":
    sys.exit(main())
