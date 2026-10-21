import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { cities, knowledgeBase, type City } from "@/lib/knowledge";

export type RetrievalTopic = "skills" | "salary" | "jobs" | "learning" | "portfolio";
export type RetrievalPlan = {
  originalQuery: string;
  translatedQuery: string;
  topic?: RetrievalTopic;
  location?: string;
};
export type RetrievedChunk = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  content: string;
  score: number;
  vectorScore?: number;
  keywordScore: number;
};

const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 520, chunkOverlap: 80 });
let chunksPromise: Promise<Document[]> | undefined;
let vectorsPromise: Promise<number[][]> | undefined;
let embeddings: OpenAIEmbeddings | undefined;

const topicTranslations: Record<RetrievalTopic, string> = {
  skills: "technology workforce emerging skills AI data cybersecurity analytical thinking employer demand",
  salary: "software developer compensation salary wage gross annual take-home monthly rent housing affordability living costs",
  jobs: "remote software developer job roles openings vacancies listings employers hiring",
  learning: "junior developer learning curriculum roadmap frontend backend full-stack TypeScript React APIs testing projects",
  portfolio: "junior software developer portfolio projects live demo tests README hiring evidence",
};

export function translateCareerQuery(query: string): RetrievalPlan {
  const normalized = query.toLowerCase();
  const topic: RetrievalTopic | undefined =
    /\b(salary|pay|income|earnings?|rent|housing|affordability|cost of living)\b/.test(normalized)
      ? "salary"
      : /\b(jobs?|roles?|vacanc(?:y|ies)|listings?|hiring|employers?|market)\b/.test(normalized)
        ? "jobs"
        : /\b(portfolio|showcase|resume|résumé|cv)\b/.test(normalized)
          ? "portfolio"
          : /\b(learn|learning|study|roadmap|curriculum|frontend|backend|full.stack)\b/.test(normalized)
            ? "learning"
            : /\b(skill|skills|trend|demand|emerging|future)\b/.test(normalized)
              ? "skills"
              : undefined;
  const location = (Object.keys(cities) as City[]).find((city) =>
    normalized.includes(city.toLowerCase()),
  );

  return {
    originalQuery: query,
    translatedQuery: topic
      ? `${topicTranslations[topic]}${location ? ` ${location}` : ""}`
      : query,
    topic,
    location,
  };
}

function getEmbeddings() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return undefined;
  embeddings ??= new OpenAIEmbeddings({
    apiKey,
    model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  });
  return embeddings;
}

async function getChunks() {
  chunksPromise ??= (async () => {
    const result: Document[] = [];
    for (const source of knowledgeBase) {
      const split = await splitter.createDocuments([source.text], [{ sourceId: source.id }]);
      result.push(
        ...split.map(
          (chunk) =>
            new Document({
              pageContent: chunk.pageContent,
              metadata: { ...chunk.metadata, ...source },
            }),
        ),
      );
    }
    return result;
  })();
  return chunksPromise;
}

function terms(text: string) {
  return new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9+#.]+/g)
      ?.filter((word) => word.length > 1) ?? [],
  );
}

function keywordSimilarity(query: string, text: string) {
  const queryTerms = terms(query);
  if (queryTerms.size === 0) return 0;
  const textTerms = terms(text);
  let overlap = 0;
  for (const term of queryTerms) if (textTerms.has(term)) overlap++;
  return overlap / queryTerms.size;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

export async function retrieveKnowledge(
  query: string,
  limit = 4,
): Promise<{
  results: RetrievedChunk[];
  mode: "hybrid" | "keyword";
  warning?: string;
  plan: RetrievalPlan;
}> {
  const documents = await getChunks();
  const plan = translateCareerQuery(query);
  let queryVectors: number[][] | undefined;
  let vectors: number[][] | undefined;
  let warning: string | undefined;
  const embedder = getEmbeddings();

  if (embedder) {
    try {
      queryVectors = await embedder.embedDocuments(
        [...new Set([query, plan.translatedQuery])],
      );
      vectorsPromise ??= embedder.embedDocuments(
        documents.map((document) => document.pageContent),
      );
      vectors = await vectorsPromise;
    } catch (error) {
      warning =
        error instanceof Error
          ? `Embedding retrieval unavailable (${error.message}). Using keyword search instead.`
          : "Embedding retrieval unavailable. Using keyword search instead.";
    }
  }

  const ranked = documents
    .map((document, index) => {
      const searchableText = `${document.pageContent} ${document.metadata.title} ${document.metadata.publisher}`;
      const keywordScore = Math.max(
        keywordSimilarity(query, searchableText),
        keywordSimilarity(plan.translatedQuery, searchableText),
      );
      const vectorScore = queryVectors && vectors
        ? queryVectors.reduce(
            (total, queryVector) => total + (cosineSimilarity(queryVector, vectors[index]) + 1) / 2,
            0,
          ) / queryVectors.length
        : undefined;
      const topicMatch =
        plan.topic && (document.metadata.topics as RetrievalTopic[]).includes(plan.topic);
      const locationMatch =
        plan.location &&
        (document.metadata.locations as string[]).some(
          (location) => location.toLowerCase() === plan.location?.toLowerCase(),
        );
      const baseScore =
        vectorScore === undefined ? keywordScore : 0.62 * vectorScore + 0.38 * keywordScore;
      const score = Math.min(
        1,
        baseScore + (topicMatch ? 0.08 : 0) + (locationMatch ? 0.08 : 0),
      );
      return { document, score, keywordScore, vectorScore };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    mode: queryVectors && vectors ? "hybrid" : "keyword",
    warning,
    plan,
    results: ranked.map(({ document, score, keywordScore, vectorScore }) => ({
      id: document.metadata.sourceId as string,
      title: document.metadata.title as string,
      publisher: document.metadata.publisher as string,
      url: document.metadata.url as string,
      content: document.pageContent,
      score: Number(score.toFixed(3)),
      vectorScore: vectorScore === undefined ? undefined : Number(vectorScore.toFixed(3)),
      keywordScore: Number(keywordScore.toFixed(3)),
    })),
  };
}

export async function resetKnowledgeIndex() {
  chunksPromise = undefined;
  vectorsPromise = undefined;
  const embedder = getEmbeddings();
  if (embedder) {
    const documents = await getChunks();
    vectorsPromise = embedder.embedDocuments(documents.map((document) => document.pageContent));
    await vectorsPromise;
  }
}
