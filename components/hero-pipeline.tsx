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
        timer = window.setTimeout(tick, 700);
        return;
      }
      if (stage < STAGES.length - 1) setStage(stage + 1);
      else {
        setFrameIndex((index) => (index + 1) % frames.length);
        setStage(0);
      }
    };
    const delay = stage === STAGES.length - 1 ? 1100 : stage === 2 ? 900 : 640;
    timer = window.setTimeout(tick, delay);
    return () => window.clearTimeout(timer);
  }, [motion, stage, frames.length]);

  const frame = frames[frameIndex];
  if (!frame) return null;
  const stageName = motion === "reduced" ? "gate" : STAGES[stage];
  const visible = motion === "reduced" ? STAGES.length - 1 : stage;

  return (
    <section
      className="hero-pipeline"
      data-testid="hero-pipeline"
      data-motion={motion}
      data-stage={stageName}
      data-industry={frame.slug}
      data-variant={frame.variantId}
      data-status={frame.gate}
      aria-label="Recorded pipeline replay"
    >
      <div className="hero-top">
        <p className="kicker">
          {frame.name} · {frame.variantLabel}
        </p>
        <ol className="hero-rail">
          {STAGES.map((name, index) => (
            <li key={name} data-on={visible >= index ? "yes" : "no"}>
              {name}
            </li>
          ))}
        </ol>
      </div>
      <div className="hero-stage" style={{ ["--stage" as string]: visible }}>
        <span className="hero-token" aria-hidden="true" />
        <p className="hero-question">{frame.question}</p>
        <div className="fan-slot">
          <p className="meta">{visible >= 1 ? `${frame.chunks.length} recorded hits` : " "}</p>
          <ol className={visible >= 2 ? "fan" : "fan is-held"}>
            {frame.chunks.map((chunk) => (
              <li key={`${chunk.rank}-${chunk.label}`} className="fan-card" style={{ ["--i" as string]: chunk.rank }}>
                <header>
                  <span>{String(chunk.rank).padStart(2, "0")}</span>
                  <span>{chunk.score ?? "no score"}</span>
                </header>
                <strong>{chunk.label}</strong>
                <p>{chunk.text}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="hero-foot">
          <p className={visible >= 3 ? "guard-badge" : "guard-badge is-held"}>{frame.guard}</p>
          <p className={visible >= 4 ? "hero-answer" : "hero-answer is-held"}>{frame.answer}</p>
          <div className={visible >= 5 ? "gate-stamp" : "gate-stamp is-held"} data-status={frame.gate}>
            {frame.gate === "pass" ? "PASS" : "FAIL"}
          </div>
        </div>
      </div>
    </section>
  );
}
