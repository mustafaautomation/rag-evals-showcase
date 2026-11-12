#!/usr/bin/env python3
"""Pull committed artifacts from the 10 public RAG eval repos into data/.

Re-runnable. Does not invent scores. Live RAGAS judge metrics stay unmeasured.

    python3 scripts/sync_sources.py
    python3 scripts/sync_sources.py --sources /path/to/clones
    python3 scripts/sync_sources.py --allow-missing

Default mode clones (or fast-forwards) each repo into .cache/sources.
--allow-missing writes a coming-soon industry when a repo cannot be read.
Without that flag a missing repo fails the script.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "sources"
DATA = ROOT / "data"
ORG = "mustafaautomation"

LIVE_METRICS = (
    "faithfulness",
    "answer_relevancy",
    "context_precision",
    "context_recall",
)

LABELS = {
    "hit_rate": "Hit rate",
    "mrr": "MRR",
    "non_llm_context_recall": "Non-LLM context recall",
    "non_llm_context_precision": "Non-LLM context precision",
    "string_presence": "String presence",
    "refusal_correctness": "Refusal correctness",
    "numeric_accuracy": "Numeric accuracy",
    "trap_avoidance": "Trap avoidance",
    "disclaimer_rate": "Disclaimer rate",
    "citation_rate": "Citation rate",
    "grounded_amounts": "Grounded amounts",
    "endpoint_validity": "Endpoint validity",
    "version_correctness": "Version correctness",
    "faithfulness": "Faithfulness",
    "answer_relevancy": "Answer relevancy",
    "context_precision": "Context precision",
    "context_recall": "Context recall",
}

CANON = {
    "hit_rate": "hit_rate",
    "hit rate": "hit_rate",
    "retrieval_hit_rate": "hit_rate",
    "retrieval hit rate": "hit_rate",
    "mrr": "mrr",
    "non_llm_context_recall": "non_llm_context_recall",
    "non-llm context recall": "non_llm_context_recall",
    "non_llm_context_precision": "non_llm_context_precision",
    "non-llm context precision": "non_llm_context_precision",
    "string_presence": "string_presence",
    "string presence": "string_presence",
    "answer_string_presence": "string_presence",
    "answer string presence": "string_presence",
    "refusal_correctness": "refusal_correctness",
    "refusal correctness": "refusal_correctness",
    "numeric_accuracy": "numeric_accuracy",
    "numeric accuracy": "numeric_accuracy",
    "trap_avoidance": "trap_avoidance",
    "trap avoidance": "trap_avoidance",
    "disclaimer_rate": "disclaimer_rate",
    "disclaimer rate": "disclaimer_rate",
    "citation_rate": "citation_rate",
    "citation rate": "citation_rate",
    "grounded_amounts": "grounded_amounts",
    "grounded amounts": "grounded_amounts",
    "endpoint_validity": "endpoint_validity",
    "endpoint validity": "endpoint_validity",
    "version_correctness": "version_correctness",
    "version correctness": "version_correctness",
    "faithfulness": "faithfulness",
    "answer_relevancy": "answer_relevancy",
    "answer relevancy": "answer_relevancy",
    "context_precision": "context_precision",
    "context precision": "context_precision",
    "context_recall": "context_recall",
    "context recall": "context_recall",
}

# Order matches the brief. Variant ids are the ones recorded in each repo.
REPOS = [
    {
        "slug": "support",
        "name": "Customer support",
        "repo": "support-rag-evals",
        "product": "Sableboard help center",
        "summary": "Synthetic help-center articles for a fictional kanban product. The offline gate scores the improved snapshot.",
        "report": "docs/eval-report.md",
        "questions": "data/eval/questions.jsonl",
        "gated": "improved",
        "variants": [
            {"id": "improved", "file": "data/snapshots/improved.jsonl", "role": "gated", "label": "improved"},
            {"id": "bad-retriever", "file": "data/snapshots/bad-retriever.jsonl", "role": "bad-retriever", "label": "bad-retriever"},
            {"id": "no-guardrail", "file": "data/snapshots/no-guardrail.jsonl", "role": "no-guardrail", "label": "no-guardrail"},
        ],
        "verified_notes": [
            ("README.md", "The offline embedder is a hashed TF-IDF vector", "Offline embedder in this repo is a hashed TF-IDF vector. Snapshot lines do not store vectors."),
        ],
    },
    {
        "slug": "legal",
        "name": "Legal and compliance",
        "repo": "legal-compliance-rag-evals",
        "product": "Helios Ledger policies",
        "summary": "Synthetic policy and regulation excerpts. The gated snapshot variant is named guarded.",
        "report": "docs/eval_report.md",
        "questions": "data/eval/questions.jsonl",
        "gated": "guarded",
        "variants": [
            {"id": "guarded", "file": "data/snapshots/guarded.jsonl", "role": "gated", "label": "guarded"},
            {"id": "bad_retriever", "file": "data/snapshots/bad_retriever.jsonl", "role": "bad-retriever", "label": "bad_retriever"},
            {"id": "no_guardrail", "file": "data/snapshots/no_guardrail.jsonl", "role": "no-guardrail", "label": "no_guardrail"},
        ],
    },
    {
        "slug": "medical",
        "name": "Healthcare documents",
        "repo": "medical-rag-evals",
        "product": "Harborlight clinic pages",
        "summary": "Synthetic clinic pages. The committed per-question snapshot is the baseline variant. Bad-retriever and no-guardrail numbers are the aggregate report only.",
        "report": "docs/sample_report.md",
        "report_json": "docs/sample_report.json",
        "questions": "data/eval/questions.jsonl",
        "gated": "baseline",
        "variants": [
            {"id": "baseline", "file": "data/snapshots/baseline_outputs.jsonl", "role": "gated", "label": "baseline"},
            {"id": "bad-retriever", "file": None, "role": "bad-retriever", "label": "bad-retriever"},
            {"id": "no-guardrail", "file": None, "role": "no-guardrail", "label": "no-guardrail"},
        ],
    },
    {
        "slug": "edtech",
        "name": "Tutoring",
        "repo": "edtech-tutor-rag-evals",
        "product": "Harborlight STAT 101",
        "summary": "Synthetic lesson notes for a fictional college course. One snapshot file holds improved, no_guardrail, and bad_retriever rows.",
        "report": "docs/example-report.md",
        "questions": "data/eval/questions.jsonl",
        "gated": "improved",
        "variants": [
            {"id": "improved", "file": "data/snapshots/pipeline_outputs.jsonl", "role": "gated", "label": "improved"},
            {"id": "bad_retriever", "file": "data/snapshots/pipeline_outputs.jsonl", "role": "bad-retriever", "label": "bad_retriever"},
            {"id": "no_guardrail", "file": "data/snapshots/pipeline_outputs.jsonl", "role": "no-guardrail", "label": "no_guardrail"},
        ],
        "chunk_style": "edtech-sections",
    },
    {
        "slug": "fintech",
        "name": "Financial diligence",
        "repo": "fintech-diligence-rag-evals",
        "product": "Harborline statements",
        "summary": "Synthetic financial statements. The report's baseline run is the broken variant: lowest-scoring chunks and a prompt that allows estimates.",
        "report": "docs/reports/offline_eval_report.md",
        "questions": "data/eval/questions.jsonl",
        "gated": "improved",
        "variants": [
            {"id": "improved", "file": "data/snapshots/improved.jsonl", "role": "gated", "label": "improved"},
            {
                "id": "baseline",
                "file": "data/snapshots/baseline.jsonl",
                "role": "broken",
                "label": "baseline",
                "note": "One recorded broken run. The report describes it as lowest-scoring chunks and a prompt that allows estimates, advice, and forecasts. This repo did not commit separate bad-retriever and no-guardrail files.",
            },
        ],
    },
    {
        "slug": "insurance",
        "name": "Insurance claims",
        "repo": "insurance-claims-rag-evals",
        "product": "Harborline Mutual pages",
        "summary": "Synthetic auto, home, and renters pages for a fictional insurer. Snapshots include retrieval scores.",
        "report": "docs/eval_report.md",
        "questions": "data/eval/questions.json",
        "gated": "improved",
        "variants": [
            {"id": "improved", "file": "data/snapshots/improved.jsonl", "role": "gated", "label": "improved"},
            {"id": "bad_retriever", "file": "data/snapshots/bad_retriever.jsonl", "role": "bad-retriever", "label": "bad_retriever"},
            {"id": "no_guardrail", "file": "data/snapshots/no_guardrail.jsonl", "role": "no-guardrail", "label": "no_guardrail"},
        ],
    },
    {
        "slug": "ecommerce",
        "name": "Product support",
        "repo": "ecommerce-product-rag-evals",
        "product": "Northline Supply catalog",
        "summary": "Synthetic catalog and policy pages. The report's baseline column is an inverted retriever plus an unguarded provider.",
        "report": "docs/eval_report.md",
        "questions": "data/eval/questions.json",
        "gated": "improved",
        "variants": [
            {"id": "improved", "file": "evals/snapshots/improved.jsonl", "role": "gated", "label": "improved"},
            {
                "id": "baseline",
                "file": "evals/snapshots/baseline.jsonl",
                "role": "broken",
                "label": "baseline",
                "note": "One recorded broken run. The report describes it as an inverted retriever plus an unguarded provider that invents a stock count and the discount code SAVE50. This repo did not commit separate bad-retriever and no-guardrail files.",
            },
        ],
    },
    {
        "slug": "real-estate",
        "name": "Listings and leases",
        "repo": "real-estate-rag-evals",
        "product": "Lantern House listings",
        "summary": "Synthetic listings, leases, and building rules. The committed per-question file is the baseline run. Bad-retriever and no-guardrail figures are report aggregates.",
        "report": "docs/eval_report.md",
        "questions": "data/eval/questions.json",
        "gated": "baseline",
        "variants": [
            {"id": "baseline", "file": "data/snapshots/offline_responses.jsonl", "role": "gated", "label": "baseline"},
            {"id": "bad-retriever", "file": None, "role": "bad-retriever", "label": "bad-retriever"},
            {"id": "no-guardrail", "file": None, "role": "no-guardrail", "label": "no-guardrail"},
        ],
    },
    {
        "slug": "hr",
        "name": "HR policy",
        "repo": "hr-policy-rag-evals",
        "product": "Cedarline Studio handbook",
        "summary": "Synthetic employee handbook. The committed per-question file is the standard pipeline, which the report calls improved. Bad-retriever and no-guardrail figures are report aggregates.",
        "report": "docs/eval-report.md",
        "questions": "data/eval/questions.jsonl",
        "gated": "standard",
        "variants": [
            {"id": "standard", "file": "data/snapshots/offline_pipeline.jsonl", "role": "gated", "label": "standard"},
            {"id": "bad-retriever", "file": None, "role": "bad-retriever", "label": "bad-retriever"},
            {"id": "no-guardrail", "file": None, "role": "no-guardrail", "label": "no-guardrail"},
        ],
        "chunk_style": "corpus-doc",
    },
    {
        "slug": "saas",
        "name": "SaaS docs",
        "repo": "saas-docs-rag-evals",
        "product": "Northline API docs",
        "summary": "Synthetic HTTP API docs. The naive snapshot is the broken retriever and the prompt with no guardrails, in one recorded run.",
        "report": "docs/eval-report.md",
        "questions": "evals/questions.jsonl",
        "gated": "improved",
        "variants": [
            {"id": "improved", "file": "evals/snapshots/improved.jsonl", "role": "gated", "label": "improved"},
            {
                "id": "naive",
                "file": "evals/snapshots/naive.jsonl",
                "role": "broken",
                "label": "naive",
                "note": "One recorded broken run. The report describes it as the broken retriever and the prompt with no guardrails. This repo did not commit separate bad-retriever and no-guardrail files.",
            },
        ],
    },
]


def canon(name: str) -> str:
    key = name.strip().lower()
    if key not in CANON:
        key2 = key.replace("-", " ")
        if key2 in CANON:
            return CANON[key2]
        raise SystemExit(f"unknown metric name: {name}")
    return CANON[key]


def parse_yaml_subset(text: str):
    lines = text.splitlines()

    def coerce(value: str):
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            if not inner:
                return []
            return [coerce(part.strip()) for part in inner.split(",")]
        if value in {"null", "~", ""}:
            return None
        if value in {"true", "false"}:
            return value == "true"
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            return value[1:-1]
        try:
            if re.fullmatch(r"-?\d+", value):
                return int(value)
            if re.fullmatch(r"-?\d+\.\d+", value):
                return float(value)
        except ValueError:
            pass
        return value

    def next_content(start: int):
        for j in range(start + 1, len(lines)):
            stripped = lines[j].strip()
            if stripped and not stripped.startswith("#"):
                return j
        return None

    root: dict = {}
    stack: list[tuple[int, object]] = [(-1, root)]
    i = 0
    while i < len(lines):
        raw = lines[i]
        if not raw.strip() or raw.strip().startswith("#"):
            i += 1
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        line = raw.strip()
        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()
        container = stack[-1][1]
        if line.startswith("- "):
            if not isinstance(container, list):
                raise SystemExit(f"list item outside a list: {line}")
            container.append(coerce(line[2:].strip()))
            i += 1
            continue
        if ":" not in line:
            raise SystemExit(f"cannot parse YAML line: {line}")
        key, _, rest = line.partition(":")
        key = key.strip()
        rest = rest.strip()
        if not isinstance(container, dict):
            raise SystemExit(f"key under a non-map: {key}")
        if rest == "":
            nxt = next_content(i)
            is_list = False
            if nxt is not None:
                nxt_line = lines[nxt]
                nxt_indent = len(nxt_line) - len(nxt_line.lstrip(" "))
                is_list = nxt_indent > indent and nxt_line.strip().startswith("- ")
            child: object = [] if is_list else {}
            container[key] = child
            stack.append((indent, child))
        else:
            container[key] = coerce(rest)
        i += 1
    return root


def split_row(line: str) -> list[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [cell.strip() for cell in line.split("|")]


def markdown_tables(md: str) -> list[tuple[list[str], list[list[str]]]]:
    lines = md.splitlines()
    tables = []
    i = 0
    while i < len(lines):
        if lines[i].strip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-{3,}", lines[i + 1]):
            header = split_row(lines[i])
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(split_row(lines[i]))
                i += 1
            tables.append((header, rows))
        else:
            i += 1
    return tables


def parse_score_cell(cell: str):
    cell = cell.strip().replace("**", "")
    match = re.fullmatch(r"(-?\d+(?:\.\d+)?)(?:\s*\((pass|fail)\))?", cell, flags=re.I)
    if not match:
        return None
    status = match.group(2).lower() if match.group(2) else None
    return float(match.group(1)), status


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_records(path: Path) -> list:
    if path.suffix == ".jsonl":
        rows = []
        for line in read_text(path).splitlines():
            if line.strip():
                rows.append(json.loads(line))
        return rows
    data = json.loads(read_text(path))
    if isinstance(data, dict) and "questions" in data:
        return data["questions"]
    if isinstance(data, list):
        return data
    raise SystemExit(f"unsupported JSON shape: {path}")


def question_from(row: dict) -> dict:
    if "expect_refusal" in row and "expected_behavior" not in row and "behaviour" not in row:
        behavior = "refuse" if row["expect_refusal"] else "answer"
    else:
        behavior = row.get("expected_behavior") or row.get("behaviour")
    tags = row.get("tags") or []
    topic = row.get("topic") or row.get("category") or (tags[0] if tags else None)
    reference = row.get("reference") or row.get("reference_answer") or row.get("reference_phrase")
    return {
        "id": row["id"],
        "question": row.get("question") or row.get("user_input"),
        "expectedBehavior": behavior,
        "topic": topic,
        "reference": reference,
        "referenceDocIds": list(row.get("reference_doc_ids") or []),
    }


def edtech_sections(corpus: Path) -> dict[str, str]:
    chunks: dict[str, str] = {}
    for path in sorted(corpus.glob("*.md")):
        text = read_text(path)
        match = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
        if not match:
            raise SystemExit(f"missing front matter: {path}")
        doc_id = None
        for line in match.group(1).splitlines():
            if line.startswith("id:"):
                doc_id = line.split(":", 1)[1].strip()
        if not doc_id:
            raise SystemExit(f"missing id: {path}")
        parts = re.split(r"(?m)^## (.+)$", match.group(2))
        for index in range(1, len(parts), 2):
            title = parts[index].strip()
            body = parts[index + 1].strip()
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            chunks[f"{doc_id}#{slug}"] = body
    return chunks


def corpus_docs(corpus: Path) -> dict[str, str]:
    docs = {}
    for path in sorted(corpus.glob("*")):
        if path.suffix.lower() not in {".md", ".txt"} or not path.is_file():
            continue
        docs[path.stem] = read_text(path).strip()
    return docs


def runs_from_file(path: Path, variant_id: str, repo: Path, chunk_style: str | None) -> list[dict]:
    rows = load_records(path)
    header_variant = None
    data = []
    for row in rows:
        if row.get("_meta") or row.get("_snapshot") or "id" not in row:
            if row.get("variant"):
                header_variant = row["variant"]
            continue
        data.append(row)
    if header_variant and header_variant != variant_id:
        raise SystemExit(f"{path} header variant {header_variant} != {variant_id}")
    sections = edtech_sections(repo / "data" / "corpus") if chunk_style == "edtech-sections" else {}
    docs = corpus_docs(repo / "data" / "corpus") if chunk_style == "corpus-doc" else {}
    runs = []
    for row in data:
        row_variant = row.get("variant") or variant_id
        if row_variant != variant_id:
            continue
        chunks = chunks_for(row, sections, docs, chunk_style)
        metrics = {}
        for key in ("hit", "non_llm_context_recall", "reciprocal_rank", "refusal_correctness", "string_presence"):
            if isinstance(row.get(key), (int, float)):
                metric_id = "mrr" if key == "reciprocal_rank" else ("hit_rate" if key == "hit" else key)
                metrics[metric_id] = row[key]
        behavior = row.get("behavior") if "behavior" in row else row.get("behaviour") if "behaviour" in row else None
        runs.append(
            {
                "questionId": row["id"],
                "variant": variant_id,
                "answer": row.get("response") if "response" in row else row.get("answer"),
                "guardrail": row.get("guardrail") if "guardrail" in row else None,
                "guardrailRecorded": "guardrail" in row,
                "refused": row.get("refused") if "refused" in row else None,
                "behavior": behavior,
                "chunks": chunks,
                "metrics": metrics or None,
            }
        )
    return runs


def chunks_for(row: dict, sections: dict[str, str], docs: dict[str, str], chunk_style: str | None) -> list[dict]:
    if chunk_style == "edtech-sections":
        ids = list(row.get("retrieved_ids") or [])
        chunks = []
        for rank, chunk_id in enumerate(ids, start=1):
            if chunk_id not in sections:
                raise SystemExit(f"unresolved edtech chunk {chunk_id}")
            doc_id = chunk_id.split("#", 1)[0]
            chunks.append(
                {
                    "rank": rank,
                    "docId": doc_id,
                    "chunkId": chunk_id,
                    "text": sections[chunk_id],
                    "score": None,
                    "textSource": "corpus-section",
                }
            )
        return chunks
    contexts = row.get("retrieved_contexts")
    doc_ids = list(row.get("retrieved_doc_ids") or [])
    chunk_ids = list(row.get("retrieved_chunk_ids") or [])
    scores = row.get("retrieval_scores")
    if isinstance(contexts, list):
        chunks = []
        for rank, text in enumerate(contexts, start=1):
            chunks.append(
                {
                    "rank": rank,
                    "docId": doc_ids[rank - 1] if rank - 1 < len(doc_ids) else None,
                    "chunkId": chunk_ids[rank - 1] if rank - 1 < len(chunk_ids) else None,
                    "text": text,
                    "score": scores[rank - 1] if isinstance(scores, list) and rank - 1 < len(scores) else None,
                    "textSource": "snapshot",
                }
            )
        return chunks
    if chunk_style == "corpus-doc" and doc_ids:
        chunks = []
        for rank, doc_id in enumerate(doc_ids, start=1):
            if doc_id not in docs:
                raise SystemExit(f"corpus file missing for recorded doc id {doc_id}")
            chunks.append(
                {
                    "rank": rank,
                    "docId": doc_id,
                    "chunkId": None,
                    "text": docs[doc_id],
                    "score": None,
                    "textSource": "corpus-file",
                }
            )
        return chunks
    return []


def column_index(header: list[str], *names: str) -> int | None:
    lowered = [cell.strip().lower() for cell in header]
    for name in names:
        if name.lower() in lowered:
            return lowered.index(name.lower())
    return None


def take_metrics(table, variant_columns: dict[str, list[str]], threshold_names: tuple[str, ...] = ("threshold", "minimum")):
    header, rows = table
    scores: dict[str, dict[str, float]] = {variant: {} for variant in variant_columns}
    statuses: dict[str, dict[str, str]] = {variant: {} for variant in variant_columns}
    thresholds: dict[str, float] = {}
    metric_idx = column_index(header, "metric", "metrics")
    if metric_idx is None:
        return None
    threshold_idx = None
    for name in threshold_names:
        threshold_idx = column_index(header, name)
        if threshold_idx is not None:
            break
    indexes = {}
    for variant, names in variant_columns.items():
        idx = column_index(header, *names)
        if idx is None:
            return None
        indexes[variant] = idx
    gate_idx = column_index(header, "improved", "improved gate", "gate", "result", "status")
    # Avoid treating the score column named "improved" as a gate column.
    if gate_idx is not None and any(gate_idx == idx for idx in indexes.values()):
        gate_idx = column_index(header, "improved gate", "gate", "result", "status")
        if gate_idx is not None and any(gate_idx == idx for idx in indexes.values()):
            gate_idx = None
    explicit: dict[str, str] = {}
    for row in rows:
        if metric_idx >= len(row) or not row[metric_idx]:
            continue
        metric = canon(row[metric_idx])
        if threshold_idx is not None and threshold_idx < len(row):
            parsed = parse_score_cell(row[threshold_idx])
            if parsed:
                thresholds[metric] = parsed[0]
        for variant, idx in indexes.items():
            parsed = parse_score_cell(row[idx])
            if not parsed:
                raise SystemExit(f"unparsed score {row[idx]!r} for {metric}/{variant}")
            scores[variant][metric] = parsed[0]
            if parsed[1]:
                statuses[variant][metric] = parsed[1]
        if gate_idx is not None and gate_idx < len(row):
            gate_cell = row[gate_idx].strip().lower()
            if gate_cell in {"pass", "fail"}:
                # This column belongs to the gated variant when the table says so.
                explicit.setdefault("__column__", gate_cell if gate_cell == "fail" else explicit.get("__column__", "pass"))
                if gate_cell == "fail":
                    explicit["__column__"] = "fail"
                elif "__column__" not in explicit:
                    explicit["__column__"] = "pass"
    return scores, statuses, thresholds, explicit


def merge_scores(dst, src):
    for variant, metrics in src.items():
        dst.setdefault(variant, {}).update(metrics)


def thresholds_from_file(repo: Path, spec: dict) -> dict[str, float]:
    slug = spec["slug"]
    if slug == "support":
        data = parse_yaml_subset(read_text(repo / "config/thresholds.yaml"))
        return {canon(k): float(v) for k, v in data["offline"].items()}
    if slug == "legal":
        data = parse_yaml_subset(read_text(repo / "configs/thresholds.yaml"))
        return {canon(k): float(v) for k, v in data["thresholds"].items()}
    if slug == "medical":
        data = parse_yaml_subset(read_text(repo / "data/eval/thresholds.yml"))
        return {canon(k): float(v) for k, v in data["offline"].items()}
    if slug == "edtech":
        data = parse_yaml_subset(read_text(repo / "config/thresholds.yaml"))
        return {canon(k): float(v) for k, v in data["offline"].items()}
    if slug == "insurance":
        data = parse_yaml_subset(read_text(repo / "config/thresholds.yml"))
        found = {}
        for key, value in data["metrics"].items():
            modes = value.get("modes") or []
            if "offline" in modes and key not in LIVE_METRICS:
                found[canon(key)] = float(value["minimum"])
        return found
    if slug == "ecommerce":
        data = json.loads(read_text(repo / "data/thresholds.json"))
        return {canon(k): float(v) for k, v in data["offline"].items()}
    if slug == "real-estate":
        data = parse_yaml_subset(read_text(repo / "evals/config.yaml"))
        return {canon(k): float(v) for k, v in data["thresholds"]["offline"].items()}
    if slug == "hr":
        data = parse_yaml_subset(read_text(repo / "eval_config.yaml"))
        return {canon(k): float(v) for k, v in data["thresholds"].items() if canon(k) not in LIVE_METRICS}
    if slug == "saas":
        data = parse_yaml_subset(read_text(repo / "config/thresholds.yaml"))
        return {canon(k): float(v) for k, v in data["offline"].items()}
    if slug == "fintech":
        return {}
    raise SystemExit(f"no threshold reader for {slug}")


def live_thresholds(repo: Path, spec: dict) -> dict[str, float]:
    slug = spec["slug"]
    if slug == "support":
        data = parse_yaml_subset(read_text(repo / "config/thresholds.yaml"))["live"]
    elif slug == "legal":
        data = parse_yaml_subset(read_text(repo / "configs/thresholds.yaml"))["live_thresholds"]
    elif slug == "medical":
        data = parse_yaml_subset(read_text(repo / "data/eval/thresholds.yml"))["live"]
    elif slug == "edtech":
        data = parse_yaml_subset(read_text(repo / "config/thresholds.yaml"))["live"]
    elif slug == "insurance":
        raw = parse_yaml_subset(read_text(repo / "config/thresholds.yml"))["metrics"]
        data = {k: v["minimum"] for k, v in raw.items() if "live" in (v.get("modes") or []) and k in LIVE_METRICS}
    elif slug == "ecommerce":
        data = json.loads(read_text(repo / "data/thresholds.json"))["live"]
    elif slug == "real-estate":
        data = parse_yaml_subset(read_text(repo / "evals/config.yaml"))["thresholds"]["live"]
    elif slug == "hr":
        raw = parse_yaml_subset(read_text(repo / "eval_config.yaml"))["thresholds"]
        data = {k: v for k, v in raw.items() if k in LIVE_METRICS}
    elif slug == "saas":
        data = parse_yaml_subset(read_text(repo / "config/thresholds.yaml"))["live"]
    elif slug == "fintech":
        # The committed report states these run only in live mode and were not called.
        # Threshold numbers are not in a config file in this repo, so none are copied.
        return {}
    else:
        raise SystemExit(slug)
    return {canon(k): float(v) for k, v in data.items()}


def check_thresholds(file_thresholds: dict[str, float], report_thresholds: dict[str, float], slug: str):
    if not report_thresholds:
        return file_thresholds
    if not file_thresholds:
        return report_thresholds
    for key, value in report_thresholds.items():
        if key not in file_thresholds:
            raise SystemExit(f"{slug}: report threshold {key} missing from config")
        if abs(file_thresholds[key] - value) > 1e-9:
            raise SystemExit(f"{slug}: threshold mismatch {key} config {file_thresholds[key]} report {value}")
    return file_thresholds


def variant_gate(metrics: dict[str, float], thresholds: dict[str, float], statuses: dict[str, str]) -> str | None:
    if not metrics:
        return None
    if any(status == "fail" for status in statuses.values()):
        return "fail"
    compared = False
    for key, score in metrics.items():
        if key in thresholds:
            compared = True
            if score + 1e-12 < thresholds[key]:
                return "fail"
    if statuses and all(status == "pass" for status in statuses.values()) and len(statuses) == len(metrics):
        return "pass"
    if compared:
        return "pass"
    return None


def parse_report(repo: Path, spec: dict) -> tuple[dict, dict, dict]:
    slug = spec["slug"]
    if slug == "medical":
        report = json.loads(read_text(repo / spec["report_json"]))
        scores = {}
        thresholds = {}
        explicit = {}
        for variant in report["variants"]:
            vid = variant["variant"]
            scores[vid] = {canon(k): float(v) for k, v in variant["metrics"].items()}
            thresholds = {canon(k): float(v) for k, v in variant["thresholds"].items()}
            explicit[vid] = "pass" if variant["passed"] else "fail"
        if report.get("judge_scores_included"):
            raise SystemExit("medical report claims judge scores; refusing to import them blindly")
        return scores, thresholds, explicit

    md = read_text(repo / spec["report"])
    tables = markdown_tables(md)
    scores: dict[str, dict[str, float]] = {}
    statuses: dict[str, dict[str, str]] = {}
    thresholds: dict[str, float] = {}
    explicit: dict[str, str] = {}

    def absorb(result, gate_variant: str | None = None):
        if result is None:
            return
        found, found_status, found_thresholds, found_explicit = result
        merge_scores(scores, found)
        for variant, metric_status in found_status.items():
            statuses.setdefault(variant, {}).update(metric_status)
        thresholds.update(found_thresholds)
        if gate_variant and "__column__" in found_explicit:
            explicit[gate_variant] = found_explicit["__column__"]

    if slug == "support":
        absorb(
            take_metrics(
                tables[0],
                {
                    "bad-retriever": ["bad-retriever"],
                    "no-guardrail": ["no-guardrail"],
                    "improved": ["improved"],
                },
            ),
            "improved",
        )
    elif slug == "legal":
        absorb(
            take_metrics(
                tables[0],
                {
                    "no_guardrail": ["Before: no-guardrail prompt"],
                    "guarded": ["After: guarded prompt"],
                    "bad_retriever": ["Bad retriever"],
                },
            )
        )
        if re.search(r"Gate on the guarded run\s+Passed\.", md):
            explicit["guarded"] = "pass"
    elif slug == "edtech":
        absorb(
            take_metrics(
                tables[0],
                {
                    "improved": ["improved"],
                    "no_guardrail": ["no_guardrail"],
                    "bad_retriever": ["bad_retriever"],
                },
            )
        )
    elif slug == "fintech":
        absorb(take_metrics(tables[0], {"improved": ["Score"]}), "improved")
        absorb(
            take_metrics(
                tables[1],
                {"baseline": ["Baseline"], "improved": ["Improved"]},
            )
        )
        if re.search(r"Baseline gate:\s*fail\.", md):
            explicit["baseline"] = "fail"
        if re.search(r"Improved gate:\s*pass\.", md):
            explicit["improved"] = "pass"
    elif slug == "insurance":
        absorb(
            take_metrics(
                tables[0],
                {
                    "improved": ["Improved"],
                    "no_guardrail": ["No-guardrail prompt"],
                    "bad_retriever": ["Bad retriever"],
                },
                threshold_names=("minimum",),
            ),
            "improved",
        )
    elif slug == "ecommerce":
        absorb(
            take_metrics(
                tables[0],
                {"baseline": ["Baseline"], "improved": ["Improved"]},
            ),
            "improved",
        )
    elif slug == "real-estate":
        absorb(
            take_metrics(
                tables[0],
                {"bad-retriever": ["Bad retriever"], "baseline": ["Baseline"]},
            )
        )
        absorb(
            take_metrics(
                tables[1],
                {"no-guardrail": ["No guardrail"], "baseline": ["Baseline"]},
            )
        )
    elif slug == "hr":
        absorb(take_metrics(tables[0], {"standard": ["Score"]}), "standard")
        absorb(
            take_metrics(
                tables[1],
                {
                    "bad-retriever": ["Bad retriever"],
                    "no-guardrail": ["No guardrail"],
                    "standard": ["Improved"],
                },
            )
        )
    elif slug == "saas":
        absorb(
            take_metrics(
                tables[0],
                {"improved": ["improved"], "naive": ["naive"]},
            ),
            "improved",
        )
    else:
        raise SystemExit(slug)

    file_thresholds = thresholds_from_file(repo, spec)
    merged_thresholds = check_thresholds(file_thresholds, thresholds, slug)
    for variant, metrics in scores.items():
        if variant not in explicit:
            gate = variant_gate(metrics, merged_thresholds, statuses.get(variant, {}))
            if gate:
                explicit[variant] = gate
        else:
            recomputed = variant_gate(metrics, merged_thresholds, statuses.get(variant, {}))
            if recomputed and recomputed != explicit[variant]:
                raise SystemExit(f"{slug} {variant}: explicit gate {explicit[variant]} != recomputed {recomputed}")
    return scores, merged_thresholds, explicit


def verified_notes(repo: Path, spec: dict) -> list[str]:
    notes = []
    for rel, needle, text in spec.get("verified_notes") or []:
        body = read_text(repo / rel)
        if needle not in body:
            raise SystemExit(f"{spec['slug']}: note no longer found in {rel}: {needle}")
        notes.append(text)
    meta = repo / "data" / "snapshots" / "snapshot_meta.json"
    if meta.exists():
        data = json.loads(read_text(meta))
        if data.get("embedder"):
            notes.append(f"Snapshot meta embedder: {data['embedder']}.")
        if data.get("judge_scores_note"):
            notes.append(data["judge_scores_note"])
    manifest = repo / "data" / "snapshots" / "manifest.json"
    if manifest.exists():
        data = json.loads(read_text(manifest))
        if data.get("note"):
            notes.append(data["note"])
    return notes


def featured_question(questions: list[dict], runs: list[dict]) -> str:
    by_question: dict[str, set[str]] = {}
    for run in runs:
        by_question.setdefault(run["questionId"], set()).add(re.sub(r"\s+", " ", (run["answer"] or "")).strip())
    behavior = {q["id"]: q.get("expectedBehavior") for q in questions}
    ranked = []
    for qid, answers in by_question.items():
        distinct = len([a for a in answers if a])
        trap = 0 if behavior.get(qid) in {None, "answer"} else 1
        ranked.append((distinct, trap, qid))
    if not ranked:
        return questions[0]["id"]
    ranked.sort(key=lambda item: (-item[0], -item[1], item[2]))
    return ranked[0][2]


def git_sha(path: Path) -> tuple[str, str]:
    sha = subprocess.check_output(["git", "-C", str(path), "rev-parse", "HEAD"], text=True).strip()
    date = subprocess.check_output(["git", "-C", str(path), "log", "-1", "--format=%cI"], text=True).strip()
    return sha, date


def ensure_repo(spec: dict, sources: Path | None) -> Path | None:
    repo = spec["repo"]
    if sources:
        path = sources / repo
        if not path.exists():
            return None
        return path
    dest = CACHE / repo
    url = f"https://github.com/{ORG}/{repo}.git"
    if dest.exists():
        subprocess.run(["git", "-C", str(dest), "fetch", "--depth", "1", "origin", "main"], check=True)
        subprocess.run(["git", "-C", str(dest), "reset", "--hard", "FETCH_HEAD"], check=True)
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "--depth", "1", "--branch", "main", url, str(dest)], check=True)
    return dest


def coming_soon(spec: dict) -> dict:
    return {
        "slug": spec["slug"],
        "name": spec["name"],
        "repo": spec["repo"],
        "product": spec["product"],
        "summary": spec["summary"],
        "status": "coming-soon",
        "repoUrl": f"https://github.com/{ORG}/{spec['repo']}",
        "questionCount": 0,
        "variants": [],
        "metrics": [],
        "liveMetrics": [],
    }


def build_industry(spec: dict, repo: Path) -> tuple[dict, dict]:
    sha, committed_at = git_sha(repo)
    questions = [question_from(row) for row in load_records(repo / spec["questions"])]
    if any(not q["question"] for q in questions):
        raise SystemExit(f"{spec['slug']}: question text missing")
    runs: list[dict] = []
    variant_meta = []
    for variant in spec["variants"]:
        replay = variant["file"] is not None
        variant_runs = []
        if replay:
            variant_runs = runs_from_file(repo / variant["file"], variant["id"], repo, spec.get("chunk_style"))
            if not variant_runs:
                raise SystemExit(f"{spec['slug']} {variant['id']}: snapshot produced no rows")
            runs.extend(variant_runs)
        variant_meta.append(
            {
                "id": variant["id"],
                "label": variant["label"],
                "role": variant["role"],
                "replay": replay,
                "note": variant.get("note"),
                "runCount": len(variant_runs),
            }
        )
    scores, thresholds, gates = parse_report(repo, spec)
    expected_ids = {v["id"] for v in spec["variants"]}
    if set(scores) != expected_ids:
        raise SystemExit(f"{spec['slug']}: report variants {sorted(scores)} != spec {sorted(expected_ids)}")
    if set(gates) != expected_ids:
        raise SystemExit(f"{spec['slug']}: missing gates {sorted(expected_ids - set(gates))}")
    for variant in variant_meta:
        variant["gate"] = gates[variant["id"]]
    metric_ids = []
    for metrics in scores.values():
        for key in metrics:
            if key not in metric_ids:
                metric_ids.append(key)
    metrics = []
    for key in metric_ids:
        metrics.append(
            {
                "id": key,
                "label": LABELS[key],
                "threshold": thresholds.get(key),
                "scores": {variant: scores[variant].get(key) for variant in scores if key in scores[variant]},
            }
        )
    live = [
        {
            "id": key,
            "label": LABELS[key],
            "threshold": value,
            "status": "unmeasured",
            "detail": "needs API key — not measured",
        }
        for key, value in live_thresholds(repo, spec).items()
    ]
    if spec["slug"] == "fintech":
        for key in LIVE_METRICS:
            live.append(
                {
                    "id": key,
                    "label": LABELS[key],
                    "threshold": None,
                    "status": "unmeasured",
                    "detail": "needs API key — not measured",
                }
            )
    qids = {q["id"] for q in questions}
    for run in runs:
        if run["questionId"] not in qids:
            raise SystemExit(f"{spec['slug']}: snapshot id {run['questionId']} missing from questions")
        if run["answer"] is None:
            raise SystemExit(f"{spec['slug']}: empty answer {run['questionId']} {run['variant']}")
    for variant in variant_meta:
        if not variant["replay"]:
            continue
        if not any(run["chunks"] for run in runs if run["variant"] == variant["id"]):
            raise SystemExit(f"{spec['slug']} {variant['id']}: snapshot has no retrieved chunks at all")
    report_url = f"https://github.com/{ORG}/{spec['repo']}/blob/{sha}/{spec['report']}"
    catalog = {
        "slug": spec["slug"],
        "name": spec["name"],
        "repo": spec["repo"],
        "product": spec["product"],
        "summary": spec["summary"],
        "status": "ready",
        "sourceCommit": sha,
        "sourceCommitDate": committed_at,
        "repoUrl": f"https://github.com/{ORG}/{spec['repo']}",
        "readmeUrl": f"https://github.com/{ORG}/{spec['repo']}/blob/{sha}/README.md",
        "reportUrl": report_url,
        "reportPath": spec["report"],
        "actionsUrl": f"https://github.com/{ORG}/{spec['repo']}/actions/workflows/ci.yml",
        "ciBadgeUrl": f"https://github.com/{ORG}/{spec['repo']}/actions/workflows/ci.yml/badge.svg",
        "questionCount": len(questions),
        "featuredQuestionId": featured_question(questions, runs),
        "gatedVariant": spec["gated"],
        "gate": gates[spec["gated"]],
        "variants": variant_meta,
        "metrics": metrics,
        "liveMetrics": live,
        "notes": verified_notes(repo, spec),
    }
    detail = {
        **catalog,
        "questions": questions,
        "runs": runs,
    }
    return catalog, detail


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", type=Path, help="Directory of already cloned repos, named by repo.")
    parser.add_argument("--allow-missing", action="store_true")
    args = parser.parse_args()
    industries = []
    details = []
    for spec in REPOS:
        path = ensure_repo(spec, args.sources)
        if path is None:
            if not args.allow_missing:
                raise SystemExit(f"missing repo {spec['repo']} (pass --allow-missing to record coming soon)")
            print(f"coming soon: {spec['repo']}", file=sys.stderr)
            industries.append(coming_soon(spec))
            continue
        print(f"sync {spec['repo']}")
        catalog, detail = build_industry(spec, path)
        industries.append({k: v for k, v in catalog.items()})
        details.append(detail)
        print(f"  {catalog['questionCount']} questions, gate {catalog['gate']}, commit {catalog['sourceCommit'][:8]}")
    payload = {
        "honesty": "Replays recorded offline runs from the public repos; synthetic data; personal open-source demos.",
        "industries": [{k: v for k, v in item.items()} for item in industries],
    }
    DATA.mkdir(parents=True, exist_ok=True)
    industry_dir = DATA / "industries"
    industry_dir.mkdir(parents=True, exist_ok=True)
    for stale in industry_dir.glob("*.json"):
        stale.unlink()
    (DATA / "catalog.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    for detail in details:
        (industry_dir / f"{detail['slug']}.json").write_text(json.dumps(detail, indent=2) + "\n", encoding="utf-8")
    blob = json.dumps(payload) + "".join(json.dumps(d) for d in details)
    if "Respond.io" in blob or "respond.io" in blob.lower():
        raise SystemExit("refusing to write a forbidden name")
    print(f"wrote {len(industries)} industries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
