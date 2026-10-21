import { z } from "zod";

const JobicyJobSchema = z.object({
  id: z.number().or(z.string()),
  url: z.string().url(),
  jobTitle: z.string(),
  companyName: z.string(),
  jobIndustry: z.array(z.string()).nullish(),
  jobType: z.array(z.string()).nullish(),
  jobGeo: z.string().nullish(),
  jobLevel: z.string().nullish(),
  jobExcerpt: z.string().nullish(),
  jobDescription: z.string().nullish(),
  pubDate: z.string().nullish(),
  salaryMin: z.number().or(z.string()).nullish(),
  salaryMax: z.number().or(z.string()).nullish(),
  salaryCurrency: z.string().nullish(),
  salaryPeriod: z.string().nullish(),
});

const JobicyResponseSchema = z.object({
  jobs: z.array(JobicyJobSchema),
  jobCount: z.number().int().nonnegative().optional(),
  lastUpdate: z.string().optional(),
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
  source: "Jobicy";
};

export type JobSnapshot = {
  jobs: RemoteJob[];
  fetchedAt: string;
  sourceUpdatedAt: string;
};

const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1_000;
const runtimeCache = globalThis as typeof globalThis & {
  marketPulseJobSnapshots?: Map<string, JobSnapshot>;
  marketPulseJobSnapshotPromises?: Map<string, Promise<JobSnapshot>>;
};
const snapshotCache =
  runtimeCache.marketPulseJobSnapshots ??
  (runtimeCache.marketPulseJobSnapshots = new Map<string, JobSnapshot>());
const snapshotPromises =
  runtimeCache.marketPulseJobSnapshotPromises ??
  (runtimeCache.marketPulseJobSnapshotPromises = new Map<string, Promise<JobSnapshot>>());

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
    .replace(/&hellip;/gi, "…")
    .trim();
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
  "position",
  "positions",
  "career",
  "careers",
]);

function searchTerms(query: string): string[] {
  const normalized = query
    .toLocaleLowerCase()
    .replace(/front[\s-]?end/g, "frontend")
    .replace(/back[\s-]?end/g, "backend")
    .replace(/full[\s-]?stack/g, "fullstack")
    .replace(/ui\s*\/?\s*ux/g, "design");
  return [...new Set(normalized.match(/[a-z0-9+#.]+/g) ?? [])]
    .filter((term) => term.length > 1 && !genericRoleTerms.has(term))
    .slice(0, 12);
}

function normalizeTag(term: string): string {
  const aliases: Record<string, string> = {
    "front-end": "frontend",
    "back-end": "backend",
    "full-stack": "fullstack",
    "ui/ux": "design",
    "user-experience": "design",
    "machine-learning": "machine-learning",
    "data-analyst": "data-analyst",
  };
  return aliases[term] ?? term;
}

function newestFirst(a: RemoteJob, b: RemoteJob): number {
  const firstDate = Date.parse(a.date);
  const secondDate = Date.parse(b.date);
  const firstTime = Number.isFinite(firstDate) ? firstDate : 0;
  const secondTime = Number.isFinite(secondDate) ? secondDate : 0;
  return secondTime - firstTime;
}

function formatSalary(job: z.infer<typeof JobicyJobSchema>): string {
  const low = job.salaryMin;
  const high = job.salaryMax;
  if (low == null && high == null) return "";
  const amount = [low, high].filter((value) => value != null).join("–");
  return [job.salaryCurrency, amount, job.salaryPeriod].filter(Boolean).join(" ");
}

function mapJobs(payload: z.infer<typeof JobicyResponseSchema>): RemoteJob[] {
  return payload.jobs.map((job) => {
    const industries = job.jobIndustry ?? [];
    const types = job.jobType ?? [];
    return {
      id: `jobicy-${job.id}`,
      title: job.jobTitle,
      company: job.companyName.trim(),
      employerLocation: "",
      eligibilityLocation: job.jobGeo?.trim() || "",
      salary: formatSalary(job),
      url: job.url,
      date: job.pubDate ?? "",
      category: industries[0] ?? "",
      jobType: types.join(", "),
      tags: [...industries, ...types, ...(job.jobLevel ? [job.jobLevel] : [])],
      description: plainText(job.jobDescription || job.jobExcerpt || ""),
      source: "Jobicy",
    };
  });
}

export async function getJobSnapshot(search: string): Promise<JobSnapshot> {
  const terms = searchTerms(search);
  const tag = terms.length ? normalizeTag(terms[0]) : "";
  const cacheKey = tag || "__latest__";
  const cached = snapshotCache.get(cacheKey);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < SNAPSHOT_TTL_MS) {
    return cached;
  }
  const pending = snapshotPromises.get(cacheKey);
  if (pending) return pending;

  const query = new URLSearchParams({ count: "50" });
  if (tag) query.set("tag", tag);
  const promise = (async () => {
    const response = await fetch(
      `https://jobicy.com/api/v2/remote-jobs?${query.toString()}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) {
      throw new Error(`Jobicy jobs source returned status ${response.status}.`);
    }

    const payload = JobicyResponseSchema.parse(await response.json());
    const snapshot: JobSnapshot = {
      jobs: mapJobs(payload),
      fetchedAt: new Date().toISOString(),
      sourceUpdatedAt: payload.lastUpdate ?? "",
    };
    snapshotCache.set(cacheKey, snapshot);
    return snapshot;
  })();
  snapshotPromises.set(cacheKey, promise);

  try {
    return await promise;
  } finally {
    snapshotPromises.delete(cacheKey);
  }
}

export function findRelevantJobs(
  jobs: RemoteJob[],
  query: string,
): RemoteJob[] {
  const terms = searchTerms(query);
  if (!terms.length) {
    return [...jobs].sort(newestFirst);
  }

  return jobs
    .map((job) => {
      const title = job.title.toLocaleLowerCase();
      const tags = job.tags.join(" ").toLocaleLowerCase();
      const category = job.category.toLocaleLowerCase();
      const description = job.description.toLocaleLowerCase();
      const directMatch = terms.some(
        (term) =>
          title.includes(term) ||
          tags.includes(term) ||
          category.includes(term),
      );
      const score = terms.reduce(
        (total, term) =>
          total +
          (title.includes(term) ? 8 : 0) +
          (tags.includes(term) ? 5 : 0) +
          (category.includes(term) ? 3 : 0) +
          (description.includes(term) ? 1 : 0),
        0,
      );
      return { job, score, directMatch };
    })
    .filter(({ directMatch }) => directMatch)
    .sort((a, b) => newestFirst(a.job, b.job) || b.score - a.score)
    .map(({ job }) => job);
}

export async function getJobById(id: string): Promise<RemoteJob | undefined> {
  for (const snapshot of snapshotCache.values()) {
    const job = snapshot.jobs.find((item) => item.id === id);
    if (job) return job;
  }
  return undefined;
}
