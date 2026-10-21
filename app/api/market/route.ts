import { findRelevantJobs, getJobSnapshot } from "@/lib/remotive";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams.get("search")?.trim().slice(0, 80) ?? "";
  try {
    const snapshot = await getJobSnapshot();
    const matchingJobs = findRelevantJobs(snapshot.jobs, search);
    return Response.json({
      jobs: matchingJobs.slice(0, 20),
      totalJobCount: matchingJobs.length,
      snapshotSize: snapshot.jobs.length,
      fetchedAt: snapshot.fetchedAt,
      source: "Remotive public remote jobs API",
      searchMode: "relevance-ranked source snapshot",
    });
  } catch (error) {
    console.error("MarketPulse market refresh failed:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? `Live job data is unavailable: ${error.message}`
            : "Live job data is unavailable.",
      },
      { status: 502 },
    );
  }
}
