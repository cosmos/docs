#!/usr/bin/env python3
"""Check every gaiad command on the Hub pages against a gaiad binary.

Each command in a shell code block under hub/<version>/ is resolved against the
binary's own command tree, read from its --help output: the subcommand path
has to exist, and every flag has to be accepted by that command. A command or
flag that a release removed or renamed fails the check before the pages are
published under that release.

    python3 scripts/hub/release-check.py --gaiad ./gaiad --version next
    python3 scripts/hub/release-check.py --gaiad ./gaiad --version next --json report.json

It also reports pages whose HubVerified stamp names a different gaia version
than the binary. Those are warnings, not failures: a stamp records which
version a page was last run on, and only a rerun on the new version should
change it.

The check never starts a node and never touches a network. It proves that a
command parses on the release, not that it does what the page says.
"""

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ALLOW_FILE = Path(__file__).resolve().parent / "release-check-allow.json"
SNIPPET = REPO_ROOT / "snippets" / "hub-verified.mdx"

SHELL_LANGS = {"", "bash", "sh", "shell", "zsh", "console", "terminal"}
SKIP_DIRS = {"architecture"}
FENCE = re.compile(r"^(\s*)(```+|~~~+)\s*([A-Za-z0-9_+-]*)")
HELP_SECTION = re.compile(r"^(Usage|Aliases|Available Commands|Additional Commands|Flags|Global Flags|Examples|Additional help topics):\s*$")
FLAG_LINE = re.compile(r"^\s+(?:-([A-Za-z0-9]),\s+)?--([A-Za-z0-9][A-Za-z0-9_.-]*)")
SHORT_ONLY = re.compile(r"^\s+-([A-Za-z0-9])(?:\s|$)")
ASSIGNMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
WRAPPERS = {"sudo", "env", "nohup", "exec", "time", "nice", "runuser"}
WRAPPER_VALUE_FLAGS = {"-u", "-g", "-n", "--user", "--group"}
DOCKER_BOOL_FLAGS = {"--rm", "-d", "-i", "-t", "-it", "-ti", "--detach", "--interactive", "--tty", "--init", "--privileged"}


class Node:
    def __init__(self, path):
        self.path = path
        self.subcommands = {}
        self.flags = set()
        self.aliases = set()
        self.runnable = True


class Tree:
    """The binary's command tree, read lazily one --help call per node."""

    def __init__(self, gaiad):
        self.gaiad = gaiad
        self.cache = {}
        self.home = tempfile.mkdtemp(prefix="hub-release-check-")

    def node(self, path):
        key = tuple(path)
        if key in self.cache:
            return self.cache[key]
        env = dict(os.environ, HOME=self.home)
        proc = subprocess.run(
            [self.gaiad, *path, "--help"],
            capture_output=True, text=True, env=env, timeout=60,
        )
        if proc.returncode != 0 and "Usage:" not in proc.stdout + proc.stderr:
            sys.exit(f"`gaiad {' '.join([*path, '--help'])}` failed:\n{(proc.stderr or proc.stdout)[:2000]}")
        node = Node(list(path))
        section = None
        usage = []
        for line in (proc.stdout + "\n" + proc.stderr).splitlines():
            m = HELP_SECTION.match(line)
            if m:
                section = m.group(1)
                continue
            if section == "Usage" and line.strip():
                usage.append(line.strip())
            elif section in ("Available Commands", "Additional Commands") and line.startswith("  ") and line.strip():
                name = line.split()[0]
                node.subcommands[name] = name
            elif section == "Aliases" and line.strip():
                node.aliases.update(line.replace(",", " ").split())
            elif section in ("Flags", "Global Flags"):
                m = FLAG_LINE.match(line)
                if m:
                    if m.group(1):
                        node.flags.add("-" + m.group(1))
                    node.flags.add("--" + m.group(2))
                else:
                    m = SHORT_ONLY.match(line)
                    if m:
                        node.flags.add("-" + m.group(1))
        node.flags.update({"--help", "-h"})
        if node.subcommands:
            node.runnable = any(takes_args(u, len(path)) for u in usage)
        self.cache[key] = node
        return node

    def child(self, node, token):
        """Resolve a token to a subcommand name, following aliases."""
        if token in node.subcommands:
            return token
        for name in node.subcommands:
            sub = self.node(node.path + [name])
            if token in sub.aliases:
                return name
        if self.hidden(node.path + [token]):
            node.subcommands[token] = token
            return token
        return None

    def hidden(self, path):
        """True when a command missing from the help list still exists (cobra hides some, like completion)."""
        if token_is_flag(path[-1]):
            return False
        proc = subprocess.run(
            [self.gaiad, *path, "--help"],
            capture_output=True, text=True, env=dict(os.environ, HOME=self.home), timeout=60,
        )
        if proc.returncode != 0:
            return False
        usage = re.search(r"^Usage:\s*\n\s+(\S.*)$", proc.stdout, re.M)
        return bool(usage) and usage.group(1).split()[1 : len(path) + 1] == path


def takes_args(usage_line, depth):
    """True when a usage line accepts positional arguments, not just flags or a subcommand."""
    rest = usage_line.split()[1 + depth :]
    return any(tok not in ("[flags]", "[command]") for tok in rest)


def strip_frontmatter(text):
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end != -1:
            return "\n" * text[: end + 4].count("\n") + text[end + 4 :]
    return text


def code_blocks(text):
    """Yield (start_line, lang, body) for each fenced block."""
    lines = strip_frontmatter(text).splitlines()
    i = 0
    while i < len(lines):
        m = FENCE.match(lines[i])
        if not m:
            i += 1
            continue
        fence, lang, start = m.group(2), m.group(3).lower(), i + 1
        body = []
        i += 1
        while i < len(lines) and not lines[i].strip().startswith(fence):
            body.append(lines[i])
            i += 1
        yield start, lang, body
        i += 1


INLINE_GAIAD = re.compile(r"`((?:sudo -u \S+ )?gaiad [^`]+)`")


def inline_commands(text):
    """Yield (line_number, command) for inline `gaiad ...` spans outside fenced blocks."""
    fence = None
    for number, line in enumerate(strip_frontmatter(text).splitlines(), start=1):
        m = FENCE.match(line)
        if m:
            if fence is None:
                fence = m.group(2)
            elif line.strip().startswith(fence):
                fence = None
            continue
        if fence is None:
            for span in INLINE_GAIAD.findall(line):
                yield number, span


def logical_lines(body, start):
    """Join backslash continuations, keeping the first line number."""
    buf, first = [], None
    for offset, raw in enumerate(body):
        line = raw.rstrip()
        if first is None:
            first = start + 1 + offset
        if line.endswith("\\"):
            buf.append(line[:-1])
            continue
        buf.append(line)
        yield first, " ".join(part.strip() for part in buf)
        buf, first = [], None
    if buf:
        yield first, " ".join(part.strip() for part in buf)


def invocations(line):
    """Return the argument lists of every gaiad call on a shell line."""
    line = line.strip()
    if line.startswith("$ "):
        line = line[2:]
    if not line or line.startswith("#"):
        return []
    pieces = [line] + re.findall(r"\$\(([^()]*)\)", line)
    calls = []
    for piece in pieces:
        piece = re.sub(r"\$\([^()]*\)", "SUBST", piece)
        for segment in re.split(r"\|\||&&|\||;", piece):
            segment = segment.split(" #", 1)[0]
            try:
                tokens = shlex.split(segment, comments=False, posix=True)
            except ValueError:
                tokens = segment.split()
            call = command_call(tokens)
            if call is not None:
                calls.append(call)
    return calls


def token_is_flag(tok):
    return tok.startswith("-")


def is_gaiad(tok):
    return tok == "gaiad" or tok.endswith("/gaiad")


def command_call(tokens):
    """Return gaiad's arguments when the segment runs gaiad, else None.

    gaiad counts only in command position: after env assignments and
    wrappers such as sudo, so `journalctl -u gaiad` is not a gaiad call.
    `docker run ... --entrypoint gaiad IMAGE args` is one, with args after
    the image.
    """
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if ASSIGNMENT.match(tok):
            i += 1
        elif tok in WRAPPERS:
            i += 1
            while i < len(tokens) and token_is_flag(tokens[i]):
                takes_value = tokens[i] in WRAPPER_VALUE_FLAGS
                i += 2 if takes_value else 1
            if i < len(tokens) and tokens[i] == "--":
                i += 1
        else:
            break
    rest = tokens[i:]
    if not rest:
        return None
    if is_gaiad(rest[0]):
        return rest[1:]
    if rest[0] == "cosmovisor" and rest[1:2] == ["run"]:
        return rest[2:]
    if rest[0] == "docker" and rest[1:2] == ["run"]:
        return docker_call(rest[2:])
    return None


def docker_call(args):
    """gaiad's arguments in `docker run [opts] IMAGE args` with --entrypoint gaiad."""
    entry = None
    i = 0
    while i < len(args) and token_is_flag(args[i]):
        flag = args[i]
        if flag.startswith("--entrypoint="):
            entry = flag.split("=", 1)[1]
            i += 1
        elif flag == "--entrypoint":
            entry = args[i + 1] if i + 1 < len(args) else None
            i += 2
        elif "=" in flag or flag in DOCKER_BOOL_FLAGS:
            i += 1
        else:
            i += 2
    if entry is None or not is_gaiad(entry) or i >= len(args):
        return None
    return args[i + 1 :]


def is_placeholder(tok):
    return bool(re.match(r"^[<\[{$]|^SUBST$|^[A-Z_]{2,}$", tok)) or "/" in tok or "=" in tok


def check_call(tree, args):
    """Return a list of problems with one gaiad call."""
    node = tree.node([])
    rest = list(args)
    while rest and not rest[0].startswith("-"):
        tok = rest[0]
        if not node.subcommands:
            break
        name = tree.child(node, tok)
        if name is None:
            if node.runnable or is_placeholder(tok):
                break
            return [f"unknown command `gaiad {' '.join(node.path + [tok])}`"]
        node = tree.node(node.path + [name])
        rest.pop(0)
    if node.subcommands and not node.runnable and not rest:
        return []
    problems = []
    for tok in rest:
        if tok == "--":
            break
        if not tok.startswith("-") or tok == "-" or re.match(r"^-\d", tok):
            continue
        flag = tok.split("=", 1)[0]
        if flag.startswith("--"):
            if flag not in node.flags:
                problems.append(f"`gaiad {' '.join(node.path)}` has no flag `{flag}`")
        else:
            for ch in flag[1:]:
                if "-" + ch not in node.flags:
                    problems.append(f"`gaiad {' '.join(node.path)}` has no flag `-{ch}`")
                    break
    return problems


def snippet_default():
    m = re.search(r'gaia\s*=\s*"([^"]+)"', SNIPPET.read_text()) if SNIPPET.exists() else None
    return m.group(1) if m else None


def stamps(text, default):
    found = []
    for tag in re.findall(r"<HubVerified\b[^>]*/?>", text):
        m = re.search(r'gaia\s*=\s*"([^"]+)"', tag)
        found.append(m.group(1) if m else default)
    return found


def binary_version(gaiad):
    """Run `gaiad version`, and stop if the binary does not run at all.

    A binary that cannot start answers every --help call with an error, and
    every documented command would then be reported as missing.
    """
    with tempfile.TemporaryDirectory() as home:
        out = subprocess.run([gaiad, "version"], capture_output=True, text=True, env=dict(os.environ, HOME=home))
    text = (out.stdout or out.stderr).strip()
    v = text.splitlines()[-1].strip() if text else ""
    if out.returncode != 0 or not re.match(r"^v?\d+\.\d+\.\d+", v):
        sys.exit(f"gaiad does not run: {gaiad}\n{text[:2000]}")
    return v if v.startswith("v") else "v" + v


def load_allow():
    if not ALLOW_FILE.exists():
        return []
    return json.loads(ALLOW_FILE.read_text())


def allowed(rules, page, line, problem):
    """A rule names a page relative to the version folder, so it survives a freeze."""
    for rule in rules:
        if rule["file"] == page and rule["contains"] in line and rule.get("problem", "") in problem:
            return True
    return False


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--gaiad", required=True, help="path to the gaiad binary to check against")
    ap.add_argument("--version", default="next", help="Hub docs directory under hub/ (default: next)")
    ap.add_argument("--json", help="write the full report to this file")
    args = ap.parse_args()

    root = REPO_ROOT / "hub" / args.version
    if not root.is_dir():
        sys.exit(f"no such docs directory: {root}")
    gaiad = str(Path(args.gaiad).resolve())
    version = binary_version(gaiad)
    tree = Tree(gaiad)
    rules = load_allow()
    default = snippet_default()

    failures, allowed_hits, stale, checked = [], [], [], 0
    for path in sorted(root.rglob("*.mdx")):
        rel = str(path.relative_to(REPO_ROOT))
        page = str(path.relative_to(root))
        if SKIP_DIRS & set(path.relative_to(root).parts):
            continue
        text = path.read_text()
        for stamp in stamps(text, default):
            if stamp != version:
                stale.append({"file": rel, "stamp": stamp})
                break
        for start, lang, body in code_blocks(text):
            if lang not in SHELL_LANGS:
                continue
            for lineno, line in logical_lines(body, start):
                for call in invocations(line):
                    checked += 1
                    for problem in check_call(tree, call):
                        hit = {"file": rel, "line": lineno, "command": line, "problem": problem}
                        (allowed_hits if allowed(rules, page, line, problem) else failures).append(hit)
        for lineno, line in inline_commands(text):
            for call in invocations(line):
                checked += 1
                for problem in check_call(tree, call):
                    hit = {"file": rel, "line": lineno, "command": line, "problem": problem}
                    (allowed_hits if allowed(rules, page, line, problem) else failures).append(hit)

    print(f"gaiad {version}: checked {checked} commands in hub/{args.version}/ ({len(tree.cache)} help pages read)")
    for f in failures:
        print(f"FAIL {f['file']}:{f['line']}: {f['problem']}\n     {f['command']}")
    if allowed_hits:
        print(f"{len(allowed_hits)} known exceptions skipped (see {ALLOW_FILE.name})")
    if stale:
        print(f"{len(stale)} pages carry a HubVerified stamp for another gaia version (rerun them on {version} before changing the stamp)")
    if args.json:
        Path(args.json).write_text(json.dumps({
            "gaiad": version, "docs": f"hub/{args.version}", "checked": checked,
            "failures": failures, "allowed": allowed_hits, "stale_stamps": stale,
        }, indent=2))
    print("ok" if not failures else f"{len(failures)} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
