import type { Metadata } from "next";
import { Heatmap } from "@/components/heatmap";
import { catalog } from "@/lib/industries";

export const metadata: Metadata = {
  title: "Overview",
  description: "Offline metric heatmap for the ten recorded RAG eval runs.",
};

export default function OverviewPage() {
  return (
    <main id="content" className="page">
      <div className="wrap">
        <p className="kicker">Committed reports</p>
        <h1 className="page-title">Offline metric heatmap</h1>
        <p className="lede">
          Cells are the variant averages printed in each repository&apos;s report, compared with that repo&apos;s
          offline thresholds. A green cell is at or above its bar. A red cell is under it.
        </p>
        <p className="honesty" data-testid="honesty">
          {catalog.honesty}
        </p>
        <Heatmap />
        <section className="metric-block">
          <h2>Live RAGAS metrics</h2>
          <p className="note">needs API key — not measured. Thresholds below are configuration, not scores.</p>
          <div className="table-scroll">
            <table className="metric-table">
              <thead>
                <tr>
                  <th>Industry</th>
                  {["faithfulness", "answer_relevancy", "context_precision", "context_recall"].map((id) => (
                    <th key={id}>{id.replaceAll("_", " ")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catalog.industries.map((industry) => (
                  <tr key={industry.slug}>
                    <th>{industry.name}</th>
                    {["faithfulness", "answer_relevancy", "context_precision", "context_recall"].map((id) => {
                      const live = industry.liveMetrics.find((metric) => metric.id === id);
                      return (
                        <td key={id}>
                          not measured
                          {live?.threshold !== null && live?.threshold !== undefined ? (
                            <div className="muted">configured bar {live.threshold.toFixed(2)}</div>
                          ) : (
                            <div className="muted">no threshold file</div>
                          )}
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
