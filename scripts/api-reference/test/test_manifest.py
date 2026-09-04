"""Tests for the unified coverage manifest."""

import tempfile
import unittest
from pathlib import Path

import manifest


def write(text: str) -> Path:
    path = Path(tempfile.mkdtemp()) / "coverage.toml"
    path.write_text(text)
    return path


class Load(unittest.TestCase):
    def test_applies_the_default_expect_when_an_entry_omits_it(self):
        path = write('''
[cases."cosmos.authz.v1beta1.MsgExec"]
note = "needs a grant first"
requires = ["cosmos.authz.v1beta1.MsgGrant"]
''')
        entries = manifest.load(path, manifest.TX_VOCABULARY, default="success")
        self.assertEqual(entries["cosmos.authz.v1beta1.MsgExec"]["expect"], "success")

    def test_an_ordering_only_entry_needs_no_note(self):
        path = write('''
[cases."cosmos.gov.v1.MsgVote"]
requires = ["cosmos.gov.v1.MsgSubmitProposal"]
''')
        manifest.load(path, manifest.TX_VOCABULARY, default="success")

    def test_reads_cases_keyed_by_qualified_name(self):
        path = write("""
[cases."cosmos.bank.v1beta1.Query/Balance"]
expect = "unfillable"
note = "no stated form for denom"
""")
        entries = manifest.load(path, manifest.QUERY_VOCABULARY)
        self.assertEqual(entries["cosmos.bank.v1beta1.Query/Balance"]["expect"], "unfillable")
        self.assertEqual(entries["cosmos.bank.v1beta1.Query/Balance"]["note"], "no stated form for denom")

    def test_carries_requires_and_signer_through(self):
        path = write("""
[cases."cosmos.authz.v1beta1.MsgExec"]
expect = "success"
note = "needs a grant first"
requires = ["cosmos.authz.v1beta1.MsgGrant"]
signer = "second"
""")
        entry = manifest.load(path, manifest.TX_VOCABULARY)["cosmos.authz.v1beta1.MsgExec"]
        self.assertEqual(entry["requires"], ["cosmos.authz.v1beta1.MsgGrant"])
        self.assertEqual(entry["signer"], "second")

    def test_rejects_an_expect_value_outside_the_vocabulary(self):
        path = write("""
[cases."cosmos.bank.v1beta1.Query/Balance"]
expect = "state-error"
note = "wrong vocabulary for a query"
""")
        with self.assertRaises(manifest.Invalid) as caught:
            manifest.load(path, manifest.QUERY_VOCABULARY)
        self.assertIn("state-error", str(caught.exception))

    def test_requires_a_note_when_an_entry_claims_more_than_ordering(self):
        path = write("""
[cases."cosmos.bank.v1beta1.Query/Balance"]
expect = "unfillable"
""")
        with self.assertRaises(manifest.Invalid):
            manifest.load(path, manifest.QUERY_VOCABULARY)

    def test_rejects_a_legacy_table_rather_than_ignoring_it(self):
        path = write("""
[queries."cosmos.bank.v1beta1.Query/Balance"]
expect = "unfillable"
note = "old shape"
""")
        with self.assertRaises(manifest.Invalid) as caught:
            manifest.load(path, manifest.QUERY_VOCABULARY)
        self.assertIn("cases", str(caught.exception))


class Orphans(unittest.TestCase):
    def test_reports_an_entry_with_nothing_documented(self):
        self.assertEqual(
            manifest.orphans({"a": {}, "b": {}}, {"a"}),
            ["b"],
        )

    def test_is_quiet_when_every_entry_matches(self):
        self.assertEqual(manifest.orphans({"a": {}}, {"a", "b"}), [])


class Classify(unittest.TestCase):
    ERRORS = {"malformed": ["invalid character", "unknown field"],
              "environmental": ["not found", "no delegation"]}

    def test_a_malformed_error_is_a_documentation_defect(self):
        self.assertEqual(
            manifest.classify("rpc error: invalid character 'x'", self.ERRORS),
            "malformed",
        )

    def test_an_environmental_error_is_not(self):
        self.assertEqual(manifest.classify("validator not found", self.ERRORS), "environmental")

    def test_malformed_wins_when_both_match(self):
        self.assertEqual(
            manifest.classify("unknown field, and not found", self.ERRORS),
            "malformed",
        )

    def test_an_unrecognised_error_is_unclassified_rather_than_guessed(self):
        self.assertEqual(
            manifest.classify("something upstream reworded", self.ERRORS),
            "unclassified",
        )

    def test_matching_ignores_case(self):
        self.assertEqual(manifest.classify("INVALID CHARACTER", self.ERRORS), "malformed")


if __name__ == "__main__":
    unittest.main()
