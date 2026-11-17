const PATHS: Record<string, string> = {
  support: "M6 8h20v12H12l-6 4V8z",
  legal: "M16 4v4M6 10h20M9 10l-3 12h8l-3-12M17 10l-1 12h8l-3-12M16 26h0",
  medical: "M16 6v20M6 16h20",
  edtech: "M5 8h22v16H5zM5 12h22M11 16h6M11 20h10",
  fintech: "M6 22V12M13 22V8M20 22v-6M27 22V6",
  insurance: "M16 4l10 4v8c0 6-4 10-10 12C10 26 6 22 6 16V8l10-4z",
  ecommerce: "M8 10h16l-1 12H9L8 10zM12 10V8a4 4 0 0 1 8 0v2",
  "real-estate": "M6 14l10-8 10 8v12H6V14zM13 26v-7h6v7",
  hr: "M10 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 24c1-4 4-6 6-6s5 2 6 6M16 24c1-4 4-6 6-6s5 2 6 6",
  saas: "M6 8h20v16H6zM6 12h20M10 17h4M10 20h8",
};

export function DomainIcon({ slug }: { slug: string }) {
  const d = PATHS[slug] ?? PATHS.support;
  return (
    <svg className="domain-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
