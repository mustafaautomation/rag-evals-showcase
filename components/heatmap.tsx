import Link from "next/link";
import { formatScore, formatThreshold, passesThreshold } from "@/lib/format";
import { catalog, metricColumns } from "@/lib/industries";
import type { IndustrySummary, VariantRole } from "@/lib/types";

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
  if (!metric || variants.length === 0 || variants.every((variant) => metric.scores[variant.id] === undefined)) {
    return (
      <td className={`cell ${className}`} data-status="absent" data-testid={id}>
        — <small>not in report</small>
      </td>
    );
  }
  return (
    <td className={className}>
      {variants.map((variant) => {
        const score = metric.scores[variant.id];
        if (score === undefined) {
          return (
            <div key={variant.id} data-testid={id}>
              — <small>{variant.label}</small>
            </div>
          );
        }
        const status = passesThreshold(score, metric.threshold);
        return (
          <div
            key={variant.id}
            className="cell"
            data-status={status === null ? "none" : status ? "pass" : "fail"}
            data-testid={id}
            title={`${variant.label} ${score}`}
          >
            {formatScore(score)} <small>{variant.label}</small>
          </div>
        );
      })}
    </td>
  );
}

export function Heatmap() {
  const columns = metricColumns();
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
      <p className="note">
        Ecommerce baseline, fintech baseline, and SaaS naive are single recorded broken runs. Each report
        describes that run as a retrieval failure together with an unguarded prompt. Those cells repeat under
        Bad retriever and No guardrail because the repo did not commit two files. Medical, real estate, and HR
        bad-retriever and no-guardrail cells are report averages; those repos did not commit per-question traces
        for the broken variants.
      </p>
      <div className="heat-scroll heat-table-wrap">
        <table className="heat-table">
          <thead>
            <tr>
              <th>Industry</th>
              {columns.map((column) => (
                <th key={column.id}>
                  {column.label}
                  <div className="muted">
                    {thresholdSpan(column.id)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalog.industries.map((industry) => (
              <tr key={industry.slug}>
                <th>
                  <Link href={`/industries/${industry.slug}`}>{industry.name}</Link>
                </th>
                {columns.map((column) => (
                  <FragmentCells key={column.id} industry={industry} metricId={column.id} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="heat-cards">
        {catalog.industries.map((industry) => (
          <article key={industry.slug} className="heat-card">
            <h3>
              <Link href={`/industries/${industry.slug}`}>{industry.name}</Link>
            </h3>
            {VIEWS.map((view) => (
              <div key={view.id} className={view.className}>
                <p className="meta">{view.label}</p>
                <table className="score-table">
                  <tbody>
                    {columns.map((column) => (
                      <tr key={column.id}>
                        <th>{column.label}</th>
                        <Cell industry={industry} metricId={column.id} roles={view.roles} className={view.className} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}

function FragmentCells({ industry, metricId }: { industry: IndustrySummary; metricId: string }) {
  return (
    <>
      {VIEWS.map((view) => (
        <Cell key={view.id} industry={industry} metricId={metricId} roles={view.roles} className={view.className} testId />
      ))}
    </>
  );
}

function thresholdSpan(metricId: string) {
  const values = new Set<string>();
  for (const industry of catalog.industries) {
    const metric = industry.metrics.find((item) => item.id === metricId);
    if (metric?.threshold !== null && metric?.threshold !== undefined) values.add(formatThreshold(metric.threshold));
  }
  if (values.size === 0) return "no shared bar";
  if (values.size === 1) return `bar ${[...values][0]}`;
  return "bars differ";
}
