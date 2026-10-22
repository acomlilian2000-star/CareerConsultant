"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Code2,
  Command,
  ExternalLink,
  FileText,
  Filter,
  Globe2,
  GraduationCap,
  LoaderCircle,
  Menu,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Job = {
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
  source: string;
};
type Citation = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  score: number;
  keywordScore: number;
  vectorScore?: number;
};
type ToolResult = { name: string; label: string; result: Record<string, unknown> };
type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Citation[];
  tools?: ToolResult[];
  retrieval?: {
    mode: string;
    warning?: string;
    plan?: { translatedQuery: string; topic?: string; location?: string };
  };
  security?: { injectionPatternDetected: boolean };
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  demoMode?: boolean;
};
type ChatResponse = {
  answer: string;
  sources?: Citation[];
  tools?: ToolResult[];
  retrieval?: Message["retrieval"];
  security?: Message["security"];
  usage?: Message["usage"];
  demoMode?: boolean;
  error?: string;
};

const models = [
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
];
const legacySuggestedQuestions = new Set([
  "Build me a 12-week frontend roadmap",
  "Search for current React developer roles",
  "What skills are growing in the latest workforce report?",
  "Compare junior salary and rent in London",
  "What skills are growing in tech?",
]);
const historyStorageKey = "signalspring-history";
const legacyHistoryStorageKey = "marketpulse-history";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(models[0].id);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalJobCount, setTotalJobCount] = useState(0);
  const [snapshotSize, setSnapshotSize] = useState(0);
  const [marketSearch, setMarketSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [jobsLoading, setJobsLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [fetchedAt, setFetchedAt] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState("");
  const [tailorFeedback, setTailorFeedback] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [activeNav, setActiveNav] = useState("Overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  useEffect(() => {
    const storageKey = window.localStorage.getItem(historyStorageKey)
      ? historyStorageKey
      : legacyHistoryStorageKey;
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((message, index) => {
            if (message.role === "user" && legacySuggestedQuestions.has(message.content.trim())) {
              return false;
            }
            const previous = parsed[index - 1];
            return !(
              message.role === "assistant" &&
              previous?.role === "user" &&
              legacySuggestedQuestions.has(previous.content.trim())
            );
          });
          const history = cleaned.slice(-30);
          if (cleaned.length !== parsed.length || storageKey !== historyStorageKey) {
            window.localStorage.setItem(historyStorageKey, JSON.stringify(history));
          }
          if (storageKey !== historyStorageKey) {
            window.localStorage.removeItem(legacyHistoryStorageKey);
          }
          setMessages(history);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(historyStorageKey, JSON.stringify(messages.slice(-30)));
  }, [messages]);

  const refreshJobs = useCallback(async (search: string, forceRefresh = true) => {
    setJobsLoading(true);
    setMarketError("");
    setSourceErrors([]);
    setCategoryFilter("");
    setSelectedJob(null);
    setCvFile(null);
    setCoverLetterFile(null);
    setTailorError("");
    setTailorFeedback("");
    setJobs([]);
    setTotalJobCount(0);
    setSnapshotSize(0);
    setFetchedAt("");
    try {
      const params = new URLSearchParams({ search });
      if (forceRefresh) params.set("refresh", "1");
      const response = await fetch(`/api/market?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        jobs?: Job[];
        totalJobCount?: number;
        snapshotSize?: number;
        fetchedAt?: string;
        sourceErrors?: string[];
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Could not refresh jobs.");
      setJobs(result.jobs ?? []);
      setTotalJobCount(result.totalJobCount ?? result.jobs?.length ?? 0);
      setSnapshotSize(result.snapshotSize ?? 0);
      setFetchedAt(result.fetchedAt ?? "");
      setSourceErrors(result.sourceErrors ?? []);
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "Could not refresh jobs.");
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshJobs("", false);
  }, [refreshJobs]);

  async function reviewDocuments(event: FormEvent) {
    event.preventDefault();
    if (!selectedJob || (!cvFile && !coverLetterFile) || tailoring) return;
    setTailoring(true);
    setTailorError("");
    setTailorFeedback("");
    const form = new FormData();
    form.append("jobId", selectedJob.id);
    if (cvFile) form.append("cv", cvFile);
    if (coverLetterFile) form.append("coverLetter", coverLetterFile);
    try {
      const response = await fetch("/api/tailor", { method: "POST", body: form });
      const result = (await response.json()) as { feedback?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not review these documents.");
      setTailorFeedback(result.feedback ?? "");
    } catch (error) {
      setTailorError(error instanceof Error ? error.message : "Could not review these documents.");
    } finally {
      setTailoring(false);
    }
  }

  async function sendMessage(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    const message = (suggested ?? input).trim();
    if (!message || loading) return;
    setInput("");
    const nextMessages = [...messages, { role: "user" as const, content: message }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          model,
          history: messages.slice(-8).map(({ role, content }) => ({ role, content })),
        }),
      });
      const { answer, error, ...assistantMetadata } = (await response.json()) as ChatResponse;
      if (!response.ok) throw new Error(error || "The advisor could not respond.");
      setMessages((current) => [
        ...current,
        { role: "assistant", content: answer, ...assistantMetadata },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "The advisor could not respond.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function refreshKnowledge() {
    setNotice("Refreshing knowledge base…");
    try {
      const response = await fetch("/api/knowledge/refresh", { method: "POST" });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Refresh failed.");
      setNotice(data.message ?? "Knowledge base refreshed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Refresh failed.");
    }
    window.setTimeout(() => setNotice(""), 4_000);
  }

  function clearHistory() {
    setMessages([]);
    setShowHistory(false);
    window.localStorage.removeItem(historyStorageKey);
    window.localStorage.removeItem(legacyHistoryStorageKey);
  }

  const totalMessages = useMemo(() => messages.length, [messages]);
  const topCategory = useMemo(() => {
    const counts = jobs.reduce<Record<string, number>>((result, job) => {
      if (job.category) result[job.category] = (result[job.category] ?? 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [jobs]);
  const latestJob = useMemo(
    () =>
      [...jobs]
        .filter((job) => Number.isFinite(Date.parse(job.date)))
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0],
    [jobs],
  );
  const latestJobDate = latestJob ? new Date(latestJob.date) : undefined;
  const latestJobIsToday =
    latestJobDate?.toDateString() === new Date().toDateString();
  const topCategoryCount = topCategory
    ? jobs.filter((job) => job.category === topCategory).length
    : 0;
  const visibleJobs = categoryFilter
    ? jobs.filter((job) => job.category === categoryFilter)
    : jobs;
  const navigateTo = (sectionId: string, label: string) => {
    setActiveNav(label);
    setMobileMenu(false);
    if (sectionId === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  const openMarketFeed = () => {
    navigateTo("market-pulse", "Market explorer");
  };
  const selectJob = (job: Job | null) => {
    setSelectedJob(job);
    setCvFile(null);
    setCoverLetterFile(null);
    setTailorError("");
    setTailorFeedback("");
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <a className="brand" href="#overview" aria-label="SignalSpring home" onClick={() => navigateTo("top", "Overview")}>
          <span className="brand-mark"><TrendingUp size={19} strokeWidth={2.5} /></span>
          <span>signal<span>spring</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <button className={`nav-item ${activeNav === "Overview" ? "selected" : ""}`} onClick={() => navigateTo("top", "Overview")}><span className="nav-icon"><Command size={16} /></span> Overview</button>
        <button className={`nav-item ${activeNav === "Career paths" ? "selected" : ""}`} onClick={() => navigateTo("career-paths", "Career paths")}><span className="nav-icon"><Code2 size={16} /></span> Career paths</button>
        <button className={`nav-item ${activeNav === "Market explorer" ? "selected" : ""}`} onClick={openMarketFeed}><span className="nav-icon"><Globe2 size={16} /></span> Market explorer</button>
        <button className={`nav-item ${activeNav === "Learning plan" ? "selected" : ""}`} onClick={() => { navigateTo("advisor", "Learning plan"); sendMessage(undefined, "Create a 12-week learning roadmap for me."); }}><span className="nav-icon"><GraduationCap size={16} /></span> Learning plan</button>
        <div className="sidebar-divider" />
        <div className="workspace-label">YOUR ACTIVITY</div>
        <button className="nav-item" onClick={() => { setShowHistory(true); setMobileMenu(false); }}><span className="nav-icon"><MessageCircle size={16} /></span> Conversations <span className="nav-count">{totalMessages}</span></button>
        <button className="nav-item" onClick={() => void refreshKnowledge()}><span className="nav-icon"><RefreshCw size={15} /></span> Update knowledge</button>

        <div className="sidebar-bottom">
          <div className="sidebar-promo">
            <div className="promo-icon"><Sparkles size={16} /></div>
            <strong>Your next move,<br />made clearer.</strong>
            <span>Grounded in skills data and real job signals.</span>
            <button onClick={() => { navigateTo("advisor", "Overview"); sendMessage(undefined, "How should I start planning my tech career?"); }}>Meet your advisor <ArrowRight size={13} /></button>
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Toggle menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={19} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <b>{activeNav}</b></div>
          <div className="top-actions">
            <span className={`live-pill ${marketError ? "offline" : ""}`}><span />{jobsLoading ? "Loading tech roles" : marketError ? "Job sources unavailable" : fetchedAt ? `${snapshotSize} software & AI listings` : "Job snapshot not loaded"}</span>
            <button className="help-button" aria-label="Help" title="Ask the career advisor" onClick={() => navigateTo("advisor", "Overview")}><CircleHelp size={18} /></button>
          </div>
        </header>

        <div className="content" id="overview">
          <div className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> YOUR CAREER, IN CONTEXT</div>
              <h1>Make your next move<br className="desktop-break" /> <span>make sense.</span></h1>
              <p className="welcome-subtitle">A clearer path into tech starts with the right signals.</p>
            </div>
            <span className="date-button"><Clock3 size={14} />{fetchedAt ? `Updated ${new Date(fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Waiting for live data"}</span>
          </div>

          <div className="stats-grid">
            <button className="stat-card stat-card-action" type="button" onClick={openMarketFeed} aria-label="View matching job listings">
              <div className="stat-top"><span>SOFTWARE & AI ROLES</span><span className="stat-icon green"><BriefcaseBusiness size={16} /></span></div>
              <div className="stat-main">{jobsLoading ? "…" : fetchedAt ? totalJobCount : "—"}</div>
              <div className="stat-foot">{fetchedAt ? `${totalJobCount} roles matching “${marketSearch || "latest jobs"}”` : marketError ? "Source snapshot unavailable · click to retry" : "Waiting for current search results"}</div>
            </button>
            <button
              className={`stat-card stat-card-action ${categoryFilter === topCategory && topCategory ? "active" : ""}`}
              type="button"
              onClick={() => {
                if (topCategory) setCategoryFilter((current) => current === topCategory ? "" : topCategory);
                openMarketFeed();
              }}
              disabled={!topCategory}
              aria-pressed={Boolean(topCategory && categoryFilter === topCategory)}
              aria-label={topCategory ? `Filter listings by ${topCategory}` : "No live job categories available"}
            >
              <div className="stat-top"><span>MOST COMMON CATEGORY</span><span className="stat-icon lavender"><Code2 size={16} /></span></div>
              <div className="stat-main stat-text">{jobsLoading ? "…" : fetchedAt ? topCategory ?? "No category reported" : "—"}</div>
              <div className="stat-foot">{topCategory ? `${topCategoryCount} matches for “${marketSearch || "latest jobs"}” · click to view` : "Category will appear when the source reports one"}</div>
            </button>
            {latestJob ? (
              <button className="stat-card stat-card-action" type="button" onClick={() => { setCategoryFilter(""); selectJob(latestJob); openMarketFeed(); }}>
                <div className="stat-top"><span>LATEST TECH POSTING</span><span className="stat-icon peach"><Clock3 size={16} /></span></div>
                <div className="stat-main stat-text">{latestJobDate?.toLocaleDateString()}</div>
                <div className="stat-foot">{latestJobIsToday ? "Posted today" : "No newer software or AI role today"} · {latestJob.title} · {latestJob.source} · click to view</div>
              </button>
            ) : (
              <article className="stat-card">
                <div className="stat-top"><span>LATEST TECH POSTING</span><span className="stat-icon peach"><Clock3 size={16} /></span></div>
                <div className="stat-main stat-text">{jobsLoading ? "…" : "—"}</div>
                <div className="stat-foot">{fetchedAt ? "No valid posting date in search results" : "Updates after live results load"}</div>
              </article>
            )}
          </div>

          <section className="path-section" id="career-paths">
            <div className="section-heading">
              <div><div className="eyebrow small"><span className="eyebrow-line" /> CURATED LEARNING STARTERS</div><h2>Paths built for what’s next</h2></div>
              <button className="text-link" onClick={() => { navigateTo("advisor", "Career paths"); sendMessage(undefined, "Compare frontend, backend, and full-stack paths for an early-career developer."); }}>Explore all paths <ArrowRight size={15} /></button>
            </div>
            <div className="path-grid">
              <PathCard initials="UI" color="mint" title="Frontend developer" description="Plan a frontend learning track with the advisor." skills={["React", "TypeScript", "CSS"]} onClick={() => { navigateTo("advisor", "Career paths"); sendMessage(undefined, "Build me a 12-week frontend developer roadmap."); }} />
              <PathCard initials="</>" color="blue" title="Backend developer" description="Plan a backend learning track with the advisor." skills={["Node.js", "APIs", "SQL"]} onClick={() => { navigateTo("advisor", "Career paths"); sendMessage(undefined, "Build me a 12-week backend developer roadmap."); }} />
              <PathCard initials="✳" color="lav" title="Full-stack developer" description="Plan an end-to-end learning track with the advisor." skills={["React", "Node.js", "Postgres"]} onClick={() => { navigateTo("advisor", "Career paths"); sendMessage(undefined, "Build me a 12-week full-stack developer roadmap."); }} />
            </div>
          </section>

          <div className="lower-grid">
            <section className="market-card" id="market-pulse">
              <div className="market-header">
                <div><div className="eyebrow small"><span className="eyebrow-line" /> SOFTWARE & AI JOB FEED</div><h2>Fresh roles, real signals</h2></div>
                <button className="icon-action" aria-label="Refresh listings from all job sources" onClick={() => void refreshJobs(marketSearch)} disabled={jobsLoading}>{jobsLoading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={15} />}</button>
              </div>
              <p className="market-desc">Software, AI, data, and engineering roles gathered from Remotive, Jobicy, and Remote OK. Results are ranked against your search; eligibility is not the employer&apos;s location.</p>
              <form className="market-search" onSubmit={(event) => { event.preventDefault(); void refreshJobs(marketSearch); }}>
                <input aria-label="Search software and AI roles" placeholder="e.g. React, Python, machine learning" value={marketSearch} onChange={(event) => setMarketSearch(event.target.value)} maxLength={80} />
                <button type="submit" disabled={jobsLoading}>{jobsLoading ? "Searching…" : "Search roles"}</button>
              </form>
              {marketError && <div className="inline-error">{marketError}</div>}
              {sourceErrors.length > 0 && <div className="inline-error">Some sources could not be refreshed: {sourceErrors.join(" · ")}</div>}
              {categoryFilter && <div className="market-filter">Showing {categoryFilter} <button type="button" onClick={() => setCategoryFilter("")}>Clear filter</button></div>}
              <div className="job-list">
                {visibleJobs.length ? visibleJobs.map((job) => (
                  <article className="job-row" key={job.id}>
                    <span className="company-logo">{job.company.slice(0, 1).toUpperCase()}</span>
                    <span className="job-copy"><b>{job.title}</b><small>{job.company} · {job.source} · {job.date && Number.isFinite(Date.parse(job.date)) ? `Posted ${new Date(job.date).toLocaleDateString()} · ` : ""}Eligible: {job.eligibilityLocation || "Not provided"}</small></span>
                    <span className="job-actions">
                      <button type="button" className="job-details-button" onClick={() => selectJob(job)}>{selectedJob?.id === job.id ? "Selected" : "Details & CV review"}</button>
                      <a className="job-salary" href={job.url} target="_blank" rel="noreferrer" aria-label={`Open ${job.title} at ${job.company}`}><ExternalLink size={14} /></a>
                    </span>
                  </article>
                )) : <div className="empty-market"><div>{jobsLoading ? <><LoaderCircle className="spin" size={17} /> Fetching current public listings…</> : marketError ? <><BriefcaseBusiness size={18} />Live listings could not be loaded.</> : categoryFilter ? <><BriefcaseBusiness size={18} />No results in this category.</> : fetchedAt ? <><BriefcaseBusiness size={18} />No live listings matched this search.</> : <><BriefcaseBusiness size={18} />Search the live public jobs feed.</>}</div></div>}
              </div>
              {selectedJob && <section key={selectedJob.id} className="job-detail" aria-label="Selected job details">
                <div className="job-detail-heading">
                  <div><span className="eyebrow small"><span className="eyebrow-line" /> SOURCE LISTING</span><h3>{selectedJob.title} · {selectedJob.company}</h3></div>
                  <button type="button" className="icon-action" aria-label="Close selected job" onClick={() => selectJob(null)}><X size={16} /></button>
                </div>
                <dl className="job-facts">
                  <div><dt>Employer location</dt><dd>{selectedJob.employerLocation || "Not provided by source"}</dd></div>
                  <div><dt>Hiring eligibility</dt><dd>{selectedJob.eligibilityLocation || "Not provided by source"}</dd></div>
                  <div><dt>Posted</dt><dd>{Number.isFinite(Date.parse(selectedJob.date)) ? new Date(selectedJob.date).toLocaleDateString() : "Not provided by source"}</dd></div>
                  <div><dt>Salary</dt><dd>{selectedJob.salary || "Not provided by source"}</dd></div>
                  <div><dt>Job type</dt><dd>{selectedJob.jobType || "Not provided by source"}</dd></div>
                  <div><dt>Applicants</dt><dd>Count not provided by source</dd></div>
                  <div><dt>Employment terms</dt><dd>Formal contract terms not provided; verify with employer</dd></div>
                </dl>
                <div className="job-tags">{selectedJob.tags.length ? selectedJob.tags.map((tag) => <span key={tag}>{tag}</span>) : <span>Tags not provided by source</span>}</div>
                <h4>Requirements and description from the listing</h4>
                <pre className="job-description">{selectedJob.description ? selectedJob.description.slice(0, 8_000) : "Description not provided by source. See the original listing for current details."}</pre>
                <a className="original-job-link" href={selectedJob.url} target="_blank" rel="noreferrer">Open original company listing <ArrowUpRight size={14} /></a>
                <form className="tailor-form" onSubmit={(event) => void reviewDocuments(event)}>
                  <h4>Get job-specific CV feedback</h4>
                  <p>Upload a CV, cover letter, or both. PDF, DOCX, and TXT files up to 5 MB each.</p>
                  <label>CV <input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => { setCvFile(event.target.files?.[0] ?? null); setTailorFeedback(""); setTailorError(""); }} /></label>
                  <label>Cover letter <input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => { setCoverLetterFile(event.target.files?.[0] ?? null); setTailorFeedback(""); setTailorError(""); }} /></label>
                  <div className="document-privacy">Files are processed in memory for this request and are not saved by SignalSpring. Their text is sent to OpenAI for feedback.</div>
                  {tailorError && <div className="inline-error">{tailorError}</div>}
                  <button className="tailor-submit" type="submit" disabled={tailoring || (!cvFile && !coverLetterFile)}>{tailoring ? "Reviewing documents…" : "Review against this job"}</button>
                  {tailorFeedback && <div className="tailor-feedback"><h4>Feedback for {selectedJob.company}</h4><div>{tailorFeedback}</div></div>}
                </form>
              </section>}
              <div className="market-footer"><span>Sources: <a href="https://remotive.com/" target="_blank" rel="noreferrer">Remotive</a> · <a href="https://jobicy.com/" target="_blank" rel="noreferrer">Jobicy</a> · <a href="https://remoteok.com/" target="_blank" rel="noreferrer">Remote OK</a>{fetchedAt ? ` · checked ${new Date(fetchedAt).toLocaleString()}` : ""}</span><span>{fetchedAt ? `${jobs.length} of ${totalJobCount} matches` : "Loading job listings"}</span></div>
            </section>

            <section className="advisor-card" id="advisor">
              <div className="advisor-heading">
                <span className="advisor-icon"><Sparkles size={17} /></span>
                <div><h2>Your career advisor</h2><span className="online-status"><i /> Here to help you figure it out</span></div>
              </div>
              <div className="chat-content">
                {!messages.length ? (
                  <div className="empty-chat">Your messages will appear here after you start a conversation.</div>
                ) : (
                  <div className="messages">
                    {messages.slice(-8).map((message, index) => (
                      <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                        {message.role === "assistant" && <div className="assistant-avatar tiny"><Sparkles size={13} /></div>}
                        <div className="message-body">
                          <div className="message-bubble">{message.content}</div>
                          {message.role === "assistant" && message.demoMode && <div className="demo-note"><CircleHelp size={12} /> Demo mode · add an OpenAI key for personalized AI responses.</div>}
                          {message.role === "assistant" && message.retrieval && <div className="retrieval-chip"><Filter size={11} /> {message.retrieval.mode} retrieval{message.retrieval.plan?.topic ? ` · ${message.retrieval.plan.topic}` : ""}{message.retrieval.plan?.location ? ` · ${message.retrieval.plan.location}` : ""}{message.retrieval.warning ? " · embeddings unavailable" : ""}</div>}
                          {message.role === "assistant" && message.retrieval?.plan?.topic && <div className="retrieval-chip">Translated search: {message.retrieval.plan.translatedQuery}</div>}
                          {message.role === "assistant" && message.usage && <div className="retrieval-chip"><TrendingUp size={11} /> {message.usage.inputTokens + message.usage.outputTokens} tokens · estimated ${message.usage.estimatedCostUsd.toFixed(5)}</div>}
                          {message.role === "assistant" && message.security?.injectionPatternDetected && <div className="demo-note"><ShieldCheck size={12} /> An instruction-like pattern was safely ignored.</div>}
                          {message.role === "assistant" && message.sources?.length ? <div className="source-list"><b><FileText size={12} /> SOURCES</b>{message.sources.slice(0, 3).map((source, sourceIndex) => <a href={source.url} target="_blank" rel="noreferrer" key={`${source.id}-${sourceIndex}`}>[{sourceIndex + 1}] {source.title}<ExternalLink size={11} /></a>)}</div> : null}
                          {message.role === "assistant" && message.tools?.length ? <div className="tool-results">{message.tools.map((tool) => <ToolCard tool={tool} key={tool.name} />)}</div> : null}
                        </div>
                      </div>
                    ))}
                    {loading && <div className="message assistant"><div className="assistant-avatar tiny"><Sparkles size={13} /></div><div className="typing"><i /><i /><i /> <span>Thinking through your question…</span></div></div>}
                    <div ref={chatEnd} />
                  </div>
                )}
              </div>
              <form className="chat-form" onSubmit={(event) => void sendMessage(event)}>
                <input aria-label="Ask your career advisor" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about skills, roles, or your next step…" maxLength={2_000} />
                <button className="send-button" aria-label="Send message" disabled={!input.trim() || loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <Send size={15} />}</button>
              </form>
              <div className="chat-meta"><span><ShieldCheck size={12} /> Your career, your data</span><div className="model-picker"><span>Model</span><select aria-label="Select AI model" value={model} onChange={(event) => setModel(event.target.value)}>{models.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select><ChevronDown size={11} /></div></div>
            </section>
          </div>

          <div className="disclaimer"><ShieldCheck size={13} /> Salary and housing benchmarks are not displayed because no verified live regional data source is connected. Job listings come from Remotive, Jobicy, and Remote OK and may change; confirm details with the original posting.</div>
          <footer><span>© {new Date().getFullYear()} SignalSpring</span><span><a href="https://www.weforum.org/publications/the-future-of-jobs-report-2025/" target="_blank" rel="noreferrer">Data sources</a><span className="footer-dot">·</span><button onClick={() => void refreshKnowledge()}>Knowledge base</button><span className="footer-dot">·</span><button onClick={() => setShowHistory(true)}>Conversation history</button></span></footer>
        </div>
      </section>

      {notice && <div className="toast"><Check size={14} /> {notice}</div>}
      {showHistory && <div className="modal-backdrop" onClick={() => setShowHistory(false)}><section className="history-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow small"><span className="eyebrow-line" /> YOUR ACTIVITY</span><h2>Conversation history</h2></div><button className="icon-action" onClick={() => setShowHistory(false)} aria-label="Close"><X size={18} /></button></div><p>Your recent conversation is saved on this device only.</p><div className="history-actions"><button className="clear-button" onClick={clearHistory}>Clear history</button></div><div className="history-list">{messages.length ? messages.slice(-12).map((item, index) => <div key={index} className={`history-item ${item.role}`}><span>{item.role === "user" ? "YOU" : "ADVISOR"}</span><p>{item.content}</p></div>) : <div className="empty-history">Your conversation will appear here.</div>}</div></section></div>}
      {mobileMenu && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}
    </main>
  );
}

function PathCard({ initials, color, title, description, skills, onClick }: { initials: string; color: string; title: string; description: string; skills: string[]; onClick: () => void }) {
  return <button className="path-card" onClick={onClick}>
    <div className="path-card-top"><span className={`path-icon ${color}`}>{initials}</span><ArrowUpRight size={16} className="bookmark-icon" /></div>
    <h3>{title}</h3><p>{description}</p>
    <div className="path-meta"><span>Suggested starting skills</span></div>
    <div className="path-card-bottom"><span>{skills.map((skill) => <i key={skill}>{skill}</i>)}</span><span className="path-arrow"><ArrowRight size={15} /></span></div>
  </button>;
}

function ToolCard({ tool }: { tool: ToolResult }) {
  const result = tool.result;
  return <div className="tool-card"><div className="tool-card-head"><span className="tool-card-icon"><GraduationCap size={13} /></span><b>{tool.label}</b><Check size={13} className="tool-check" /></div><div className="tool-card-content">
    <div><span>{String(result.track)} · {String(result.hoursPerWeek)} hrs / wk</span><b>{String(result.estimatedTotalHours)} hours total</b></div>
    {Array.isArray(result.weeks) && result.weeks.map((week, index) => Array.isArray(week) ? <div key={index}><span>{String(week[0])}</span><b>{String(week[1])}</b></div> : null)}
  </div></div>;
}
