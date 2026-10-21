# MarketPulse: AI-Driven Tech Career Router

MarketPulse is a Next.js career-advising app for early-career developers. It combines a small, cited career knowledge base, hybrid retrieval-augmented generation (RAG), OpenRouter chat models, career-specific tools, and a responsive dashboard for regional planning.

> Salary bands and rent figures shipped with the demo are intentionally illustrative planning inputs. They are not verified wage/housing benchmarks, tax advice, or a promise of employment. Replace them with dated, licensed, regionally representative data before using the app for real decisions.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
cp .env.example .env.local
# Add an OpenRouter key to .env.local for model and embedding calls.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without an API key, the app still runs in demo mode: keyword retrieval, source links, conversation history, the remote-jobs refresh, and the UI work, but personalized LLM answers and embeddings are unavailable. Set `OPENROUTER_API_KEY` to enable chat and embeddings. The key stays server-side.

Set `OPENROUTER_BASE_URL` to an OpenAI-compatible endpoint if desired. The model picker supports OpenRouter model IDs. `OPENROUTER_EMBEDDING_MODEL` defaults to `openai/text-embedding-3-small`; optionally configure `EMBEDDING_BASE_URL` for a separate compatible embedding endpoint.

## What is implemented

- **RAG:** a six-source career knowledge base is split into overlapping chunks with LangChain's `RecursiveCharacterTextSplitter`. When embeddings are configured, cosine similarity is combined with keyword overlap (hybrid search); without embeddings, transparent keyword retrieval remains available. Responses show source links and retrieval mode.
- **Tool calling:** three LangChain tools calculate an illustrative salary path, estimate a rent-to-net-income ratio, and create a staged 12-week learning plan. Tool results are rendered as cards.
- **LLM integration:** LangChain `ChatOpenAI` uses the OpenRouter-compatible API. The model can be selected in the UI. Without a key, the app returns an explicit, retrieval-grounded demo response.
- **Live market signals:** the API fetches public remote software roles from Remotive on request; listings link to the original source. The returned jobs are remote listings, not a representative city-level dataset.
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
  │     ├── OpenRouter ChatOpenAI → optional career tool calls
  │     └── Answer + citations + retrieval/tool/usage metadata
  ├── GET /api/market → Remotive public jobs API
  └── POST /api/knowledge/refresh → rebuild chunks / warm embeddings
```

The knowledge index and demo rate limiter are in-memory, suitable for a single-process prototype only. For multi-instance production use, use a persistent vector database and shared rate-limit store, authenticate accounts, add observability, and source salary/housing data from trustworthy, dated regional datasets. Token costs are estimates based on hard-coded published model rates and should not be treated as billing.

## Evaluation and checks

```bash
npm run typecheck
npm run lint
npm run evaluate
npm run build
```

The retrieval evaluator reports Recall@3 for four known domain questions. It uses keyword retrieval when no embedding API key is configured and will fail if the expected source is not retrieved.
