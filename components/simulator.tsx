"use client";

import { useEffect, useMemo, useState } from "react";
import { TEXT_SOURCE_LABEL, formatScore, formatThreshold, passesThreshold } from "@/lib/format";
import type { IndustryDetail, RunRecord, VariantSummary } from "@/lib/types";

const STAGES = ["Query", "Chunk and embed", "Top-k retrieval", "Guardrail", "Answer", "Metric scoring", "Threshold gate"];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sameAnswer(left: string | undefined, right: string | undefined) {
  return (left ?? "").replace(/\s+/g, " ").trim() === (right ?? "").replace(/\s+/g, " ").trim();
}

export function Simulator({ industry }: { industry: IndustryDetail }) {
  const [questionId, setQuestionId] = useState(industry.featuredQuestionId ?? industry.questions[0]?.id ?? "");
  const [variantId, setVariantId] = useState(industry.gatedVariant ?? industry.variants[0]?.id ?? "");
  const [filter, setFilter] = useState<"all" | "other">("all");
  const [trace, setTrace] = useState({ shown: STAGES.length, playing: false });

  const question = industry.questions.find((item) => item.id === questionId) ?? industry.questions[0];
  const variant = industry.variants.find((item) => item.id === variantId) ?? industry.variants[0];
  const run = industry.runs.find((item) => item.questionId === question?.id && item.variant === variant?.id);
  const gatedRun = industry.runs.find((item) => item.questionId === question?.id && item.variant === industry.gatedVariant);

  const visibleQuestions = useMemo(() => {
    const filtered = industry.questions.filter((item) => {
      if (filter === "all") return true;
      return item.expectedBehavior !== null && item.expectedBehavior !== "answer";
    });
    if (question && !filtered.some((item) => item.id === question.id)) return [question, ...filtered];
    return filtered;
  }, [filter, industry.questions, question]);

  function play() {
    if (prefersReducedMotion()) {
      setTrace({ shown: STAGES.length, playing: false });
      return;
    }
    setTrace({ shown: 0, playing: true });
  }

  useEffect(() => {
    if (!trace.playing) return;
    const timer = window.setTimeout(() => {
      setTrace((current) => {
        const shown = Math.min(STAGES.length, current.shown + 1);
        return { shown, playing: shown < STAGES.length };
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [trace]);

  if (!question || !variant) return null;

  return (
    <div data-testid="replay-state" data-state={trace.playing ? "playing" : "done"}>
      <div className="controls">
        <label className="field">
          Labelled behaviour
          <select value={filter} onChange={(event) => setFilter(event.target.value as "all" | "other")}>
            <option value="all">All questions</option>
            <option value="other">Refusal, trap, or other</option>
          </select>
        </label>
        <label className="field">
          Question
          <select
            data-testid="question-select"
            value={question.id}
            onChange={(event) => setQuestionId(event.target.value)}
          >
            {visibleQuestions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} — {item.question.length > 110 ? `${item.question.slice(0, 110)}…` : item.question}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="replay" data-testid="replay" onClick={play}>
          Replay trace
        </button>
      </div>
      <div className="variant-row" role="radiogroup" aria-label="Recorded variant">
        {industry.variants.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={item.id === variant.id}
            data-testid={`variant-${item.id}`}
            data-gate={item.gate}
            onClick={() => setVariantId(item.id)}
          >
            {item.label} · {item.gate === "pass" ? "PASS" : "FAIL"}
          </button>
        ))}
      </div>
      {variant.note ? <p className="note">{variant.note}</p> : null}
      {!variant.replay ? (
        <p className="note">
          Per-question chunks and answers for {variant.label} were not committed. The scores below are the
          variant averages from the report. This page does not invent a trace.
        </p>
      ) : null}
      <div className="stage-list">
        <Stage index={0} shown={trace.shown} title="Query">
          <p className="answer">{question.question}</p>
          <p>
            Labelled behaviour: {question.expectedBehavior ?? "not recorded"}.
            {question.topic ? ` Topic: ${question.topic}.` : ""}
          </p>
        </Stage>
        <Stage index={1} shown={trace.shown} title="Chunk and embed">
          <ChunkStage industry={industry} run={run} replay={variant.replay} />
        </Stage>
        <Stage index={2} shown={trace.shown} title="Top-k retrieval">
          <Retrieval run={run} replay={variant.replay} />
        </Stage>
        <Stage index={3} shown={trace.shown} title="Guardrail">
          <Guardrail run={run} replay={variant.replay} />
        </Stage>
        <Stage index={4} shown={trace.shown} title="Answer">
          <Answer run={run} gatedRun={gatedRun} variant={variant} industry={industry} />
        </Stage>
        <Stage index={5} shown={trace.shown} title="Metric scoring">
          <Scoring industry={industry} variant={variant} run={run} />
        </Stage>
        <Stage index={6} shown={trace.shown} title="Threshold gate">
          <div key={variant.id} className="gate-plate" data-testid="gate" data-status={variant.gate}>
            {variant.gate === "pass" ? "PASS" : "FAIL"}
          </div>
          <p>
            Offline gate for the {variant.label} variant, taken from the committed report. It is the aggregate
            result for that run, not a live judge score of this question.
          </p>
        </Stage>
      </div>
    </div>
  );
}

function Stage({
  index,
  shown,
  title,
  children,
}: {
  index: number;
  shown: number;
  title: string;
  children: React.ReactNode;
}) {
  const on = shown > index;
  return (
    <section className={on ? "stage is-on" : "stage is-wait"} aria-hidden={on ? undefined : true}>
      <p className="meta">0{index + 1}</p>
      <h2>{title}</h2>
      {on ? children : <p>Waiting in the trace.</p>}
    </section>
  );
}

function ChunkStage({ industry, run, replay }: { industry: IndustryDetail; run?: RunRecord; replay: boolean }) {
  if (!replay) return <p>No per-question retrieval record for this variant.</p>;
  return (
    <>
      <p>
        {run && run.chunks.length > 0
          ? `${run.chunks.length} recorded hit${run.chunks.length === 1 ? "" : "s"} on this line.`
          : "This recorded line has no retrieved chunks."}
      </p>
      {industry.notes?.map((note) => (
        <p key={note}>{note}</p>
      ))}
      {industry.notes?.length ? null : <p>Embedding vectors were not stored in the snapshot.</p>}
    </>
  );
}

function Retrieval({ run, replay }: { run?: RunRecord; replay: boolean }) {
  if (!replay || !run) return <p>No per-question chunks were committed for this variant.</p>;
  if (run.chunks.length === 0) return <p>The snapshot line lists an empty retrieved set.</p>;
  return (
    <ol className="chunks">
      {run.chunks.map((chunk) => (
        <li key={`${chunk.rank}-${chunk.chunkId ?? chunk.docId}`} className="chunk" data-testid="chunk">
          <header>
            <span>Rank {String(chunk.rank).padStart(2, "0")}</span>
            <span>{chunk.chunkId ?? chunk.docId ?? "no id"}</span>
            <span>{chunk.score === null ? "score not recorded" : `score ${formatScore(chunk.score)}`}</span>
          </header>
          <p>{chunk.text}</p>
          <p>{TEXT_SOURCE_LABEL[chunk.textSource]}</p>
        </li>
      ))}
    </ol>
  );
}

function Guardrail({ run, replay }: { run?: RunRecord; replay: boolean }) {
  if (!replay || !run) return <p>No per-question guardrail flag was committed for this variant.</p>;
  return (
    <>
      <p>
        {run.guardrailRecorded
          ? `Recorded guardrail field: ${run.guardrail ?? "null"}.`
          : "This snapshot line has no guardrail field."}
      </p>
      <p>{run.refused === null ? "No refused boolean on this line." : `Recorded refused flag: ${run.refused ? "true" : "false"}.`}</p>
      <p>{run.behavior ? `Recorded behaviour: ${run.behavior}.` : "No behaviour field on this line."}</p>
    </>
  );
}

function Answer({
  run,
  gatedRun,
  variant,
  industry,
}: {
  run?: RunRecord;
  gatedRun?: RunRecord;
  variant: VariantSummary;
  industry: IndustryDetail;
}) {
  if (!variant.replay || !run) return <p>No per-question answer was committed for this variant.</p>;
  const docIds = [...new Set(run.chunks.map((chunk) => chunk.docId).filter((id): id is string => Boolean(id)))];
  const matchesGated = variant.id !== industry.gatedVariant && sameAnswer(run.answer, gatedRun?.answer);
  return (
    <>
      <p className="answer" data-testid="answer">
        {run.answer}
      </p>
      <p>{docIds.length ? `Document ids on the retrieved set: ${docIds.join(", ")}.` : "No document ids on this line."}</p>
      {matchesGated ? (
        <p>The recorded answer matches the gated variant on this question. Other questions in the file differ.</p>
      ) : null}
    </>
  );
}

function Scoring({
  industry,
  variant,
  run,
}: {
  industry: IndustryDetail;
  variant: VariantSummary;
  run?: RunRecord;
}) {
  return (
    <>
      {run?.metrics ? (
        <>
          <p>Numbers stored on this snapshot line:</p>
          <ScoreRows scores={run.metrics} industry={industry} />
        </>
      ) : (
        <p>This snapshot line does not include per-question metric numbers.</p>
      )}
      <p>Variant averages from the committed report:</p>
      <table className="score-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Score</th>
            <th>Threshold</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {industry.metrics.map((metric) => {
            const score = metric.scores[variant.id];
            const status = score === undefined ? null : passesThreshold(score, metric.threshold);
            return (
              <tr key={metric.id}>
                <td>{metric.label}</td>
                <td>{score === undefined ? "—" : formatScore(score)}</td>
                <td>{metric.threshold === null ? "—" : formatThreshold(metric.threshold)}</td>
                <td>{status === null ? "—" : status ? "pass" : "fail"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>Live judge metrics: needs API key — not measured.</p>
    </>
  );
}

function ScoreRows({ scores, industry }: { scores: Record<string, number>; industry: IndustryDetail }) {
  return (
    <table className="score-table">
      <tbody>
        {Object.entries(scores).map(([id, score]) => {
          const metric = industry.metrics.find((item) => item.id === id);
          return (
            <tr key={id}>
              <td>{metric?.label ?? id}</td>
              <td>{formatScore(score)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
