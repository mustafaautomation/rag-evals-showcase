"""Tests for scripts/sync_sources.py. Standard library only; no network."""

from __future__ import annotations

import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "sync_sources.py"
spec = importlib.util.spec_from_file_location("sync_sources", SCRIPT)
sync = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(sync)


def failing_git(*args, **kwargs):
    raise subprocess.CalledProcessError(128, args[0] if args else "git")


class EnsureRepoTest(unittest.TestCase):
    SPEC = {"repo": "example-repo"}

    def test_clone_failure_reports_missing_repo(self):
        # --allow-missing only works if an unreadable repo comes back as None.
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(sync, "CACHE", Path(tmp)), mock.patch.object(
            sync.subprocess, "run", side_effect=failing_git
        ):
            self.assertIsNone(sync.ensure_repo(self.SPEC, None))

    def test_fetch_failure_reports_missing_repo(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(sync, "CACHE", Path(tmp)), mock.patch.object(
            sync.subprocess, "run", side_effect=failing_git
        ):
            (Path(tmp) / "example-repo").mkdir()
            self.assertIsNone(sync.ensure_repo(self.SPEC, None))

    def test_main_without_allow_missing_exits_with_message(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(sync, "CACHE", Path(tmp)), mock.patch.object(
            sync.subprocess, "run", side_effect=failing_git
        ), mock.patch.object(sync.sys, "argv", ["sync_sources.py"]):
            with self.assertRaises(SystemExit) as raised:
                sync.main()
            self.assertIn("missing repo", str(raised.exception.code))

    def test_sources_dir_missing_repo(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertIsNone(sync.ensure_repo(self.SPEC, Path(tmp)))


class VariantGateTest(unittest.TestCase):
    def test_score_below_threshold_fails(self):
        self.assertEqual(sync.variant_gate({"hit_rate": 0.7}, {"hit_rate": 0.8}, {}), "fail")

    def test_score_equal_to_threshold_passes(self):
        self.assertEqual(sync.variant_gate({"hit_rate": 0.8}, {"hit_rate": 0.8}, {}), "pass")

    def test_explicit_fail_status_wins(self):
        self.assertEqual(sync.variant_gate({"hit_rate": 1.0}, {"hit_rate": 0.8}, {"hit_rate": "fail"}), "fail")


class ParseScoreCellTest(unittest.TestCase):
    def test_bold_score_with_status(self):
        self.assertEqual(sync.parse_score_cell("**0.95 (PASS)**"), (0.95, "pass"))

    def test_non_numeric(self):
        self.assertIsNone(sync.parse_score_cell("n/a"))


if __name__ == "__main__":
    unittest.main()
