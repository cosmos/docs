"""Tests for the findings document."""

import json
import tempfile
import unittest
from pathlib import Path

import findings


def one(**overrides) -> findings.Finding:
    defaults = dict(
        page="bank.mdx",
        anchor="#balance",
        method="cosmos.bank.v1beta1.Query/Balance",
        claim="Encoded as cosmos.AddressString.",
        sent={"address": "cosmos1abc", "denom": "stake"},
        response="rpc error: code = InvalidArgument",
        verdict="page-defect",
        manifest_entry=None,
    )
    return findings.Finding(**{**defaults, **overrides})


class Document(unittest.TestCase):
    def test_carries_the_run_identity_so_a_finding_can_be_reproduced(self):
        document = findings.document("next", "cosmos/cosmos-sdk", "release/v0.54.x", "2086680",
                                     "query-onchain", {"pass": 80}, [one()])
        self.assertEqual(document["version"], "next")
        self.assertEqual(document["repository"], "cosmos/cosmos-sdk")
        self.assertEqual(document["ref"], "release/v0.54.x")
        self.assertEqual(document["sha"], "2086680")
        self.assertEqual(document["runner"], "query-onchain")

    def test_totals_count_the_findings_it_actually_carries(self):
        document = findings.document("next", "cosmos/cosmos-sdk", "main", "abc",
                                     "query-onchain", {"pass": 80}, [one(), one(method="x")])
        self.assertEqual(document["totals"]["findings"], 2)

    def test_rejects_a_verdict_outside_the_schema(self):
        with self.assertRaises(ValueError):
            findings.document("next", "cosmos/cosmos-sdk", "main", "abc", "query-onchain",
                              {}, [one(verdict="bad")])

    def test_round_trips_through_json(self):
        document = findings.document("next", "cosmos/cosmos-sdk", "main", "abc",
                                     "query-onchain", {}, [one()])
        path = Path(tempfile.mkdtemp()) / "findings.json"
        findings.write(path, document)
        self.assertEqual(json.loads(path.read_text()), document)

    def test_matches_the_golden_document(self):
        document = findings.document("next", "cosmos/cosmos-sdk", "release/v0.54.x", "2086680",
                                     "query-onchain", {"pass": 80, "environmental": 25, "known": 18},
                                     [one()])
        golden = json.loads((Path(__file__).parent / "golden" / "query-findings.json").read_text())
        self.assertEqual(document, golden)


class StaleManifestEntry(unittest.TestCase):
    """The verdict for manifest rot, which no other test reaches.

    Both runners emit it from branches that only fire against a live chain, so
    without this the schema could reject the verdict and nothing offline would
    notice until a release run.
    """

    def test_the_document_accepts_it_and_counts_it_as_a_finding(self):
        stale = one(
            page="query-coverage.toml",
            anchor="",
            claim="no stated form for denom",
            sent=None,
            response="the manifest names a method the pages no longer document; "
                     "delete the entry",
            verdict="stale-manifest-entry",
            manifest_entry="cosmos.bank.v1beta1.Query/Balance",
        )
        document = findings.document("next", "cosmos/cosmos-sdk", "main", "abc",
                                     "query-onchain", {"pass": 80}, [stale])
        self.assertEqual(document["totals"]["findings"], 1)
        self.assertEqual(document["findings"][0]["verdict"], "stale-manifest-entry")

    def test_it_survives_a_round_trip_to_disk(self):
        document = findings.document("next", "cosmos/cosmos-sdk", "main", "abc",
                                     "tx-onchain", {"success": 40},
                                     [one(verdict="stale-manifest-entry")])
        path = Path(tempfile.mkdtemp()) / "findings.json"
        findings.write(path, document)
        self.assertEqual(json.loads(path.read_text()), document)

    def test_render_names_the_verdict_so_a_reader_sees_why_the_run_failed(self):
        text = findings.render(findings.document(
            "next", "cosmos/cosmos-sdk", "main", "abc", "tx-onchain", {},
            [one(verdict="stale-manifest-entry")]))
        self.assertIn("stale-manifest-entry", text)


class ClaimFor(unittest.TestCase):
    """A page-defect finding has to carry what the page told the reader.

    Without it a repair step reading the file knows the chain rejected
    something but not what the page claimed, which is the half it needs.
    """

    FIELDS = {
        "address": ("The address to query balances for. Encoded as cosmos.AddressString.", ""),
        "denom": ("The coin denomination.", ""),
        "pagination": ("", ""),
    }

    def test_joins_the_notes_for_the_fields_actually_sent(self):
        claim = findings.claim_for(self.FIELDS, {"address": "cosmos1abc", "denom": "stake"})
        self.assertIn("address: The address to query balances for.", claim)
        self.assertIn("denom: The coin denomination.", claim)

    def test_omits_a_field_the_payload_does_not_carry(self):
        claim = findings.claim_for(self.FIELDS, {"denom": "stake"})
        self.assertNotIn("address", claim)

    def test_skips_a_field_the_page_says_nothing_about(self):
        self.assertEqual(findings.claim_for(self.FIELDS, {"pagination": {}}), "")

    def test_is_empty_when_nothing_was_sent(self):
        self.assertEqual(findings.claim_for(self.FIELDS, None), "")
        self.assertEqual(findings.claim_for({}, {"address": "cosmos1abc"}), "")


class Render(unittest.TestCase):
    def test_names_the_page_and_anchor_a_reader_would_land_on(self):
        text = findings.render(findings.document("next", "cosmos/cosmos-sdk", "main", "abc",
                                                 "query-onchain", {"pass": 1}, [one()]))
        self.assertIn("bank.mdx#balance", text)

    def test_says_so_plainly_when_there_is_nothing_to_report(self):
        text = findings.render(findings.document("next", "cosmos/cosmos-sdk", "main", "abc",
                                                 "query-onchain", {"pass": 123}, []))
        self.assertIn("no findings", text)


if __name__ == "__main__":
    unittest.main()
