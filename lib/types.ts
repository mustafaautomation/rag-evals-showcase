export type Gate = "pass" | "fail";

export type VariantRole = "gated" | "bad-retriever" | "no-guardrail" | "broken";

export type TextSource = "snapshot" | "corpus-section" | "corpus-file";

export type VariantSummary = {
  id: string;
  label: string;
  role: VariantRole;
  replay: boolean;
  note: string | null;
  runCount: number;
  gate: Gate;
};

export type MetricSummary = {
  id: string;
  label: string;
  threshold: number | null;
  scores: Record<string, number>;
};

export type LiveMetric = {
  id: string;
  label: string;
  threshold: number | null;
  status: "unmeasured";
  detail: string;
};

export type IndustrySummary = {
  slug: string;
  name: string;
  repo: string;
  product: string;
  summary: string;
  status: "ready" | "coming-soon";
  sourceCommit?: string;
  sourceCommitDate?: string;
  repoUrl: string;
  readmeUrl?: string;
  reportUrl?: string;
  reportPath?: string;
  actionsUrl?: string;
  ciBadgeUrl?: string;
  questionCount: number;
  featuredQuestionId?: string;
  gatedVariant?: string;
  gate?: Gate;
  variants: VariantSummary[];
  metrics: MetricSummary[];
  liveMetrics: LiveMetric[];
  notes?: string[];
};

export type Catalog = {
  honesty: string;
  industries: IndustrySummary[];
};

export type QuestionRecord = {
  id: string;
  question: string;
  expectedBehavior: string | null;
  topic: string | null;
  reference: string | null;
  referenceDocIds: string[];
};

export type ChunkRecord = {
  rank: number;
  docId: string | null;
  chunkId: string | null;
  text: string;
  score: number | null;
  textSource: TextSource;
};

export type RunRecord = {
  questionId: string;
  variant: string;
  answer: string;
  guardrail: string | null;
  guardrailRecorded: boolean;
  refused: boolean | null;
  behavior: string | null;
  chunks: ChunkRecord[];
  metrics: Record<string, number> | null;
};

export type IndustryDetail = IndustrySummary & {
  questions: QuestionRecord[];
  runs: RunRecord[];
};
