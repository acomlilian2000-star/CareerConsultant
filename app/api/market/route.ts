import { z } from "zod";

export const runtime = "nodejs";

const JobSchema = z.object({
  id: z.number().or(z.string()),
  title: z.string(),
  company_name: z.string(),
  candidate_required_location: z.string().optional().default("Remote"),
  salary: z.string().optional().default("Not listed"),
  url: z.string().url(),
  publication_date: z.string(),
  category: z.string().optional(),
});

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams.get("search")?.trim().slice(0, 80) || "software developer";
  try {
    const response = await fetch(
      `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(search)}&limit=10`,
      { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) {
      return Response.json({ error: `Remote jobs source returned status ${response.status}.` }, { status: 502 });
    }
    const payload: unknown = await response.json();
    const result = z
      .object({
        jobs: z.array(JobSchema),
        "total-job-count": z.number().int().nonnegative().optional(),
      })
      .parse(payload);
    const jobs = result.jobs.map((job) => ({
        id: String(job.id),
        title: job.title,
        company: job.company_name,
        location: job.candidate_required_location,
        salary: job.salary || "Not listed",
        url: job.url,
        date: job.publication_date,
        category: job.category ?? "",
      }));
    return Response.json({
      jobs,
      totalJobCount: result["total-job-count"] ?? jobs.length,
      fetchedAt: new Date().toISOString(),
      source: "Remotive public remote jobs API",
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
