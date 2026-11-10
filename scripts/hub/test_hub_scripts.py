"""Unit tests for the Hub docs scripts. No chain, binary, or network needed.

    python3 -m unittest discover -s scripts/hub -p 'test_*.py' -v
"""

import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


rc = load("release_check", "release-check.py")
bot = load("upgrade_bot", "upgrade-bot.py")
detect = load("detect_upgrade", "detect-upgrade.py")


class FakeTree:
    """A command tree without a binary: {path tuple: (subcommands, flags, runnable, aliases)}."""

    GLOBAL = {"--home", "--node", "--output", "-o", "--chain-id", "--help", "-h"}

    def __init__(self, spec):
        self.spec = spec

    def node(self, path):
        subs, flags, runnable, aliases = self.spec[tuple(path)]
        n = rc.Node(list(path))
        n.subcommands = {s: s for s in subs}
        n.flags = set(flags) | self.GLOBAL
        n.runnable = runnable
        n.aliases = set(aliases)
        return n

    def child(self, node, token):
        return rc.Tree.child(self, node, token)

    def hidden(self, path):
        return tuple(path) in self.spec


TREE = FakeTree({
    (): (["query", "tx", "config", "version"], [], False, []),
    ("query",): (["gov", "bank"], [], False, ["q"]),
    ("query", "gov"): (["proposal", "params"], [], False, []),
    ("query", "gov", "proposal"): ([], ["--height"], True, []),
    ("query", "gov", "params"): ([], [], True, []),
    ("query", "bank"): (["balances"], [], False, []),
    ("query", "bank", "balances"): ([], ["--denom"], True, []),
    ("tx",): (["bank"], ["--from", "--gas", "--gas-prices", "--gas-adjustment"], False, []),
    ("tx", "bank"): (["send"], [], False, []),
    ("tx", "bank", "send"): ([], ["--from", "--gas", "--gas-prices", "--gas-adjustment", "--fees"], True, []),
    ("config",): (["set"], [], False, []),
    ("config", "set"): ([], ["-s", "--skip-validate"], True, []),
    ("version",): ([], ["--long"], True, []),
})


class ReleaseCheckParsing(unittest.TestCase):
    PAGE = """---
title: x
---

Text with `gaiad tx gone` inline, which is not checked.

```bash
gaiad q gov proposal 12 --output json | jq .status
gaiad tx bank send a b 1uatom \\
  --from mykey --gas auto --gas-prices 0.005uatom
# gaiad comments are skipped
VER=$(gaiad version)
```

```json
{"not": "gaiad shell"}
```

  ```shell
  cosmovisor run version --long
  ```
"""

    def calls(self):
        out = []
        for start, lang, body in rc.code_blocks(self.PAGE):
            if lang in rc.SHELL_LANGS:
                for lineno, line in rc.logical_lines(body, start):
                    out += [(lineno, c) for c in rc.invocations(line)]
        return out

    def test_finds_shell_commands_only(self):
        calls = [c for _, c in self.calls()]
        self.assertIn(["q", "gov", "proposal", "12", "--output", "json"], calls)
        self.assertIn(["version"], calls)
        self.assertIn(["version", "--long"], calls)
        self.assertEqual(len(calls), 4)

    def test_joins_continuations_and_keeps_first_line(self):
        lines = {tuple(c[:3]): n for n, c in self.calls()}
        self.assertEqual(lines[("tx", "bank", "send")], 9)

    def test_accepts_valid_commands(self):
        for _, call in self.calls():
            self.assertEqual(rc.check_call(TREE, call), [], call)

    def test_alias_resolves(self):
        self.assertEqual(rc.check_call(TREE, ["q", "bank", "balances", "cosmos1x", "--denom", "uatom"]), [])

    def test_unknown_subcommand(self):
        self.assertEqual(rc.check_call(TREE, ["q", "params", "subspace", "x"]),
                         ["unknown command `gaiad query params`"])

    def test_unknown_flag(self):
        self.assertEqual(rc.check_call(TREE, ["tx", "bank", "send", "a", "b", "1uatom", "--memo", "x"]),
                         ["`gaiad tx bank send` has no flag `--memo`"])

    def test_short_flag_and_flag_value(self):
        self.assertEqual(rc.check_call(TREE, ["config", "set", "config", "k", "v", "-s"]), [])
        self.assertEqual(rc.check_call(TREE, ["q", "gov", "params", "--output=json"]), [])

    def test_placeholder_arguments_pass(self):
        self.assertEqual(rc.check_call(TREE, ["q", "gov", "proposal", "<id>"]), [])

    def test_gaiad_only_in_command_position(self):
        self.assertEqual(rc.invocations("journalctl -u gaiad -f"), [])
        self.assertEqual(rc.invocations("sudo systemctl restart gaiad"), [])
        self.assertEqual(rc.invocations("sudo -u gaia DAEMON_HOME=/x gaiad status"), [["status"]])
        self.assertEqual(rc.invocations("sudo -u gaia gaiad status"), [["status"]])
        self.assertEqual(rc.invocations("HOME=/x ./build/gaiad version"), [["version"]])

    def test_docker_entrypoint(self):
        line = "docker run --rm -v /a:/a --entrypoint gaiad ghcr.io/cosmos/gaia:v1 version --long"
        self.assertEqual(rc.invocations(line), [["version", "--long"]])
        self.assertEqual(rc.invocations("docker run -d -p 1:1 ghcr.io/cosmos/gaia:v1 --home /a"), [])

    def test_hidden_command(self):
        tree = FakeTree({**TREE.spec, ("completion",): ([], ["--zsh"], True, [])})
        self.assertEqual(rc.check_call(tree, ["completion", "--zsh"]), [])

    def test_inline_spans_outside_fences(self):
        text = "---\ntitle: x\n---\nRun `gaiad status` or `sudo -u gaia gaiad version`.\n```bash\n`gaiad skip`\n```\nNot `gaiadx` or `curl gaiad`.\n"
        self.assertEqual(list(rc.inline_commands(text)), [(4, "gaiad status"), (4, "sudo -u gaia gaiad version")])

    def test_takes_args(self):
        self.assertTrue(rc.takes_args("gaiad q bank balances [address] [flags]", 3))
        self.assertFalse(rc.takes_args("gaiad query [flags]", 1))
        self.assertFalse(rc.takes_args("gaiad query [command]", 1))

    def test_allow_rules(self):
        rules = [{"file": "a/b.mdx", "contains": "gaiad query provider", "problem": "unknown command"}]
        line = "The `gaiad query provider` command is gone."
        self.assertTrue(rc.allowed(rules, "a/b.mdx", line, "unknown command `gaiad query provider`"))
        self.assertFalse(rc.allowed(rules, "a/c.mdx", line, "unknown command `gaiad query provider`"))
        self.assertFalse(rc.allowed(rules, "a/b.mdx", line, "`gaiad query provider` has no flag `--x`"))

    def test_stamps(self):
        text = '<HubVerified date="1" />\n<HubVerified gaia="v29.0.1" reviewed date="2" />'
        self.assertEqual(rc.stamps(text, "v28.3.1"), ["v28.3.1", "v29.0.1"])


class BotDecisions(unittest.TestCase):
    def upgrade(self, **kw):
        base = {"proposal_id": 1, "status": "PASSED", "plan_name": "v30.0.0", "plan_height": 100,
                "release": "v30.0.0", "applied_height": 0, "binaries": {}}
        base.update(kw)
        return base

    def test_version_order(self):
        self.assertTrue(bot.newer("v29.0.1", "v29.0.0"))
        self.assertTrue(bot.newer("v29.1.0", "v29.1.0-rc0"))
        self.assertFalse(bot.newer("v29.0.0", "v29.0.1"))
        self.assertFalse(bot.newer("Latest", "v29.0.1"))

    def test_picks_newer_passed_or_voting(self):
        state = {"upgrades": [self.upgrade(status="REJECTED", release="v31.0.0"),
                              self.upgrade(status="VOTING_PERIOD", release="v30.0.0")]}
        self.assertEqual(bot.pick_upgrade(state, "v29.0.1")["release"], "v30.0.0")

    def test_ignores_older_and_deposit_period(self):
        state = {"upgrades": [self.upgrade(status="DEPOSIT_PERIOD", release="v31.0.0"),
                              self.upgrade(release="v29.0.0")]}
        self.assertIsNone(bot.pick_upgrade(state, "v29.0.1"))

    def test_plan_name_used_when_no_binaries(self):
        state = {"upgrades": [self.upgrade(release=None, plan_name="v30.0.0")]}
        self.assertEqual(bot.pick_upgrade(state, "v29.0.1")["release"], "v30.0.0")

    def test_approval_needs_a_code_owner(self):
        owners = {"danbryan", "qx-nico"}
        pr = {"reviews": [{"author": {"login": "someone"}, "state": "APPROVED"}]}
        self.assertFalse(bot.approved(pr, owners))
        pr["reviews"].append({"author": {"login": "qx-nico"}, "state": "APPROVED"})
        self.assertTrue(bot.approved(pr, owners))
        pr["reviews"].append({"author": {"login": "DanBryan"}, "state": "CHANGES_REQUESTED"})
        self.assertFalse(bot.approved(pr, owners))


class Detector(unittest.TestCase):
    def ep(self, operator, value, fresh=True):
        return {"operator": operator, "fresh": fresh, "x": value}

    def test_two_operators_must_agree(self):
        self.assertEqual(detect.agreed([self.ep("a", 1), self.ep("b", 1)], "x"), (True, 1))
        self.assertEqual(detect.agreed([self.ep("a", 1), self.ep("b", 2)], "x"), (False, None))

    def test_same_operator_counts_once(self):
        self.assertEqual(detect.agreed([self.ep("a", 1), self.ep("a", 1)], "x"), (False, None))

    def test_stale_endpoint_has_no_vote(self):
        self.assertEqual(detect.agreed([self.ep("a", 1), self.ep("b", 1, fresh=False)], "x"), (False, None))

    def test_release_tag_from_binaries(self):
        bins = {"linux/amd64": "https://github.com/cosmos/gaia/releases/download/v29.1.0-rc0/gaiad-v29.1.0-rc0-linux-amd64?checksum=sha256:ab"}
        self.assertEqual(detect.release_tag(bins), "v29.1.0-rc0")


if __name__ == "__main__":
    unittest.main()
