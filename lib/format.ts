export function formatScore(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 4,
  });
}

export function formatThreshold(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function passesThreshold(score: number, threshold: number | null): boolean | null {
  if (threshold === null) return null;
  return score + 1e-12 >= threshold;
}

export const TEXT_SOURCE_LABEL: Record<string, string> = {
  snapshot: "Text stored on the snapshot line.",
  "corpus-section": "Text is the corpus section for the recorded chunk id.",
  "corpus-file": "The snapshot stored the document id. Text is that corpus file.",
};

export const ROLE_LABEL: Record<string, string> = {
  gated: "Gated run",
  "bad-retriever": "Bad retriever",
  "no-guardrail": "No guardrail",
  broken: "Broken run",
};
