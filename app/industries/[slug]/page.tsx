import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Simulator } from "@/components/simulator";
import { formatScore, formatThreshold, passesThreshold } from "@/lib/format";
import { catalog, getIndustry, industrySlugs } from "@/lib/industries";

export function generateStaticParams() {
  return industrySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const industry = catalog.industries.find((item) => item.slug === slug);
  return {
    title: industry?.name ?? "Industry",
    description: industry?.summary ?? catalog.honesty,
  };
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const industry = getIndustry(slug);
  if (!industry || industry.status !== "ready") notFound();
  const shortSha = industry.sourceCommit?.slice(0, 8);

  return (
    <main id="content" className="page">
      <div className="wrap">
        <p className="kicker">
          <Link href="/">Industries</Link> / {industry.repo}
        </p>
        <h1 className="page-title">{industry.name}</h1>
        <p className="kicker">{industry.product}</p>
        <div className="links">
          <a href={industry.repoUrl} rel="noreferrer">
            Repository
          </a>
          {industry.readmeUrl ? (
            <a href={industry.readmeUrl} rel="noreferrer">
              README
            </a>
          ) : null}
          {industry.reportUrl ? (
            <a href={industry.reportUrl} rel="noreferrer" data-testid="report-link">
              Report
            </a>
          ) : null}
          {industry.actionsUrl ? (
            <a href={industry.actionsUrl} rel="noreferrer">
              CI workflow
            </a>
          ) : null}
          {shortSha ? <span className="meta">source {shortSha}</span> : null}
        </div>
        <Simulator industry={industry} />
        <section className="metric-block">
          <h2>Report averages</h2>
          <div className="table-scroll">
            <table className="metric-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Threshold</th>
                  {industry.variants.map((variant) => (
                    <th key={variant.id}>
                      {variant.label}
                      <div className="muted">{variant.gate}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {industry.metrics.map((metric) => (
                  <tr key={metric.id}>
                    <th>{metric.label}</th>
                    <td>{metric.threshold === null ? "—" : formatThreshold(metric.threshold)}</td>
                    {industry.variants.map((variant) => {
                      const score = metric.scores[variant.id];
                      const status = score === undefined ? null : passesThreshold(score, metric.threshold);
                      return (
                        <td key={variant.id} data-status={status === null ? "none" : status ? "pass" : "fail"}>
                          {score === undefined ? "—" : formatScore(score)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
