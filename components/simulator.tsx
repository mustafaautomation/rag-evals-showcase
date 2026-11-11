"use client";

import { useEffect, useMemo, useState } from "react";
import { TEXT_SOURCE_LABEL, formatScore, passesThreshold } from "@/lib/format";
import type { ChunkRecord, IndustryDetail, RunRecord, VariantSummary } from "@/lib/types";

const STEP_LABELS = ["Query", "Retrieve", "Guard", "Answer", "Metrics", "Gate"];
const LAST = STEP_LABELS.length;

type Trace = { shown: number; playing: boolean };

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function guardLine(run: RunRecord | undefined, replay: boolean) {
  if (!replay || !run) return "No per-question guardrail flag committed.";
  if (run.guardrailRecorded) return run.guardrail ? run.guardrail : "null";
  if (run.refused !== null) return run.refused ? "refused" : "not refused";
  if (run.behavior) return run.behavior;
  return "not recorded";
}

export function Simulator({ industry }: { industry: IndustryDetail }) {
  const [questionId, setQuestionId] = useState(industry.featuredQuestionId ?? industry.questions[0]?.id ?? "");
  const [variantId, setVariantId] = useState(industry.gatedVariant ?? industry.variants[0]?.id ?? "");
  const [filter, setFilter] = useState<"all" | "other">("all");
  const [trace, setTrace] = useState<Trace>({ shown: LAST, playing: false });
  const [motion, setMotion] = useState<"full" | "reduced">("full");
  const [typed, setTyped] = useState(10_000);

  const question = industry.questions.find((item) => item.id === questionId) ?? industry.questions[0];
  const variant = industry.variants.find((item) => item.id === variantId) ?? industry.variants[0];
  const gated = industry.variants.find((item) => item.id === industry.gatedVariant) ?? variant;
  const run = industry.runs.find((item) => item.questionId === question?.id && item.variant === variant?.id);
  const gatedRun = industry.runs.find((item) => item.questionId === question?.id && item.variant === gated?.id);
  const compare = Boolean(variant && gated && variant.id !== gated.id);

  const visibleQuestions = useMemo(() => {
    const filtered = industry.questions.filter((item) => {
      if (filter === "all") return true;
      return item.expectedBehavior !== null && item.expectedBehavior !== "answer";
    });
    if (question && !filtered.some((item) => item.id === question.id)) return [question, ...filtered];
    return filtered;
  }, [filter, industry.questions, question]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotion(media.matches ? "reduced" : "full");
    const timer = window.setTimeout(apply, 0);
    media.addEventListener("change", apply);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", apply);
    };
  }, []);

  useEffect(() => {
    if (!trace.playing || motion === "reduced") return;
    const delay = trace.shown === 4 ? 1100 : 400;
    const timer = window.setTimeout(() => {
      if (trace.shown + 1 === 4) setTyped(0);
      setTrace((current) => {
        if (!current.playing) return current;
        const shown = Math.min(LAST, current.shown + 1);
        return { shown, playing: shown < LAST };
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [trace, motion]);

  useEffect(() => {
    if (motion === "reduced" || trace.shown !== 4) return;
    const timer = window.setInterval(() => setTyped((count) => count + 6), 20);
    return () => window.clearInterval(timer);
  }, [trace.shown, motion, questionId, variantId]);

  function restart(reduced = prefersReducedMotion()) {
    setTyped(0);
    setTrace(reduced ? { shown: LAST, playing: false } : { shown: 0, playing: true });
  }

  function play() {
    setTyped(0);
    if (prefersReducedMotion()) {
      setTrace({ shown: LAST, playing: false });
      return;
    }
    setTrace({ shown: 0, playing: true });
  }

  function pause() {
    setTrace((current) => ({ ...current, playing: false }));
  }

  function step() {
    setTrace((current) => ({ shown: Math.min(LAST, current.shown + 1), playing: false }));
  }

  if (!question || !variant || !gated) return null;

  const state = trace.playing ? "playing" : trace.shown >= LAST ? "done" : "paused";

  return (
    <div data-testid="replay-state" data-state={state} data-step={trace.shown} data-motion={motion}>
      <div className="transport">
        <button type="button" data-testid="play" onClick={play}>
          Play
        </button>
        <button type="button" data-testid="pause" onClick={pause}>
          Pause
        </button>
        <button type="button" data-testid="step" onClick={step}>
          Step
        </button>
        <label className="field grow">
          Question
          <select
            data-testid="question-select"
            value={question.id}
            onChange={(event) => {
              setQuestionId(event.target.value);
              restart();
            }}
          >
            {visibleQuestions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} — {item.question.length > 90 ? `${item.question.slice(0, 90)}…` : item.question}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Filter
          <select value={filter} onChange={(event) => setFilter(event.target.value as "all" | "other")}>
            <option value="all">All</option>
            <option value="other">Traps</option>
          </select>
        </label>
      </div>
      <div className="progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.min(1, trace.shown / LAST)})` }} />
        {STEP_LABELS.map((label, index) => (
          <b key={label} data-on={trace.shown > index ? "yes" : "no"}>
            {label}
          </b>
        ))}
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
            onClick={() => {
              setVariantId(item.id);
              restart();
            }}
          >
            {item.label} · {item.gate === "pass" ? "PASS" : "FAIL"}
          </button>
        ))}
      </div>
      {variant.note ? <p className="note">{variant.note}</p> : null}
      <div className={compare ? "compare" : "compare single"}>
        {compare ? (
          <TraceColumn
            title={`Gated · ${gated.label}`}
            industry={industry}
            variant={gated}
            run={gatedRun}
            question={question.question}
            shown={trace.shown}
            typed={10_000}
          />
        ) : null}
        <TraceColumn
          title={variant.label}
          industry={industry}
          variant={variant}
          run={run}
          question={question.question}
          shown={trace.shown}
          typed={typed}
          primary
        />
      </div>
    </div>
  );
}

function TraceColumn({
  title,
  industry,
  variant,
  run,
  question,
  shown,
  typed,
  primary = false,
}: {
  title: string;
  industry: IndustryDetail;
  variant: VariantSummary;
  run?: RunRecord;
  question: string;
  shown: number;
  typed: number;
  primary?: boolean;
}) {
  const answer = run?.answer ?? "";
  const visibleAnswer = shown >= 5 || typed >= answer.length ? answer : answer.slice(0, typed);
  const citations = [...new Set((run?.chunks ?? []).map((chunk) => chunk.docId).filter((id): id is string => Boolean(id)))].slice(0, 6);
  return (
    <article className="trace-col">
      <p className="meta">{title}</p>
      {shown >= 1 ? <p className="hero-question">{question}</p> : <p className="meta">Query</p>}
      {shown >= 2 ? (
        variant.replay && run ? (
          run.chunks.length ? (
            <ol className="chunks">
              {run.chunks.map((chunk) => (
                <Chunk key={`${chunk.rank}-${chunk.chunkId ?? chunk.docId}`} chunk={chunk} primary={primary} />
              ))}
            </ol>
          ) : (
            <p>Empty retrieved set.</p>
          )
        ) : (
          <p>Per-question chunks were not committed.</p>
        )
      ) : null}
      {shown >= 3 ? <p className="guard-badge">{guardLine(run, variant.replay)}</p> : null}
      {shown >= 4 ? (
        variant.replay && run ? (
          <>
            <p className="answer" data-testid={primary ? "answer" : undefined}>
              {visibleAnswer}
              {shown === 4 && typed < answer.length ? <i className="caret" /> : null}
            </p>
            <div className="chips">
              {citations.map((id) => (
                <span key={id}>{id}</span>
              ))}
            </div>
          </>
        ) : (
          <p>Per-question answer was not committed.</p>
        )
      ) : null}
      {shown >= 5 ? <MetricBars industry={industry} variantId={variant.id} /> : null}
      {shown >= 6 ? (
        <div className="gate-stamp" data-testid={primary ? "gate" : "gate-compare"} data-status={variant.gate}>
          {variant.gate === "pass" ? "PASS" : "FAIL"}
        </div>
      ) : null}
    </article>
  );
}

function Chunk({ chunk, primary }: { chunk: ChunkRecord; primary: boolean }) {
  return (
    <li className="chunk fan-card" data-testid={primary ? "chunk" : undefined} style={{ ["--i" as string]: chunk.rank }}>
      <header>
        <span>Rank {String(chunk.rank).padStart(2, "0")}</span>
        <span>{chunk.chunkId ?? chunk.docId ?? "no id"}</span>
        <span>{chunk.score === null ? "score not recorded" : `score ${formatScore(chunk.score)}`}</span>
      </header>
      <p>{chunk.text}</p>
      <p>{TEXT_SOURCE_LABEL[chunk.textSource]}</p>
    </li>
  );
}

function MetricBars({ industry, variantId }: { industry: IndustryDetail; variantId: string }) {
  return (
    <div className="bars">
      {industry.metrics.map((metric) => {
        const score = metric.scores[variantId];
        if (score === undefined) return null;
        const status = passesThreshold(score, metric.threshold);
        const amount = Math.max(0, Math.min(1, score));
        const marker = metric.threshold === null ? null : Math.max(0, Math.min(1, metric.threshold));
        return (
          <div key={metric.id} className="bar-row">
            <span>{metric.label}</span>
            <span className="bar-track">
              <i data-status={status === null ? "none" : status ? "pass" : "fail"} style={{ ["--amount" as string]: String(amount) }} />
              {marker !== null ? <b style={{ left: `${marker * 100}%` }} /> : null}
            </span>
            <span>{formatScore(score)}</span>
          </div>
        );
      })}
      <p className="meta">Bars are variant averages. Marker is the threshold. Live judge metrics: needs API key — not measured.</p>
    </div>
  );
}
