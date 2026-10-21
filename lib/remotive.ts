import { z } from "zod";

const JobSchema = z.object({
  id: z.number().or(z.string()),
  title: z.string(),
  company_name: z.string(),
  company_location: z.string().nullish(),
  candidate_required_location: z.string().nullish(),
  salary: z.string().nullish(),
  url: z.string().url(),
  publication_date: z.string(),
  category: z.string().nullish(),
  job_type: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  description: z.string().nullish(),
});

const ResponseSchema = z.object({
  jobs: z.array(JobSchema),
  "total-job-count": z.number().int().nonnegative().optional(),
});

export type RemoteJob = {
  id: string;
  title: string;
  company: string;
  employerLocation: string;
  eligibilityLocation: string;
  salary: string;
  url: string;
  date: string;
  category: string;
  jobType: string;
  tags: string[];
  description: string;
};

type JobSnapshot = {
  jobs: RemoteJob[];
  fetchedAt: string;
};

const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1_000;
const runtimeCache = globalThis as typeof globalThis & {
  marketPulseJobSnapshot?: JobSnapshot;
  marketPulseJobSnapshotPromise?: Promise<JobSnapshot>;
};

function plainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function getJobSnapshot(): Promise<JobSnapshot> {
  const snapshot = runtimeCache.marketPulseJobSnapshot;
  if (snapshot && Date.now() - Date.parse(snapshot.fetchedAt) < SNAPSHOT_TTL_MS) {
    return snapshot;
  }
  if (runtimeCache.marketPulseJobSnapshotPromise) {
    return runtimeCache.marketPulseJobSnapshotPromise;
  }

  runtimeCache.marketPulseJobSnapshotPromise = (async () => {
    const response = await fetch("https://remotive.com/api/remote-jobs?limit=10", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      throw new Error(`Remote jobs source returned status ${response.status}.`);
    }

    const result = ResponseSchema.parse(await response.json());
    const nextSnapshot: JobSnapshot = {
      jobs: result.jobs.map((job) => ({
        id: String(job.id),
        title: job.title,
        company: job.company_name,
        employerLocation: job.company_location?.trim() || "",
        eligibilityLocation: job.candidate_required_location?.trim() || "",
        salary: job.salary?.trim() || "",
        url: job.url,
        date: job.publication_date,
        category: job.category?.trim() || "",
        jobType: job.job_type?.trim() || "",
        tags: job.tags ?? [],
        description: plainText(job.description ?? ""),
      })),
      fetchedAt: new Date().toISOString(),
    };
    runtimeCache.marketPulseJobSnapshot = nextSnapshot;
    return nextSnapshot;
  })();

  try {
    return await runtimeCache.marketPulseJobSnapshotPromise;
  } finally {
    runtimeCache.marketPulseJobSnapshotPromise = undefined;
  }
}

const genericRoleTerms = new Set([
  "developer",
  "developers",
  "dev",
  "engineer",
  "engineers",
  "software",
  "remote",
  "job",
  "jobs",
  "role",
  "roles",
  "work",
  "hiring",
]);

function searchTerms(query: string): string[] {
  return [...new Set(query.toLocaleLowerCase().match(/[a-z0-9+#.]+/g) ?? [])]
    .filter((term) => term.length > 1 && !genericRoleTerms.has(term))
    .slice(0, 12);
}

export function findRelevantJobs(jobs: RemoteJob[], query: string): RemoteJob[] {
  const terms = searchTerms(query);
  if (!terms.length) {
    return [...jobs].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }

  return jobs
    .map((job) => {
      const title = job.title.toLocaleLowerCase();
      const tags = job.tags.join(" ").toLocaleLowerCase();
      const category = job.category.toLocaleLowerCase();
      const description = job.description.toLocaleLowerCase();
      const score = terms.reduce(
        (total, term) =>
          total +
          (title.includes(term) ? 5 : 0) +
          (tags.includes(term) ? 3 : 0) +
          (category.includes(term) ? 2 : 0) +
          (description.includes(term) ? 1 : 0),
        0,
      );
      return { job, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || Date.parse(b.job.date) - Date.parse(a.job.date),
    )
    .map(({ job }) => job);
}

export async function getJobById(id: string): Promise<RemoteJob | undefined> {
  const { jobs } = await getJobSnapshot();
  return jobs.find((job) => job.id === id);
}
