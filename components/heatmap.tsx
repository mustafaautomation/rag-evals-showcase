import Link from "next/link";
import { HeatDetail } from "@/components/heat-detail";
import { formatScore, formatThreshold, passesThreshold } from "@/lib/format";
import { catalog } from "@/lib/industries";
import type { IndustrySummary, VariantRole } from "@/lib/types";

const SHARED = [
  { id: "hit_rate", label: "Hit rate" },
  { id: "mrr", label: "MRR" },
  { id: "non_llm_context_recall", label: "Recall" },
  { id: "string_presence", label: "Presence" },
  { id: "refusal_correctness", label: "Refusal" },
];

const VIEWS: { id: string; className: string; label: string; roles: VariantRole[] }[] = [
  { id: "view-gated", className: "for-gated", label: "Gated variant", roles: ["gated"] },
  { id: "view-bad", className: "for-bad", label: "Bad retriever", roles: ["bad-retriever", "broken"] },
  { id: "view-open", className: "for-open", label: "No guardrail", roles: ["no-guardrail", "broken"] },
];

function variantsFor(industry: IndustrySummary, roles: VariantRole[]) {
  return industry.variants.filter((variant) => roles.includes(variant.role));
}

function Cell({
  industry,
  metricId,
  roles,
  className,
  testId,
}: {
  industry: IndustrySummary;
  metricId: string;
  roles: VariantRole[];
  className: string;
  testId?: boolean;
}) {
  const metric = industry.metrics.find((item) => item.id === metricId);
  const variants = variantsFor(industry, roles);
  const view = className === "for-gated" ? "gated" : className === "for-bad" ? "bad" : "open";
  const id = testId ? `heat-${industry.slug}-${metricId}-${view}` : undefined;
  const variant = variants.find((item) => metric && metric.scores[item.id] !== undefined);
  const score = variant && metric ? metric.scores[variant.id] : undefined;
  if (!metric || score === undefined || !variant) {
    return <div className={`cell ${className}`} data-status="absent" data-testid={id} />;
  }
  const status = passesThreshold(score, metric.threshold);
  const margin = metric.threshold === null ? 0 : Math.abs(score - metric.threshold);
  const statusName = status === null ? "no threshold" : status ? "pass" : "fail";
  const detail = `${industry.name} · ${metric.label} · ${variant.label} · ${formatScore(score)} · threshold ${metric.threshold === null ? "none" : formatThreshold(metric.threshold)} · ${statusName}`;
  return (
    <div
      className={`cell ${className}`}
      data-status={status === null ? "none" : status ? "pass" : "fail"}
      data-testid={id}
      data-heat-detail={detail}
      tabIndex={0}
      style={{ ["--strength" as string]: String(Math.round(Math.min(1, margin / 0.35) * 100)) }}
    >
      {formatScore(score)}
    </div>
  );
}

export function Heatmap() {
  return (
    <div className="heat">
      <div className="controls" role="radiogroup" aria-label="Which variant to show">
        {VIEWS.map((view, index) => (
          <label key={view.id} className="seg">
            <input id={view.id} type="radio" name="heat-view" defaultChecked={index === 0} />
            {view.label}
          </label>
        ))}
      </div>
      <ul className="legend" data-testid="heat-legend">
        <li data-status="pass">At or above the threshold</li>
        <li data-status="fail">Under the threshold</li>
      </ul>
      <HeatDetail />
      <p className="note">
        Broken runs that mix a bad retriever and an unguarded prompt appear in both broken views. Medical, real
        estate, and HR broken cells are report averages.
      </p>
      <div className="heat-board">
        <div className="heat-head">
          <span>Industry</span>
          {SHARED.map((metric) => (
            <span key={metric.id}>{metric.label}</span>
          ))}
        </div>
        {catalog.industries.map((industry) => (
          <div key={industry.slug} className="heat-row">
            <Link className="heat-name" href={`/industries/${industry.slug}`}>
              {industry.name}
            </Link>
            {SHARED.map((metric) =>
              VIEWS.map((view) => (
                <Cell
                  key={`${metric.id}-${view.id}`}
                  industry={industry}
                  metricId={metric.id}
                  roles={view.roles}
                  className={view.className}
                  testId
                />
              )),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
