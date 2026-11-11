import type { Metadata } from "next";
import Link from "next/link";
import { DomainIcon } from "@/components/domain-icon";
import { HeroPipeline } from "@/components/hero-pipeline";
import { ROLE_LABEL, formatScore, passesThreshold } from "@/lib/format";
import { catalog } from "@/lib/industries";
import { buildReel } from "@/lib/reel";

export const metadata: Metadata = {
  title: "RAG evals showcase",
  description: catalog.honesty,
};

const BAR_IDS = ["hit_rate", "mrr", "non_llm_context_recall", "string_presence", "refusal_correctness"];

export default function HomePage() {
  const frames = buildReel();
  return (
    <main id="content">
      <div className="wrap">
        <HeroPipeline frames={frames} />
      </div>
      <div className="wrap">
        <div className="section-head">
          <h2>Industries</h2>
          <Link href="/overview">Heatmap</Link>
        </div>
        <div className="grid">
          {catalog.industries.map((industry) =>
            industry.status === "ready" ? (
              <Link key={industry.slug} href={`/industries/${industry.slug}`} className="tile" data-testid="industry-tile">
                <DomainIcon slug={industry.slug} />
                <h3>{industry.name}</h3>
                <p className="domain">{industry.product}</p>
                <div className="spark" aria-hidden="true">
                  {BAR_IDS.map((id) => {
                    const metric = industry.metrics.find((item) => item.id === id);
                    const score = industry.gatedVariant ? metric?.scores[industry.gatedVariant] : undefined;
                    if (score === undefined || !metric) return <i key={id} />;
                    const status = passesThreshold(score, metric.threshold);
                    return (
                      <i
                        key={id}
                        data-status={status === null ? "none" : status ? "pass" : "fail"}
                        style={{ ["--amount" as string]: String(Math.max(0.08, Math.min(1, score))) }}
                        title={`${metric.label} ${formatScore(score)}`}
                      />
                    );
                  })}
                </div>
                <div className="gates">
                  {industry.variants.map((variant) => (
                    <span key={variant.id} className="pill" data-status={variant.gate}>
                      {variant.gate === "pass" ? "PASS" : "FAIL"} {variant.id === industry.gatedVariant ? variant.label : ROLE_LABEL[variant.role]}
                    </span>
                  ))}
                </div>
              </Link>
            ) : (
              <article key={industry.slug} className="tile" data-testid="industry-tile">
                <DomainIcon slug={industry.slug} />
                <h3>{industry.name}</h3>
                <a href={industry.repoUrl}>Repository</a>
              </article>
            ),
          )}
        </div>
      </div>
    </main>
  );
}
