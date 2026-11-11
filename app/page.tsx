import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { catalog } from "@/lib/industries";
import { ROLE_LABEL } from "@/lib/format";

export const metadata: Metadata = {
  title: "RAG evals showcase",
  description: catalog.honesty,
};

const STAGES = ["Query", "Chunk", "Retrieve", "Guard", "Answer", "Gate"];

export default function HomePage() {
  return (
    <main id="content">
      <div className="wrap hero">
        <p className="kicker">Offline replay · 10 public repos</p>
        <h1>Recorded RAG gates</h1>
        <p className="lede">
          Each tile opens a replay of a committed offline run. The gate color is the pass or fail result
          stored in that repo&apos;s report.
        </p>
        <p className="honesty" data-testid="honesty">
          {catalog.honesty}
        </p>
        <ol className="pipeline" aria-label="Replay stages">
          {STAGES.map((stage, index) => (
            <li key={stage} style={{ ["--i" as string]: index }}>
              <span>0{index + 1}</span>
              <strong>{stage}</strong>
              <i />
            </li>
          ))}
        </ol>
      </div>
      <div className="wrap">
        <div className="section-head">
          <h2>Industries</h2>
          <Link href="/overview">Metric heatmap</Link>
        </div>
        <div className="grid">
          {catalog.industries.map((industry, index) =>
            industry.status === "ready" ? (
              <Link
                key={industry.slug}
                href={`/industries/${industry.slug}`}
                className="tile"
                data-testid="industry-tile"
              >
                <div className="tile-top">
                  <span className="eyebrow">{String(index + 1).padStart(2, "0")}</span>
                  {industry.ciBadgeUrl ? (
                    <Image
                      className="badge"
                      src={industry.ciBadgeUrl}
                      alt={`CI badge for ${industry.repo}`}
                      width={92}
                      height={20}
                      unoptimized
                    />
                  ) : null}
                </div>
                <h3>{industry.name}</h3>
                <p>{industry.product}</p>
                <p>{industry.summary}</p>
                <div className="gates">
                  <span className="pill" data-status={industry.gate}>
                    {industry.gate === "pass" ? "PASS" : "FAIL"} {industry.gatedVariant}
                  </span>
                  {industry.variants
                    .filter((variant) => variant.id !== industry.gatedVariant)
                    .map((variant) => (
                      <span key={variant.id} className="pill" data-status={variant.gate}>
                        {variant.gate === "pass" ? "PASS" : "FAIL"} {ROLE_LABEL[variant.role]}
                      </span>
                    ))}
                </div>
                <span className="meta">{industry.questionCount} labelled questions</span>
              </Link>
            ) : (
              <article key={industry.slug} className="tile" data-testid="industry-tile">
                <span className="eyebrow">{String(index + 1).padStart(2, "0")}</span>
                <h3>{industry.name}</h3>
                <p>Coming soon. The sync script did not find a merged snapshot.</p>
                <a href={industry.repoUrl}>Repository</a>
              </article>
            ),
          )}
        </div>
      </div>
    </main>
  );
}
