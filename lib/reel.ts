import { formatScore } from "@/lib/format";
import { getIndustry, catalog } from "@/lib/industries";
import type { IndustryDetail, RunRecord, VariantSummary } from "@/lib/types";

export type ReelChunk = {
  rank: number;
  label: string;
  score: string | null;
  text: string;
};

export type ReelFrame = {
  slug: string;
  name: string;
  variantId: string;
  variantLabel: string;
  gate: "pass" | "fail";
  question: string;
  chunks: ReelChunk[];
  guard: string;
  answer: string;
  citations: string[];
};

function clip(value: string, max: number) {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function guardLine(run: RunRecord | undefined) {
  if (!run) return "No per-question trace committed.";
  if (run.guardrailRecorded) return run.guardrail ? `Guardrail: ${run.guardrail}` : "Guardrail field: null";
  if (run.refused !== null) return run.refused ? "Refused: true" : "Refused: false";
  if (run.behavior) return `Behaviour: ${run.behavior}`;
  return "No guardrail field on this line.";
}

function frameFor(detail: IndustryDetail, questionId: string, variant: VariantSummary): ReelFrame {
  const question = detail.questions.find((item) => item.id === questionId) ?? detail.questions[0];
  const run = detail.runs.find((item) => item.questionId === question.id && item.variant === variant.id);
  const chunks = (run?.chunks ?? []).slice(0, 4).map((chunk) => ({
    rank: chunk.rank,
    label: chunk.chunkId ?? chunk.docId ?? `rank ${chunk.rank}`,
    score: chunk.score === null ? null : formatScore(chunk.score),
    text: clip(chunk.text, 140),
  }));
  const citations = [...new Set(chunks.map((chunk) => chunk.label.split("#")[0]).filter(Boolean))].slice(0, 4);
  return {
    slug: detail.slug,
    name: detail.name,
    variantId: variant.id,
    variantLabel: variant.label,
    gate: variant.gate,
    question: clip(question?.question ?? "", 180),
    chunks,
    guard: guardLine(run),
    answer: clip(run?.answer ?? "No per-question answer committed.", 200),
    citations,
  };
}

export function buildReel(): ReelFrame[] {
  const frames: ReelFrame[] = [];
  for (const summary of catalog.industries) {
    const detail = getIndustry(summary.slug);
    if (!detail || detail.status !== "ready") continue;
    const questionId = detail.featuredQuestionId ?? detail.questions[0]?.id;
    if (!questionId) continue;
    const gated = detail.variants.find((variant) => variant.id === detail.gatedVariant);
    const broken = detail.variants.find((variant) => variant.gate === "fail" && variant.replay);
    for (const variant of [gated, broken]) {
      if (!variant || !variant.replay) continue;
      frames.push(frameFor(detail, questionId, variant));
    }
  }
  return frames;
}
