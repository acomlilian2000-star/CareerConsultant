# MarketPulse: AI-Driven Tech Career Router

MarketPulse is a Next.js career-advising app for early-career developers. It combines a cited career knowledge base, hybrid retrieval-augmented generation (RAG), OpenAI chat and embedding models, a learning-roadmap tool, and a responsive dashboard.

MarketPulse searches public remote job listings from Jobicy by role tag, requests up to 50 matches, and caches each role-tag search in the server process for up to 24 hours. Results are re-ranked against the full search in the browser experience. Pulse counts and categories describe the current query results, not every open role worldwide. The app does not display salary or housing benchmarks because a verified live regional data source is not connected.

## Run locally

Requirements: Node.js 20.16 or newer (20.x), or 22.3 or newer (22.x), and npm.

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
- **Source-backed job search:** query Jobicy's remote jobs API with the user's role tag and rank up to 50 returned results against the remaining search terms. Candidate eligibility is shown separately from employer location. Job details show the original description, source-provided salary/type/tags/date, and explicit “not provided” labels for absent fields. Applicant counts and formal contract terms are not provided by this API; verify all requirements with the linked employer listing.
- **CV and cover-letter review:** select a listing and upload a PDF, DOCX, or TXT document (up to 5 MB each) for feedback against that source listing. At least one document is required; either or both can be uploaded. Text is extracted in memory and sent to OpenAI for the requested review. MarketPulse does not save uploaded files or extracted text. Do not upload information you do not want sent to OpenAI.
- **Safety:** server-only credentials, input size/schema validation, request throttling, prompt-injection pattern detection, explicit untrusted-context boundaries, and safe tool schemas. Avoid sending personal or sensitive information.
- **Easy bonuses:** conversation history in local storage, source citations, and retrieval mode/warning visualization.
- **Medium bonuses:** selectable chat models, search over cached job data, prompt-injection defenses, rough token/cost reporting when provider usage is returned, and tool-result visualizations.
- **Hard bonus:** hybrid search and a small repeatable RAG retrieval evaluation.

## Architecture

```text
Next.js dashboard
  ├── POST /api/chat
  │     ├── Validate + rate limit + inspect input
  │     ├── LangChain text splitting → hybrid retrieval
  │     ├── OpenAI ChatOpenAI → learning-roadmap tool call
  │     └── Answer + citations + retrieval/tool/usage metadata
  ├── GET /api/market → Jobicy role-tag search + local relevance ranking
  ├── POST /api/tailor → in-memory file extraction → OpenAI job-specific feedback
  └── POST /api/knowledge/refresh → rebuild chunks / warm embeddings
```

The knowledge index, job snapshot, and demo rate limiter are in-memory, suitable for a single-process prototype only. In a multi-instance deployment, the job snapshot may be fetched once per instance. For production use, use a shared cache and rate-limit store, authenticate accounts, add observability, and connect verified, dated regional salary and housing sources before displaying those benchmarks. Token costs are estimates based on hard-coded published model rates and should not be treated as billing.

## Evaluation and checks

```bash
npm run typecheck
npm run lint
npm run evaluate
npm run build
```

The retrieval evaluator reports Recall@3 for known domain questions and checks topic/location extraction for representative queries. It uses keyword retrieval when no embedding API key is configured and will fail if an expected source or structured query field is missing.
