"use client";

import { useEffect, useState } from "react";
import type { ReelFrame } from "@/lib/reel";

const STAGES = ["query", "chunk", "retrieve", "guard", "answer", "gate"] as const;

export function HeroPipeline({ frames }: { frames: ReelFrame[] }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [stage, setStage] = useState(0);
  const [motion, setMotion] = useState<"pending" | "full" | "reduced">("pending");

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
      if (stage < STAGES.length - 1) setStage(stage + 1);
      else {
        setFrameIndex((index) => (index + 1) % frames.length);
        setStage(0);
      }
    };
    const delay = stage === STAGES.length - 1 ? 1200 : stage === 2 ? 980 : 680;
    timer = window.setTimeout(tick, delay);
    return () => window.clearTimeout(timer);
  }, [motion, stage, frames.length]);

  const frame = frames[frameIndex];
  if (!frame) return null;
  const stageName = motion === "reduced" ? "gate" : STAGES[stage];
  const visible = motion === "reduced" ? STAGES.length - 1 : stage;
  const guard = frame.guard.replace(/^Guardrail:\s*/i, "").slice(0, 28);

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
      <div className="rail">
        <span className="rail-line" />
        <span className="pulse" aria-hidden="true" />
        <ol>
          {STAGES.map((name, index) => (
            <li key={name} className="node" data-on={visible >= index ? "yes" : "no"}>
              {name}
            </li>
          ))}
        </ol>
      </div>
      <div className={visible >= 2 ? "chip-row" : "chip-row is-held"}>
        {frame.chunks.slice(0, 4).map((chunk) => (
          <div key={`${chunk.rank}-${chunk.label}`} className="fly" style={{ ["--i" as string]: chunk.rank }}>
            <span>{String(chunk.rank).padStart(2, "0")}{chunk.score ? ` · ${chunk.score}` : ""}</span>
            <b>{chunk.label.split("#")[0]}</b>
          </div>
        ))}
      </div>
      <div className="stage-lower">
        <div className={visible >= 3 ? "shield" : "shield is-held"}>{guard || "Guard"}</div>
        <p className={visible >= 4 ? "typed" : "typed is-held"}>{frame.answer}</p>
        <div className={visible >= 4 ? "cite" : "cite is-held"}>
          {frame.citations.slice(0, 3).map((id) => (
            <span key={id}>{id}</span>
          ))}
        </div>
        <div className={visible >= 5 ? "stamp" : "stamp is-held"} data-status={frame.gate}>
          {frame.gate === "pass" ? "PASS" : "FAIL"}
        </div>
      </div>
    </section>
  );
}
