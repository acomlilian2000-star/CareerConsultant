# MarketPulse: AI-Driven Tech Career Router

MarketPulse is a Next.js career-advising app for early-career developers. It combines a cited career knowledge base, hybrid retrieval-augmented generation (RAG), OpenAI chat and embedding models, a learning-roadmap tool, and a responsive dashboard.

MarketPulse displays live remote job listings from Remotive. Dashboard listing counts, categories, and latest-posting dates are calculated from the current search results. The app does not display salary or housing benchmarks because a verified live regional data source is not connected.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
# Add your server-side OpenAI API key to .env.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without an API key, the app still runs in demo mode: keyword retrieval, source links, conversation history, the remote-jobs refresh, and the UI work, but personalized LLM answers and embeddings are unavailable. Set `OPENAI_API_KEY` in `.env` to enable chat and embeddings. The key stays server-side. Optionally set `OPENAI_EMBEDDING_MODEL`; it defaults to `text-embedding-3-small`.

The model picker offers OpenAI's `gpt-4o-mini` and `gpt-4.1-mini` models.

## What is implemented

- **RAG:** a five-source career knowledge base is split into overlapping chunks with LangChain's `RecursiveCharacterTextSplitter`. A deterministic query-translation step expands career language into search terms and extracts topic/location metadata; those structured signals guide ranking alongside keyword overlap and, when configured, cosine similarity. Without embeddings, transparent keyword retrieval remains available. Responses show source links, retrieval mode, topic/location, and the translated search query.
- **Tool calling:** a LangChain tool creates a staged 12-week learning plan. Tool results are rendered as cards.
- **LLM integration:** LangChain `ChatOpenAI` uses OpenAI's API. The model can be selected in the UI. Without a key, the app returns an explicit, retrieval-grounded demo response.
- **Live market signals:** search public remote roles from Remotive; the listing count, most common category, and latest posting date reflect the returned results. Listings link to the original source and are not a representative city-level dataset.
- **Safety:** server-only credentials, input size/schema validation, request throttling, prompt-injection pattern detection, explicit untrusted-context boundaries, and safe tool schemas. Avoid sending personal or sensitive information.
- **Easy bonuses:** conversation history in local storage, JSON/CSV export, source citations, retrieval mode/warning visualization, and suggested prompts.
- **Medium bonuses:** selectable models, on-demand live job refresh, prompt-injection defenses, rough token/cost reporting when provider usage is returned, and tool-result visualizations.
- **Hard bonus:** hybrid search and a small repeatable RAG retrieval evaluation.

## Architecture

```text
Next.js dashboard
  ├── POST /api/chat
  │     ├── Validate + rate limit + inspect input
  │     ├── LangChain text splitting → hybrid retrieval
  │     ├── OpenAI ChatOpenAI → learning-roadmap tool call
  │     └── Answer + citations + retrieval/tool/usage metadata
  ├── GET /api/market → Remotive public jobs API
  └── POST /api/knowledge/refresh → rebuild chunks / warm embeddings
```

The knowledge index and demo rate limiter are in-memory, suitable for a single-process prototype only. For multi-instance production use, use a persistent vector database and shared rate-limit store, authenticate accounts, add observability, and connect verified, dated regional salary and housing sources before displaying those benchmarks. Token costs are estimates based on hard-coded published model rates and should not be treated as billing.

## Evaluation and checks

```bash
npm run typecheck
npm run lint
npm run evaluate
npm run build
```

The retrieval evaluator reports Recall@3 for known domain questions and checks topic/location extraction for representative queries. It uses keyword retrieval when no embedding API key is configured and will fail if an expected source or structured query field is missing.
