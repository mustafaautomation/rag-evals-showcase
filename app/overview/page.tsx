import type { Metadata } from "next";
import { Heatmap } from "@/components/heatmap";

export const metadata: Metadata = {
  title: "Overview",
  description: "Offline metric heatmap for the ten recorded RAG eval runs.",
};

export default function OverviewPage() {
  return (
    <main id="content" className="page">
      <div className="wrap">
        <p className="kicker">Five shared offline metrics</p>
        <h1 className="page-title">Heatmap</h1>
        <Heatmap />
        <p className="live-note">Faithfulness, answer relevancy, context precision, context recall: needs API key — not measured.</p>
      </div>
    </main>
  );
}
