import { findRelevantJobs, getJobSnapshot } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const search = params.get("search")?.trim().slice(0, 80) ?? "";
  const forceRefresh = params.get("refresh") === "1";
  try {
    const snapshot = await getJobSnapshot(forceRefresh);
    const matchingJobs = findRelevantJobs(snapshot.jobs, search);
    return Response.json({
      jobs: matchingJobs.slice(0, 30),
      totalJobCount: matchingJobs.length,
      snapshotSize: findRelevantJobs(snapshot.jobs, "").length,
      fetchedAt: snapshot.fetchedAt,
      sourceUpdatedAt: snapshot.sourceUpdatedAt,
      sourceErrors: snapshot.sourceErrors,
      sources: ["Remotive", "Jobicy", "Remote OK"],
      searchMode: search
        ? "multi-source software and AI role relevance ranking"
        : "latest multi-source software and AI listings",
    });
  } catch (error) {
    console.error("SignalSpring market refresh failed:", error);
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
