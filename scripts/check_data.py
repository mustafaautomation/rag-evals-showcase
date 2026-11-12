#!/usr/bin/env python3
"""Check committed showcase JSON. Does not fetch repositories."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HONESTY = "Replays recorded offline runs from the public repos; synthetic data; personal open-source demos."
LIVE = "needs API key — not measured"
SLUGS = [
    "support",
    "legal",
    "medical",
    "edtech",
    "fintech",
    "insurance",
    "ecommerce",
    "real-estate",
    "hr",
    "saas",
]


def fail(message: str) -> None:
    raise SystemExit(message)


def main() -> int:
    catalog = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))
    if catalog.get("honesty") != HONESTY:
        fail("honesty line missing or altered")
    industries = catalog.get("industries") or []
    if [item["slug"] for item in industries] != SLUGS:
        fail(f"industry order { [item.get('slug') for item in industries] }")
    blob_parts = [(ROOT / "data" / "catalog.json").read_text(encoding="utf-8")]
    for industry in industries:
        if industry.get("status") != "ready":
            fail(f"{industry.get('slug')} is not ready")
        if industry.get("gate") != "pass":
            fail(f"{industry['slug']} gated result is not pass")
        if not any(variant.get("gate") == "fail" for variant in industry["variants"]):
            fail(f"{industry['slug']} has no failing variant")
        if not any(variant.get("replay") for variant in industry["variants"]):
            fail(f"{industry['slug']} has no replay")
        for live in industry["liveMetrics"]:
            if live.get("status") != "unmeasured" or live.get("detail") != LIVE:
                fail(f"{industry['slug']} live metric is not marked unmeasured")
            if "score" in live:
                fail("live metric includes a score")
        path = ROOT / "data" / "industries" / f"{industry['slug']}.json"
        detail = json.loads(path.read_text(encoding="utf-8"))
        blob_parts.append(path.read_text(encoding="utf-8"))
        if len(detail["questions"]) != industry["questionCount"]:
            fail(f"{industry['slug']} question count mismatch")
        if detail["questions"][0]["question"] in ("", None):
            fail("blank question")
        qids = {row["id"] for row in detail["questions"]}
        if not detail["runs"]:
            fail(f"{industry['slug']} has no runs")
        for run in detail["runs"]:
            if run["questionId"] not in qids:
                fail(f"orphan run {run['questionId']}")
            if not isinstance(run.get("answer"), str) or not run["answer"].strip():
                fail("blank answer")
        gated = next(variant for variant in detail["variants"] if variant["id"] == detail["gatedVariant"])
        if gated["gate"] != "pass" or not gated["replay"]:
            fail(f"{industry['slug']} gated variant is not a passing replay")
    blob = "\n".join(blob_parts)
    if "respond.io" in blob.lower() or "coming soon" in blob.lower():
        fail("forbidden or placeholder copy in data")
    support = json.loads((ROOT / "data" / "industries" / "support.json").read_text(encoding="utf-8"))
    no_guard = next(run for run in support["runs"] if run["questionId"] == "q27" and run["variant"] == "no-guardrail")
    if "$50" not in no_guard["answer"]:
        fail("support q27 no-guardrail answer was not the recorded line")
    improved = next(run for run in support["runs"] if run["questionId"] == "q01" and run["variant"] == "improved")
    if "$12" not in improved["answer"]:
        fail("support q01 improved answer missing recorded price")
    insurance = json.loads((ROOT / "data" / "industries" / "insurance.json").read_text(encoding="utf-8"))
    scored = [
        chunk
        for run in insurance["runs"]
        if run["variant"] == "improved"
        for chunk in run["chunks"]
        if isinstance(chunk.get("score"), (int, float))
    ]
    if not scored:
        fail("insurance retrieval scores missing")
    edtech = json.loads((ROOT / "data" / "industries" / "edtech.json").read_text(encoding="utf-8"))
    if not any(chunk["text"].strip() for run in edtech["runs"] for chunk in run["chunks"]):
        fail("edtech chunk text missing")
    print(f"checked {len(industries)} industries")
    return 0


if __name__ == "__main__":
    sys.exit(main())
