import { resetKnowledgeIndex } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST() {
  try {
    await resetKnowledgeIndex();
    return Response.json({
      refreshedAt: new Date().toISOString(),
      documentCount: 6,
      message: "Knowledge chunks rebuilt and embedding index warmed when configured.",
    });
  } catch (error) {
    console.error("MarketPulse knowledge refresh failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Knowledge refresh failed." },
      { status: 502 },
    );
  }
}
