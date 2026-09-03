"""Build simapp at a commit and run it, so a check runs against the documented code.

Version skew produces false failures that cost more to discount than the build
costs to run: the public Hub runs v0.53.4 against pages documenting v0.55.

The chain deliberately avoids every default port. A developer chain on the same
machine would otherwise either block this one from binding or, far worse, still
be there for the runners to find after this one failed to start, which would
report somebody else's chain state as the documentation's.
"""

import json
import os
import re
import shutil
import signal
import subprocess
import time
import urllib.request
from contextlib import contextmanager
from pathlib import Path

CHAIN_ID = "docs-check"
KEY, SECOND_KEY = "docs-primary", "docs-second"

# Not the defaults (26657 / 1317 / 9090 / 26656 / 6060), on purpose. See the
# module docstring.
RPC_PORT = 26667
REST_PORT = 1318
GRPC_PORT = 9091
P2P_PORT = 26666
PPROF_PORT = 6061

NODE = f"tcp://localhost:{RPC_PORT}"
REST = f"http://localhost:{REST_PORT}"
GRPC = f"localhost:{GRPC_PORT}"


def _run(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, text=True, **kwargs)


def build(repository: str, sha: str, workdir: Path) -> Path:
    """Clone at a SHA and build simd. Returns the binary path."""
    source = workdir / "cosmos-sdk"
    origin = f"https://github.com/{repository}.git"
    # A workdir reused across repositories would otherwise fetch the requested
    # commit from the wrong origin, and either fail confusingly or, if the SHA
    # happens to resolve, build the wrong code.
    if source.exists() and _remote(source) not in (origin, origin.removesuffix(".git")):
        shutil.rmtree(source)
    if not source.exists():
        # A blobless clone of cosmos-sdk is the difference between a minute and
        # ten. --no-checkout because the branch tip is not what gets built.
        _run(["git", "clone", "--filter=blob:none", "--no-checkout", origin, str(source)])
    # The commit may be behind a branch tip or on no branch at all, so ask for it
    # by name rather than assuming the clone already has it.
    _run(["git", "-C", str(source), "fetch", "--filter=blob:none", "origin", sha])
    _run(["git", "-C", str(source), "checkout", "--force", sha])

    # simd is a main package under the simapp module, which is its own Go module
    # with replace directives back to the repository root.
    simapp = source / "simapp"
    if not (simapp / "simd").is_dir():
        raise RuntimeError(
            f"{simapp}/simd is not there; this SDK version puts the binary elsewhere"
        )
    binary = workdir / "simd"
    _run(["go", "build", "-o", str(binary), "./simd"], cwd=str(simapp))
    return binary


def _remote(source: Path) -> str:
    try:
        return _run(["git", "-C", str(source), "remote", "get-url", "origin"]).stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""


def _genesis(simd: Path, home: Path, args: list) -> None:
    """Run a genesis subcommand, whichever level this SDK version puts it at."""
    try:
        _run([str(simd), "genesis", *args, "--home", str(home)])
    except subprocess.CalledProcessError:
        # Older versions have these at the top level, without the `genesis` group.
        _run([str(simd), *args, "--home", str(home)])


def configure(home: Path) -> None:
    """Bind every server to this harness's own ports, and turn the API server on.

    A global `enable = false` -> `enable = true` replace is what the plan called
    for and it is not safe: it would also flip anything else in the file that
    happens to be off. This walks the sections and touches only the two that the
    runners need.
    """
    app = home / "config" / "app.toml"
    wanted = {
        "api": {"enable": "true", "address": f'"tcp://localhost:{REST_PORT}"'},
        "grpc": {"enable": "true", "address": f'"localhost:{GRPC_PORT}"'},
    }
    app.write_text(_set_in_sections(app.read_text(), wanted))

    seen = _read_sections(app.read_text())
    for section, keys in wanted.items():
        for key, value in keys.items():
            if seen.get((section, key)) != value:
                raise RuntimeError(
                    f"app.toml [{section}] {key} is {seen.get((section, key))!r}, "
                    f"wanted {value!r}; the config layout changed"
                )

    config = home / "config" / "config.toml"
    text = config.read_text()
    text = _set_in_sections(text, {
        "rpc": {
            "laddr": f'"tcp://127.0.0.1:{RPC_PORT}"',
            # CometBFT's pprof listener is another default port to stay off.
            "pprof_laddr": f'"localhost:{PPROF_PORT}"',
        },
        "p2p": {"laddr": f'"tcp://0.0.0.0:{P2P_PORT}"'},
    })
    config.write_text(text)


SECTION = re.compile(r"^\s*\[(?P<name>[^\]]+)\]\s*$")
ASSIGNMENT = re.compile(r"^(?P<key>[A-Za-z0-9_\-]+)\s*=\s*(?P<value>.*?)\s*$")


def _set_in_sections(text: str, wanted: dict) -> str:
    section, lines = None, []
    for line in text.splitlines():
        header = SECTION.match(line)
        if header:
            section = header.group("name")
        else:
            assignment = ASSIGNMENT.match(line)
            if assignment and section in wanted:
                key = assignment.group("key")
                if key in wanted[section]:
                    line = f"{key} = {wanted[section][key]}"
        lines.append(line)
    return "\n".join(lines) + "\n"


def _read_sections(text: str) -> dict:
    section, values = None, {}
    for line in text.splitlines():
        header = SECTION.match(line)
        if header:
            section = header.group("name")
            continue
        assignment = ASSIGNMENT.match(line)
        if assignment and section:
            values[(section, assignment.group("key"))] = assignment.group("value")
    return values


def init(simd: Path, home: Path) -> None:
    if home.exists():
        shutil.rmtree(home)
    common = ["--home", str(home), "--keyring-backend", "test"]

    _run([str(simd), "init", "docs", "--chain-id", CHAIN_ID, "--home", str(home)])
    for name in (KEY, SECOND_KEY):
        _run([str(simd), "keys", "add", name, *common])

    genesis = home / "config" / "genesis.json"
    document = json.loads(genesis.read_text())
    denom = document["app_state"]["staking"]["params"]["bond_denom"]

    for name in (KEY, SECOND_KEY):
        address = _run([str(simd), "keys", "show", name, "-a", *common]).stdout.strip()
        _genesis(simd, home, ["add-genesis-account", address, f"100000000000{denom}",
                              "--keyring-backend", "test"])

    _genesis(simd, home, ["gentx", KEY, f"70000000000{denom}",
                          "--chain-id", CHAIN_ID, "--keyring-backend", "test"])
    _genesis(simd, home, ["collect-gentxs"])

    configure(home)


def wait_for_block(rest: str, timeout: int = 90, process=None, log: Path = None) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if process is not None and process.poll() is not None:
            raise RuntimeError(
                f"simd exited with {process.returncode} before producing a block\n"
                + _tail(log)
            )
        try:
            with urllib.request.urlopen(
                f"{rest}/cosmos/base/tendermint/v1beta1/blocks/latest", timeout=5
            ) as response:
                if int(json.load(response)["block"]["header"]["height"]) >= 1:
                    return
        except Exception:  # noqa: BLE001
            pass
        time.sleep(1)
    raise RuntimeError(f"no block within {timeout}s; check the node log\n" + _tail(log))


def _tail(log: Path, lines: int = 30) -> str:
    if not log or not Path(log).exists():
        return ""
    return "\n".join(Path(log).read_text().splitlines()[-lines:])


@contextmanager
def running(repository: str, sha: str, workdir: Path):
    workdir = Path(workdir)
    workdir.mkdir(parents=True, exist_ok=True)
    simd = build(repository, sha, workdir)
    home = workdir / "home"
    init(simd, home)

    log_path = workdir / "node.log"
    log = open(log_path, "w")
    # Its own process group: simd starts children, and killing only the parent
    # leaves a node holding the ports.
    process = subprocess.Popen(
        [str(simd), "start",
         "--home", str(home),
         "--api.enable",
         "--grpc.enable",
         "--api.address", f"tcp://localhost:{REST_PORT}",
         "--grpc.address", GRPC,
         "--rpc.laddr", f"tcp://127.0.0.1:{RPC_PORT}",
         "--p2p.laddr", f"tcp://0.0.0.0:{P2P_PORT}"],
        stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
    )
    try:
        wait_for_block(REST, process=process, log=log_path)
        yield {
            "simd": str(simd), "home": str(home), "chain_id": CHAIN_ID,
            "node": NODE, "rest": REST, "grpc": GRPC,
            "key": KEY, "second_key": SECOND_KEY, "log": str(log_path),
        }
    finally:
        _stop(process)
        log.close()


def _stop(process) -> None:
    """Tear the node down without ever raising.

    This runs in a `finally`, so anything it raises replaces the exception that
    brought us here. The process can exit between the poll and the signal, which
    is a ProcessLookupError out of a teardown path and a lost error message.
    """
    if process.poll() is not None:
        return
    try:
        group = os.getpgid(process.pid)
    except ProcessLookupError:
        return
    _signal(group, signal.SIGTERM)
    try:
        process.wait(timeout=30)
    except subprocess.TimeoutExpired:
        _signal(group, signal.SIGKILL)
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            print(f"warning: simd (pid {process.pid}) did not die; kill it by hand")


def _signal(group: int, which) -> None:
    try:
        os.killpg(group, which)
    except (ProcessLookupError, PermissionError):
        pass
