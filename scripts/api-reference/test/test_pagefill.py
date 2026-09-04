"""Tests for the shared page filler and its guards."""

import json
import tempfile
import unittest
from pathlib import Path

import pagefill


class CompletenessGuard(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        directory = self.root / "sdk" / "next" / "api-reference"
        directory.mkdir(parents=True)
        (directory / "inventory.json").write_text(json.dumps({
            "queries": ["cosmos.bank.v1beta1.Query/Balance",
                        "cosmos.bank.v1beta1.Query/AllBalances"],
            "messages": ["cosmos.bank.v1beta1.MsgSend"],
        }))
        self._saved = pagefill.REPO_ROOT
        pagefill.REPO_ROOT = self.root

    def tearDown(self):
        pagefill.REPO_ROOT = self._saved

    def test_passes_when_the_parse_covers_the_inventory(self):
        pagefill.assert_complete("next", [
            "cosmos.bank.v1beta1.Query/Balance",
            "cosmos.bank.v1beta1.Query/AllBalances",
        ], "queries")

    def test_fails_and_names_a_method_the_parse_missed(self):
        with self.assertRaises(pagefill.Incomplete) as caught:
            pagefill.assert_complete("next", ["cosmos.bank.v1beta1.Query/Balance"], "queries")
        self.assertIn("AllBalances", str(caught.exception))

    def test_an_extra_parsed_name_is_not_a_failure(self):
        pagefill.assert_complete("next", [
            "cosmos.bank.v1beta1.Query/Balance",
            "cosmos.bank.v1beta1.Query/AllBalances",
            "cosmos.bank.v1beta1.Query/SomethingElse",
        ], "queries")

    def test_a_missing_inventory_is_a_failure_not_a_pass(self):
        (self.root / "sdk" / "next" / "api-reference" / "inventory.json").unlink()
        with self.assertRaises(pagefill.Incomplete):
            pagefill.assert_complete("next", [], "queries")


class GeneratedFrom(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.directory = self.root / "sdk" / "next" / "api-reference" / "rest"
        self.directory.mkdir(parents=True)
        self._saved = pagefill.REPO_ROOT
        pagefill.REPO_ROOT = self.root

    def tearDown(self):
        pagefill.REPO_ROOT = self._saved

    def test_returns_the_sha_and_ref_recorded_by_the_generator(self):
        (self.directory / "openapi.yaml").write_text(
            "info:\n  description: >-\n    Generated from cosmos/cosmos-sdk at commit "
            "2086680ff8b08fd269ee653e087ea577bab79534 on ref\n    `main`.\n"
        )
        repository, sha, ref = pagefill.generated_from("next")
        self.assertEqual(repository, "cosmos/cosmos-sdk")
        self.assertEqual(sha, "2086680ff8b08fd269ee653e087ea577bab79534")
        self.assertEqual(ref, "main")

    def test_a_ref_containing_a_slash_is_captured_whole(self):
        (self.directory / "openapi.yaml").write_text(
            "info:\n  description: >-\n    Generated from cosmos/cosmos-sdk at commit "
            "2086680ff8b08fd269ee653e087ea577bab79534 on ref\n    `release/v0.55.x`.\n"
        )
        _, _, ref = pagefill.generated_from("next")
        self.assertEqual(ref, "release/v0.55.x")

    def test_raises_incomplete_when_the_line_is_absent(self):
        (self.directory / "openapi.yaml").write_text("info:\n  description: nothing here\n")
        with self.assertRaises(pagefill.Incomplete):
            pagefill.generated_from("next")


class UnfillableCarriesTheField(unittest.TestCase):
    """`claim` in a findings.Finding comes from this: the exception must carry
    the field it failed on, and the page's own note for it, resolved at the
    raise site. A caller reading `.note` must never fall back to re-deriving
    it from a table of its own choosing, because `fill()` rebinds the field
    table when it recurses into a nested type: a caller that resolved the
    note itself from the top-level table would either miss a nested field
    entirely or, worse, match an unrelated same-named field at the top level.
    """

    def blank_page(self):
        return {"name": "x.mdx", "text": "", "types": {}, "enums": {}, "by_anchor": {},
                "dec_decimal": False}

    def test_a_constrained_placeholder_names_its_field_and_note(self):
        with self.assertRaises(pagefill.Unfillable) as caught:
            pagefill.fill_value("<string>", "must match a hex string", "`string`",
                                self.blank_page(), {}, "memo_hash")
        self.assertEqual(caught.exception.field, "memo_hash")
        self.assertEqual(caught.exception.note, "must match a hex string")

    def test_an_unstated_dec_encoding_names_its_field_and_note(self):
        with self.assertRaises(pagefill.Unfillable) as caught:
            pagefill.fill_value("<string>", "Encoded as cosmos.Dec", "`string`",
                                self.blank_page(), {}, "amount")
        self.assertEqual(caught.exception.field, "amount")
        self.assertEqual(caught.exception.note, "Encoded as cosmos.Dec")

    def test_an_any_with_no_concrete_type_names_its_field_and_note(self):
        body = {"grantee": {"@type": "/cosmos.example.Authorization"}}
        with self.assertRaises(pagefill.Unfillable) as caught:
            pagefill.fill(body, self.blank_page(), {}, {"grantee": ("names no concrete type", "")})
        self.assertEqual(caught.exception.field, "grantee")
        self.assertEqual(caught.exception.note, "names no concrete type")

    def test_a_nested_fields_note_does_not_leak_from_a_same_named_top_level_field(self):
        """The regression this exists to catch. `grant.expiration` is
        unfillable because its own (nested) note requires an RFC 3339 form
        the page never states, but the top-level example also happens to
        carry an `expiration` key, documented completely differently. A
        caller that resolved the note from the top-level table would report
        the wrong field's note as the reason.
        """
        page = self.blank_page()
        page["by_anchor"] = {"cosmos-authz-v1beta1-grant": "cosmos.authz.v1beta1.Grant"}
        page["types"] = {
            "cosmos.authz.v1beta1.Grant": {
                "expiration": ("Written as an RFC 3339 timestamp; this page states no example form.",
                               "`google.protobuf.Timestamp`"),
            },
        }
        top_level_fields = {
            "grant": ("the authorization being granted", "[`Grant`](#cosmos-authz-v1beta1-grant)"),
            # A same-named, unrelated top-level field with a different note.
            # If the runner-level lookup ever regresses to consulting this
            # table instead of the exception, this is what it would wrongly
            # report.
            "expiration": ("an unrelated top-level field that happens to share a name", "`string`"),
        }
        body = {"grant": {"expiration": "<string>"}}

        with self.assertRaises(pagefill.Unfillable) as caught:
            pagefill.fill(body, page, {}, top_level_fields)

        self.assertEqual(caught.exception.field, "expiration")
        self.assertEqual(
            caught.exception.note,
            "Written as an RFC 3339 timestamp; this page states no example form.",
        )
        self.assertNotEqual(
            caught.exception.note,
            "an unrelated top-level field that happens to share a name",
        )


if __name__ == "__main__":
    unittest.main()
