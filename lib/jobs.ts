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
  nextCursor: z.string().nullish(),
  hasMore: z.boolean().optional(),
});

const RemotiveJobSchema = z.object({
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

const RemotiveResponseSchema = z.object({
  jobs: z.array(RemotiveJobSchema),
});

const RemoteOkJobSchema = z.object({
  id: z.number().or(z.string()),
  position: z.string(),
  company: z.string(),
  url: z.string().url(),
  date: z.string().nullish(),
  location: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  description: z.string().nullish(),
  salary_min: z.number().or(z.string()).nullish(),
  salary_max: z.number().or(z.string()).nullish(),
});

const RemoteOkResponseSchema = z.array(z.record(z.string(), z.unknown()));

const HimalayasJobSchema = z.object({
  guid: z.string().url(),
  title: z.string(),
  companyName: z.string(),
  excerpt: z.string().nullish(),
  description: z.string().nullish(),
  employmentType: z.string().nullish(),
  minSalary: z.number().nullish(),
  maxSalary: z.number().nullish(),
  salaryPeriod: z.string().nullish(),
  currency: z.string().nullish(),
  locationRestrictions: z.array(z.string()).nullish(),
  timezoneRestrictions: z.array(z.number()).nullish(),
  categories: z.array(z.string()).nullish(),
  pubDate: z.number().or(z.string()),
  expiryDate: z.number().or(z.string()).nullish(),
  applicationLink: z.string().url(),
});

const HimalayasResponseSchema = z.object({
  jobs: z.array(HimalayasJobSchema),
});

export type RemoteJob = {
  id: string;
  title: string;
  company: string;
  employerLocation: string;
  eligibilityLocation: string;
  salary: string;
  url: string;
  sourceUrl: string;
  date: string;
  category: string;
  jobType: string;
  tags: string[];
  description: string;
  source: "Jobicy" | "Remotive" | "Remote OK" | "Himalayas";
};

export type JobSnapshot = {
  jobs: RemoteJob[];
  fetchedAt: string;
  sourceUpdatedAt: string;
  sourceErrors: string[];
};

const SNAPSHOT_TTL_MS = 15 * 60 * 1_000;
const JOBICY_PAGE_SIZE = 200;
const JOBICY_MAX_JOBS_PER_INDUSTRY = 1_000;
const HIMALAYAS_MAX_PAGES_PER_QUERY = 10;
const runtimeCache = globalThis as typeof globalThis & {
  signalSpringJobSnapshots?: Map<string, JobSnapshot>;
  signalSpringJobSnapshotPromises?: Map<string, Promise<JobSnapshot>>;
};
const snapshotCache =
  runtimeCache.signalSpringJobSnapshots ??
  (runtimeCache.signalSpringJobSnapshots = new Map<string, JobSnapshot>());
const snapshotPromises =
  runtimeCache.signalSpringJobSnapshotPromises ??
  (runtimeCache.signalSpringJobSnapshotPromises = new Map<string, Promise<JobSnapshot>>());

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

function mapJobicyJobs(
  payload: z.infer<typeof JobicyResponseSchema>,
): RemoteJob[] {
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
      sourceUrl: job.url,
      date: job.pubDate ?? "",
      category: industries[0] ?? "",
      jobType: types.join(", "),
      tags: [...industries, ...types, ...(job.jobLevel ? [job.jobLevel] : [])],
      description: plainText(job.jobDescription || job.jobExcerpt || ""),
      source: "Jobicy",
    };
  });
}

function mapRemotiveJobs(
  payload: z.infer<typeof RemotiveResponseSchema>,
): RemoteJob[] {
  return payload.jobs.map((job) => ({
    id: `remotive-${job.id}`,
    title: job.title,
    company: job.company_name.trim(),
    employerLocation: job.company_location?.trim() || "",
    eligibilityLocation: job.candidate_required_location?.trim() || "",
    salary: job.salary?.trim() || "",
    url: job.url,
    sourceUrl: job.url,
    date: job.publication_date,
    category: job.category?.trim() || "",
    jobType: job.job_type?.trim() || "",
    tags: job.tags ?? [],
    description: plainText(job.description ?? ""),
    source: "Remotive",
  }));
}

function mapRemoteOkJobs(records: z.infer<typeof RemoteOkResponseSchema>): {
  jobs: RemoteJob[];
  sourceUpdatedAt: string;
} {
  const [metadata, ...jobRecords] = records;
  if (!metadata || typeof metadata.last_updated !== "number") {
    throw new Error("Remote OK response is missing its update metadata.");
  }

  const jobs = jobRecords.map((record) => {
    const job = RemoteOkJobSchema.parse(record);
    const salary = [job.salary_min, job.salary_max]
      .filter((amount) => amount != null)
      .join("–");
    return {
      id: `remoteok-${job.id}`,
      title: job.position,
      company: job.company.trim(),
      employerLocation: "",
      eligibilityLocation: job.location?.trim() || "",
      salary,
      url: job.url,
      sourceUrl: job.url,
      date: job.date ?? "",
      category: "",
      jobType: "",
      tags: job.tags ?? [],
      description: plainText(job.description ?? ""),
      source: "Remote OK" as const,
    };
  });

  return {
    jobs,
    sourceUpdatedAt: new Date(metadata.last_updated * 1_000).toISOString(),
  };
}

function newestDate(dates: string[]): string {
  return (
    dates
      .filter((date) => Number.isFinite(Date.parse(date)))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? ""
  );
}

function mapHimalayasJob(
  job: z.infer<typeof HimalayasJobSchema>,
): RemoteJob | undefined {
  const locationRestrictions = job.locationRestrictions ?? [];
  const timezoneRestrictions = job.timezoneRestrictions ?? [];
  const ugandaIsLocationEligible =
    locationRestrictions.length === 0 ||
    locationRestrictions.some((location) =>
      /^(?:uganda|africa|east(?:ern)? africa|worldwide|global|anywhere)\b/i.test(
        location.trim(),
      ),
    );
  const ugandaIsTimezoneEligible =
    timezoneRestrictions.length === 0 || timezoneRestrictions.includes(3);
  if (!ugandaIsLocationEligible || !ugandaIsTimezoneEligible) return undefined;

  const eligibilityLocation = locationRestrictions.length
    ? locationRestrictions.join(", ")
    : timezoneRestrictions.length === 0 || timezoneRestrictions.length >= 30
      ? "Worldwide (Uganda eligible)"
      : "Uganda eligible (UTC+3)";
  const salaryRange = [job.minSalary, job.maxSalary]
    .filter((amount) => amount != null)
    .join("–");
  const salary = [
    job.currency,
    salaryRange,
    salaryRange ? job.salaryPeriod : "",
  ]
    .filter(Boolean)
    .join(" ");
  const postedAt = Number(job.pubDate);
  const expiresAt = Number(job.expiryDate);
  if (
    job.expiryDate != null &&
    Number.isFinite(expiresAt) &&
    (expiresAt < 1_000_000_000_000 ? expiresAt * 1_000 : expiresAt) <
      Date.now()
  ) {
    return undefined;
  }

  return {
    id: `himalayas-${job.guid}`,
    title: job.title,
    company: job.companyName.trim(),
    employerLocation: "",
    eligibilityLocation,
    salary,
    url: job.applicationLink,
    sourceUrl: job.guid,
    date: Number.isFinite(postedAt)
      ? new Date(postedAt < 1_000_000_000_000 ? postedAt * 1_000 : postedAt).toISOString()
      : "",
    category: job.categories?.[0] ?? "",
    jobType: job.employmentType ?? "",
    tags: job.categories ?? [],
    description: plainText(job.description || job.excerpt || ""),
    source: "Himalayas",
  };
}

const nonEngineeringRolePattern =
  /\b(sales|marketing|account(?: executive| manager)|business development|customer success|customer support|recruit(?:er|ment)|growth|content|copywriter|brand)\b/i;
const targetTechnologyPattern =
  /\b(software|web|frontend|front[- ]end|backend|back[- ]end|full[- ]stack|mobile|ios|android|developer|devops|sre|site reliability|cloud|platform|infrastructure|cybersecurity|cyber security|security engineer|qa|quality assurance|tester|testing|data scientist|data engineer|data architect|machine learning|artificial intelligence|ai|llm|generative ai|nlp|natural language processing|computer vision|robotics|database|network|systems)\b/i;
const engineeringTitlePattern =
  /\b(engineer(?:ing)?|developer|programmer|scientist|research(?:er)?|architect|tester|qa|quality assurance|sre)\b/i;
const aiDisciplinePattern =
  /\b(ai|artificial intelligence|machine learning|ml|llm|generative ai|nlp|natural language processing|computer vision|robotics)\b/i;

function isSoftwareOrAiEngineeringRole(job: RemoteJob): boolean {
  if (nonEngineeringRolePattern.test(job.title)) return false;
  const roleDetails = `${job.title} ${job.category} ${job.tags.join(" ")}`;
  return (
    targetTechnologyPattern.test(roleDetails) &&
    engineeringTitlePattern.test(job.title) &&
    (targetTechnologyPattern.test(job.title) ||
      aiDisciplinePattern.test(roleDetails))
  );
}

async function fetchJobicyJobs(): Promise<{
  jobs: RemoteJob[];
  sourceUpdatedAt: string;
  errors: string[];
}> {
  const industries = ["engineering", "data-science", "cybersecurity"];
  const results = await Promise.allSettled(
    industries.map(async (industry) => {
      const jobs: RemoteJob[] = [];
      const updateDates: string[] = [];
      const seenCursors = new Set<string>();
      let cursor: string | undefined;

      while (jobs.length < JOBICY_MAX_JOBS_PER_INDUSTRY) {
        const query = new URLSearchParams({
          count: String(JOBICY_PAGE_SIZE),
          industry,
        });
        if (cursor) query.set("cursor", cursor);

        const response = await fetch(
          `https://jobicy.com/api/jobs?${query.toString()}`,
          {
            headers: { Accept: "application/json" },
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (!response.ok) {
          throw new Error(`Jobicy returned status ${response.status}.`);
        }

        const payload = JobicyResponseSchema.parse(await response.json());
        jobs.push(...mapJobicyJobs(payload));
        if (payload.lastUpdate) updateDates.push(payload.lastUpdate);

        const nextCursor = payload.nextCursor ?? undefined;
        if (
          !payload.hasMore ||
          !nextCursor ||
          seenCursors.has(nextCursor) ||
          payload.jobs.length === 0
        ) {
          break;
        }
        seenCursors.add(nextCursor);
        cursor = nextCursor;
      }
      return { jobs, sourceUpdatedAt: newestDate(updateDates) };
    }),
  );

  const jobs: RemoteJob[] = [];
  const updateDates: string[] = [];
  const errors: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      jobs.push(...result.value.jobs);
      if (result.value.sourceUpdatedAt) {
        updateDates.push(result.value.sourceUpdatedAt);
      }
      return;
    }
    const message =
      result.reason instanceof Error ? result.reason.message : "Unknown error.";
    errors.push(`Jobicy (${industries[index]}): ${message}`);
  });
  return {
    jobs,
    sourceUpdatedAt: newestDate(updateDates),
    errors,
  };
}

async function fetchRemotiveJobs(): Promise<RemoteJob[]> {
  const response = await fetch(
    "https://remotive.com/api/remote-jobs?limit=50",
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Remotive returned status ${response.status}.`);
  }
  return mapRemotiveJobs(RemotiveResponseSchema.parse(await response.json()));
}

async function fetchRemoteOkJobs(): Promise<{
  jobs: RemoteJob[];
  sourceUpdatedAt: string;
}> {
  const response = await fetch("https://remoteok.com/api", {
    headers: {
      Accept: "application/json",
      "User-Agent": "CareerConsultant/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Remote OK returned status ${response.status}.`);
  }
  return mapRemoteOkJobs(RemoteOkResponseSchema.parse(await response.json()));
}

async function fetchHimalayasJobs(): Promise<{
  jobs: RemoteJob[];
  errors: string[];
}> {
  const queries = ["software engineer", "developer", "machine learning"];
  const results = await Promise.allSettled(
    queries.map(async (searchTerm) => {
      const jobs: RemoteJob[] = [];
      for (
        let page = 1;
        page <= HIMALAYAS_MAX_PAGES_PER_QUERY;
        page += 1
      ) {
        const query = new URLSearchParams({
          q: searchTerm,
          country: "Uganda",
          sort: "recent",
          page: String(page),
        });
        const response = await fetch(
          `https://himalayas.app/jobs/api/search?${query.toString()}`,
          {
            headers: { Accept: "application/json" },
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (!response.ok) {
          throw new Error(`Himalayas returned status ${response.status}.`);
        }
        const payload = HimalayasResponseSchema.parse(await response.json());
        if (payload.jobs.length === 0) break;
        for (const job of payload.jobs) {
          const mappedJob = mapHimalayasJob(job);
          if (mappedJob) jobs.push(mappedJob);
        }
        if (payload.jobs.length < 20) break;
      }
      return jobs;
    }),
  );

  const jobs: RemoteJob[] = [];
  const errors: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      jobs.push(...result.value);
      return;
    }
    const message =
      result.reason instanceof Error ? result.reason.message : "Unknown error.";
    errors.push(`Himalayas (${queries[index]}): ${message}`);
  });
  if (jobs.length === 0 && errors.length === queries.length) {
    throw new Error(errors.join(" "));
  }
  return {
    jobs: [...new Map(jobs.map((job) => [job.id, job])).values()],
    errors,
  };
}

export async function getJobSnapshot(forceRefresh = false): Promise<JobSnapshot> {
  const cacheKey = "__tech_roles__";
  const cached = snapshotCache.get(cacheKey);
  if (
    !forceRefresh &&
    cached &&
    Date.now() - Date.parse(cached.fetchedAt) < SNAPSHOT_TTL_MS
  ) {
    return cached;
  }
  const pending = snapshotPromises.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    const [
      remotiveResult,
      jobicyResult,
      remoteOkResult,
      himalayasResult,
    ] = await Promise.allSettled([
      fetchRemotiveJobs(),
      fetchJobicyJobs(),
      fetchRemoteOkJobs(),
      fetchHimalayasJobs(),
    ]);
    const jobs: RemoteJob[] = [];
    const updateDates: string[] = [];
    const sourceErrors: string[] = [];

    if (remotiveResult.status === "fulfilled") {
      jobs.push(...remotiveResult.value);
      updateDates.push(...remotiveResult.value.map((job) => job.date));
    } else {
      const message =
        remotiveResult.reason instanceof Error
          ? remotiveResult.reason.message
          : "Unknown error.";
      sourceErrors.push(`Remotive: ${message}`);
    }

    if (jobicyResult.status === "fulfilled") {
      jobs.push(...jobicyResult.value.jobs);
      if (jobicyResult.value.sourceUpdatedAt) {
        updateDates.push(jobicyResult.value.sourceUpdatedAt);
      }
      sourceErrors.push(...jobicyResult.value.errors);
    } else {
      const message =
        jobicyResult.reason instanceof Error
          ? jobicyResult.reason.message
          : "Unknown error.";
      sourceErrors.push(`Jobicy: ${message}`);
    }

    if (remoteOkResult.status === "fulfilled") {
      jobs.push(...remoteOkResult.value.jobs);
      updateDates.push(remoteOkResult.value.sourceUpdatedAt);
    } else {
      const message =
        remoteOkResult.reason instanceof Error
          ? remoteOkResult.reason.message
          : "Unknown error.";
      sourceErrors.push(`Remote OK: ${message}`);
    }

    if (himalayasResult.status === "fulfilled") {
      jobs.push(...himalayasResult.value.jobs);
      sourceErrors.push(...himalayasResult.value.errors);
    } else {
      const message =
        himalayasResult.reason instanceof Error
          ? himalayasResult.reason.message
          : "Unknown error.";
      sourceErrors.push(`Himalayas: ${message}`);
    }

    if (sourceErrors.length && jobs.length === 0) {
      throw new Error(`All job sources failed: ${sourceErrors.join(" ")}`);
    }

    const snapshot: JobSnapshot = {
      jobs,
      fetchedAt: new Date().toISOString(),
      sourceUpdatedAt: newestDate(updateDates),
      sourceErrors,
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
  const softwareAndAiJobs = jobs.filter(isSoftwareOrAiEngineeringRole);
  const terms = searchTerms(query);
  const excludedSearchTerms = new Set([
    "sales",
    "marketing",
    "marketer",
    "recruiter",
    "recruitment",
    "advertising",
  ]);
  if (terms.some((term) => excludedSearchTerms.has(term))) {
    return [];
  }
  if (!terms.length) {
    return [...softwareAndAiJobs].sort(newestFirst);
  }

  return softwareAndAiJobs
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
