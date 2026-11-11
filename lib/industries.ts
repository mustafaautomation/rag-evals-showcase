import catalogJson from "@/data/catalog.json";
import edtech from "@/data/industries/edtech.json";
import ecommerce from "@/data/industries/ecommerce.json";
import fintech from "@/data/industries/fintech.json";
import hr from "@/data/industries/hr.json";
import insurance from "@/data/industries/insurance.json";
import legal from "@/data/industries/legal.json";
import medical from "@/data/industries/medical.json";
import realEstate from "@/data/industries/real-estate.json";
import saas from "@/data/industries/saas.json";
import support from "@/data/industries/support.json";
import type { Catalog, IndustryDetail } from "@/lib/types";

export const catalog = catalogJson as Catalog;

const details: Record<string, IndustryDetail> = {
  support: support as IndustryDetail,
  legal: legal as IndustryDetail,
  medical: medical as IndustryDetail,
  edtech: edtech as IndustryDetail,
  fintech: fintech as IndustryDetail,
  insurance: insurance as IndustryDetail,
  ecommerce: ecommerce as IndustryDetail,
  "real-estate": realEstate as IndustryDetail,
  hr: hr as IndustryDetail,
  saas: saas as IndustryDetail,
};

export function industrySlugs(): string[] {
  return catalog.industries.map((industry) => industry.slug);
}

export function getIndustry(slug: string): IndustryDetail | undefined {
  return details[slug];
}

export const METRIC_ORDER = [
  "hit_rate",
  "mrr",
  "non_llm_context_recall",
  "non_llm_context_precision",
  "string_presence",
  "refusal_correctness",
  "numeric_accuracy",
  "trap_avoidance",
  "disclaimer_rate",
  "citation_rate",
  "grounded_amounts",
  "endpoint_validity",
  "version_correctness",
];

export function metricColumns() {
  const byId = new Map<string, string>();
  for (const industry of catalog.industries) {
    for (const metric of industry.metrics) {
      if (!byId.has(metric.id)) byId.set(metric.id, metric.label);
    }
  }
  const ordered = METRIC_ORDER.filter((id) => byId.has(id));
  for (const id of byId.keys()) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered.map((id) => ({ id, label: byId.get(id) ?? id }));
}
