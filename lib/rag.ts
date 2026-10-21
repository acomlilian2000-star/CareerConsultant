import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { knowledgeBase } from "@/lib/knowledge";

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

function getEmbeddings() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return undefined;
  embeddings ??= new OpenAIEmbeddings({
    apiKey,
    model: process.env.OPENROUTER_EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
    configuration: {
      baseURL:
        process.env.EMBEDDING_BASE_URL ||
        process.env.OPENROUTER_BASE_URL ||
        "https://openrouter.ai/api/v1",
    },
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
): Promise<{ results: RetrievedChunk[]; mode: "hybrid" | "keyword"; warning?: string }> {
  const documents = await getChunks();
  let queryVector: number[] | undefined;
  let vectors: number[][] | undefined;
  let warning: string | undefined;
  const embedder = getEmbeddings();

  if (embedder) {
    try {
      queryVector = await embedder.embedQuery(query);
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
      const keywordScore = keywordSimilarity(
        query,
        `${document.pageContent} ${document.metadata.title} ${document.metadata.publisher}`,
      );
      const vectorScore =
        queryVector && vectors ? (cosineSimilarity(queryVector, vectors[index]) + 1) / 2 : undefined;
      const score =
        vectorScore === undefined ? keywordScore : 0.62 * vectorScore + 0.38 * keywordScore;
      return { document, score, keywordScore, vectorScore };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    mode: queryVector && vectors ? "hybrid" : "keyword",
    warning,
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
