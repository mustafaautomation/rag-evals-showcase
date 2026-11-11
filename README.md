# rag-evals-showcase

Static Next.js site that replays recorded offline RAG evaluation runs from 10 public repositories.

Replays recorded offline runs from the public repos; synthetic data; personal open-source demos.

The figures on the site are copied from the committed reports and snapshots in those repositories. Live RAGAS judge metrics (faithfulness, answer relevancy, context precision, context recall) are labelled "needs API key — not measured". This site does not fill them in.

![Landing page on a desktop viewport](docs/screenshot-desktop.png)

A mobile capture of the same page is in [docs/screenshot-mobile.png](docs/screenshot-mobile.png).

## Data flow

```mermaid
flowchart LR
  Repos[10 public GitHub repos] --> Sync[scripts/sync_sources.py]
  Sync --> JSON[data/catalog.json and data/industries]
  JSON --> Next[Next.js static pages]
  Next --> UI[Landing, simulator, heatmap]
```

## Pages

- `/` lists the 10 industries, the recorded offline gate for each variant, and the CI badge from that repo's GitHub Actions workflow.
- `/industries/[slug]` replays one labelled question: the question, the recorded chunks, any guardrail field stored on the line, the answer, the report averages, and the offline gate.
- `/overview` is a heatmap of the offline metrics printed in the reports, with each repo's thresholds.

Some variants exist only as averages in the report. Medical, real estate, and HR did not commit per-question traces for the broken variants. Ecommerce baseline, fintech baseline, and SaaS naive are one broken run each, not two separate files. The simulator says so and does not invent those traces.

## Refresh the data

```bash
python3 scripts/sync_sources.py
```

That clones each repository into `.cache/sources` and rewrites `data/`. `--sources /path/to/clones` reads clones that are already on disk. `--allow-missing` records a repository the script cannot read instead of exiting. Without that flag a missing repository fails the script.

`python3 scripts/check_data.py` checks the committed JSON.

## Run locally

Node 20 or newer.

```bash
npm ci
npm run dev
```

## Checks

```bash
python3 scripts/check_data.py
npm run lint
npm run build
npm run typecheck
npx playwright install --with-deps chromium
npm run test:e2e
```

`npm run typecheck` needs `npm run build` first. The build writes Next.js route types that `tsconfig` references.

GitHub Actions runs the same checks on pull requests and on pushes to `main`. A failing step fails the workflow.

## Host

The intended host is [rag.quvantic.com](https://rag.quvantic.com).

## License

MIT. See [LICENSE](LICENSE).
