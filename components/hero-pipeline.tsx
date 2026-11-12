"use client";

import { useEffect, useState } from "react";
import type { ReelFrame } from "@/lib/reel";

const STAGES = ["query", "chunk", "retrieve", "guard", "answer", "gate"] as const;

export function HeroPipeline({ frames }: { frames: ReelFrame[] }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [stage, setStage] = useState(0);
  const [motion, setMotion] = useState<"pending" | "full" | "reduced">("pending");
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (media.matches) {
        setMotion("reduced");
        setStage(STAGES.length - 1);
        setFrameIndex(0);
      } else {
        setMotion("full");
      }
    };
    const timer = window.setTimeout(apply, 0);
    media.addEventListener("change", apply);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", apply);
    };
  }, []);

  useEffect(() => {
    if (motion !== "full" || frames.length === 0) return;
    let timer = 0;
    const tick = () => {
      if (document.hidden) {
        timer = window.setTimeout(tick, 800);
        return;
      }
      if (stage < STAGES.length - 1) {
        if (stage === 3) setTyped(0);
        setStage(stage + 1);
      } else {
        setFrameIndex((index) => (index + 1) % frames.length);
        setStage(0);
      }
    };
    const delay = stage === 5 ? 1400 : stage === 2 ? 1100 : stage === 4 ? 1200 : 700;
    timer = window.setTimeout(tick, delay);
    return () => window.clearTimeout(timer);
  }, [motion, stage, frames.length]);

  useEffect(() => {
    if (motion !== "full" || stage !== 4) return;
    const timer = window.setInterval(() => setTyped((count) => count + 4), 16);
    return () => window.clearInterval(timer);
  }, [motion, stage, frameIndex]);

  const frame = frames[frameIndex];
  if (!frame) return null;
  const stageName = motion === "reduced" ? "gate" : STAGES[stage];
  const visible = motion === "reduced" ? 5 : stage;
  const answer = motion === "reduced" || visible > 4 ? frame.answer : frame.answer.slice(0, typed);

  return (
    <section
      className="stage-hero"
      data-testid="hero-pipeline"
      data-motion={motion}
      data-stage={stageName}
      data-industry={frame.slug}
      data-variant={frame.variantId}
      data-status={frame.gate}
      aria-label="Recorded pipeline replay"
      style={{ ["--stage" as string]: visible }}
    >
      <p className="stage-kicker">
        {frame.name} · {frame.variantLabel}
      </p>
      <h1 className="stage-question">{frame.question}</h1>
      <div className="rail" aria-hidden="true">
        <span className="rail-line" />
        <span className="pulse" />
        <ol>
          {STAGES.map((name, index) => (
            <li key={name} className="node" data-on={visible >= index ? "yes" : "no"} data-current={visible === index ? "yes" : "no"}>
              {name}
            </li>
          ))}
        </ol>
      </div>
      <div className="stage-well">
        {visible < 2 ? <p className="well-arm">Arming retrieval</p> : null}
        {visible === 2 ? (
          <div className="hero-cards">
            {frame.chunks.slice(0, 4).map((chunk) => (
              <article key={`${chunk.rank}-${chunk.label}`} className="hero-card" style={{ ["--i" as string]: chunk.rank }}>
                <span>{String(chunk.rank).padStart(2, "0")}{chunk.score ? ` · ${chunk.score}` : ""}</span>
                <strong>{chunk.label.split("#")[0]}</strong>
                <p>{chunk.text}</p>
              </article>
            ))}
          </div>
        ) : null}
        {visible === 3 ? <div className="shield">{frame.guard}</div> : null}
        {visible === 4 ? (
          <div className="answer-well">
            <p className="typed">
              {answer}
              <i className="caret" />
            </p>
            <div className="cite">
              {frame.citations.slice(0, 3).map((id) => (
                <span key={id}>{id}</span>
              ))}
            </div>
          </div>
        ) : null}
        {visible >= 5 ? (
          <div className="gate-well">
            <div className="stamp" data-status={frame.gate}>
              {frame.gate === "pass" ? "PASS" : "FAIL"}
            </div>
            <div className="hero-bars">
              {frame.metrics.map((metric) => (
                <div key={metric.id} className="hero-bar">
                  <span>{metric.label}</span>
                  <i data-status={metric.pass === false ? "fail" : "pass"} style={{ ["--amount" as string]: String(metric.amount) }} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
