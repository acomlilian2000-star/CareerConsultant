"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Code2,
  Command,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Globe2,
  GraduationCap,
  LoaderCircle,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  url: string;
  date: string;
  category: string;
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
const sampleQuestions = [
  "Build me a 12-week frontend roadmap",
  "Compare junior salary and rent in London",
  "What skills are growing in tech?",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(models[0].id);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [fetchedAt, setFetchedAt] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [activeNav, setActiveNav] = useState("Overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  useEffect(() => {
    const saved = window.localStorage.getItem("marketpulse-history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed)) setMessages(parsed.slice(-30));
      } catch {
        window.localStorage.removeItem("marketpulse-history");
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("marketpulse-history", JSON.stringify(messages.slice(-30)));
  }, [messages]);

  const refreshJobs = useCallback(async () => {
    setJobsLoading(true);
    setMarketError("");
    try {
      const response = await fetch("/api/market?search=software%20developer");
      const result = (await response.json()) as { jobs?: Job[]; fetchedAt?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not refresh jobs.");
      setJobs(result.jobs ?? []);
      setFetchedAt(result.fetchedAt ?? "");
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "Could not refresh jobs.");
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

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
    window.localStorage.removeItem("marketpulse-history");
  }

  function exportConversation(format: "json" | "csv") {
    const content =
      format === "json"
        ? JSON.stringify(messages, null, 2)
        : ["role,content", ...messages.map((item) => `${item.role},"${item.content.replaceAll('"', '""')}"`)].join("\n");
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `marketpulse-conversation.${format}`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const totalMessages = useMemo(() => messages.length, [messages]);

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" aria-label="MarketPulse home">
          <span className="brand-mark"><TrendingUp size={19} strokeWidth={2.5} /></span>
          <span>market<span>pulse</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <button className={`nav-item ${activeNav === "Overview" ? "selected" : ""}`} onClick={() => setActiveNav("Overview")}><span className="nav-icon"><Command size={16} /></span> Overview</button>
        <button className={`nav-item ${activeNav === "Career paths" ? "selected" : ""}`} onClick={() => setActiveNav("Career paths")}><span className="nav-icon"><Code2 size={16} /></span> Career paths <span className="nav-count">4</span></button>
        <button className={`nav-item ${activeNav === "Market explorer" ? "selected" : ""}`} onClick={() => { setActiveNav("Market explorer"); refreshJobs(); }}><span className="nav-icon"><Globe2 size={16} /></span> Market explorer</button>
        <button className={`nav-item ${activeNav === "Learning plan" ? "selected" : ""}`} onClick={() => { setActiveNav("Learning plan"); sendMessage(undefined, "Create a 12-week learning roadmap for me."); }}><span className="nav-icon"><GraduationCap size={16} /></span> Learning plan</button>
        <div className="sidebar-divider" />
        <div className="workspace-label">YOUR ACTIVITY</div>
        <button className="nav-item" onClick={() => setShowHistory(true)}><span className="nav-icon"><MessageCircle size={16} /></span> Conversations <span className="nav-count">{totalMessages}</span></button>
        <button className="nav-item" onClick={() => void refreshKnowledge()}><span className="nav-icon"><RefreshCw size={15} /></span> Update knowledge</button>

        <div className="sidebar-bottom">
          <div className="sidebar-promo">
            <div className="promo-icon"><Sparkles size={16} /></div>
            <strong>Your next move,<br />made clearer.</strong>
            <span>Grounded in skills data and real job signals.</span>
            <button onClick={() => sendMessage(undefined, "How should I start planning my tech career?")}>Meet your advisor <ArrowRight size={13} /></button>
          </div>
          <button className="profile-button"><span className="avatar">JD</span><span className="profile-copy"><b>Jordan Davis</b><small>Career explorer</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Toggle menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={19} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <b>{activeNav}</b></div>
          <div className="top-actions">
            <span className="live-pill"><span /> Market signals active</span>
            <button className="help-button" aria-label="Help" title="Ask the career advisor"><CircleHelp size={18} /></button>
            <span className="top-avatar">JD</span>
          </div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> YOUR CAREER, IN CONTEXT</div>
              <h1>Make your next move<br className="desktop-break" /> <span>make sense.</span></h1>
              <p className="welcome-subtitle">A clearer path into tech starts with the right signals.</p>
            </div>
            <button className="date-button"><Clock3 size={14} /> Updated today <ChevronDown size={14} /></button>
          </div>

          <div className="stats-grid">
            <article className="stat-card">
              <div className="stat-top"><span>SKILLS ON THE RISE</span><span className="stat-icon green"><TrendingUp size={16} /></span></div>
              <div className="stat-main">AI &amp; data <span className="stat-growth">Fastest growing</span></div>
              <div className="stat-foot">Demand signal · global employer survey</div>
              <div className="mini-bars" aria-label="Illustrative trend visualization"><i style={{ height: "34%" }} /><i style={{ height: "50%" }} /><i style={{ height: "43%" }} /><i style={{ height: "68%" }} /><i style={{ height: "63%" }} /><i style={{ height: "83%" }} /><i style={{ height: "100%" }} /></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>JUNIOR DEV. RANGE</span><span className="stat-icon lavender"><Wallet size={16} /></span></div>
              <div className="stat-main">$55k <span className="stat-muted">— $80k</span></div>
              <div className="stat-foot">Example estimate · New York · USD / year</div>
              <div className="range-track"><i /></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>YOUR STARTING POINT</span><span className="stat-icon peach"><MapPin size={16} /></span></div>
              <div className="stat-main">New York <ChevronDown size={15} className="inline-chevron" /></div>
              <div className="stat-foot">Remote-friendly roles included</div>
              <div className="location-foot"><span className="location-dot" /> Local context, not just averages</div>
            </article>
          </div>

          <section className="path-section">
            <div className="section-heading">
              <div><div className="eyebrow small"><span className="eyebrow-line" /> FIND YOUR DIRECTION</div><h2>Paths built for what’s next</h2></div>
              <button className="text-link" onClick={() => { setActiveNav("Career paths"); sendMessage(undefined, "Compare frontend, backend, and full-stack paths for an early-career developer."); }}>Explore all paths <ArrowRight size={15} /></button>
            </div>
            <div className="path-grid">
              <PathCard initials="UI" color="mint" title="Frontend developer" description="Build experiences people love to use." salary="$55k – $80k" progress={64} skills={["React", "TypeScript", "CSS"]} onClick={() => sendMessage(undefined, "Build me a 12-week frontend developer roadmap.")} />
              <PathCard initials="</>" color="blue" title="Backend developer" description="Power the systems behind the scenes." salary="$60k – $88k" progress={48} skills={["Node.js", "APIs", "SQL"]} onClick={() => sendMessage(undefined, "Build me a 12-week backend developer roadmap.")} />
              <PathCard initials="✳" color="lav" title="Full-stack developer" description="Connect the whole product, end to end." salary="$62k – $92k" progress={32} skills={["React", "Node.js", "Postgres"]} onClick={() => sendMessage(undefined, "Build me a 12-week full-stack developer roadmap.")} />
            </div>
          </section>

          <div className="lower-grid">
            <section className="market-card">
              <div className="market-header">
                <div><div className="eyebrow small"><span className="eyebrow-line" /> LIVE MARKET PULSE</div><h2>Fresh roles, real signals</h2></div>
                <button className="icon-action" aria-label="Refresh market listings" onClick={() => void refreshJobs()} disabled={jobsLoading}>{jobsLoading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={15} />}</button>
              </div>
              <p className="market-desc">A snapshot of remote software roles to ground your next step.</p>
              {marketError && <div className="inline-error">{marketError}</div>}
              <div className="job-list">
                {jobs.length ? jobs.slice(0, 3).map((job) => (
                  <a className="job-row" href={job.url} target="_blank" rel="noreferrer" key={job.id}>
                    <span className="company-logo">{job.company.slice(0, 1).toUpperCase()}</span>
                    <span className="job-copy"><b>{job.title}</b><small>{job.company} · {job.location}</small></span>
                    <span className="job-salary">{job.salary}<ArrowUpRight size={12} /></span>
                  </a>
                )) : <div className="empty-market"><div>{jobsLoading ? <><LoaderCircle className="spin" size={17} /> Fetching current public listings…</> : <><BriefcaseBusiness size={18} />No current listings loaded.<br />Refresh to check the public jobs feed.</>}</div></div>}
              </div>
              <div className="market-footer"><span>{fetchedAt ? `Updated ${new Date(fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Remotive` : "Example roles · refresh for current public listings"}</span><button onClick={() => void refreshJobs()}>Refresh data <ArrowRight size={13} /></button></div>
            </section>

            <section className="advisor-card" id="advisor">
              <div className="advisor-heading">
                <span className="advisor-icon"><Sparkles size={17} /></span>
                <div><h2>Your career advisor</h2><span className="online-status"><i /> Here to help you figure it out</span></div>
                <button className="more-button" title="Export conversation" onClick={() => exportConversation("json")}><Download size={16} /></button>
              </div>
              <div className="chat-content">
                {!messages.length ? (
                  <div className="welcome-message">
                    <div className="assistant-avatar"><Sparkles size={16} /></div>
                    <div className="assistant-bubble"><b>Hey Jordan! 👋</b><p>I’m here to help you find a path that fits your strengths and the market. What are you curious about?</p></div>
                    <div className="suggestion-list">{sampleQuestions.map((question) => <button key={question} onClick={() => void sendMessage(undefined, question)}>{question}<ArrowUpRight size={13} /></button>)}</div>
                  </div>
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

          <div className="disclaimer"><ShieldCheck size={13} /> Salary and housing figures are illustrative planning estimates, not live wage or cost-of-living data. Always verify sources before making career or relocation decisions.</div>
          <footer><span>© 2025 MarketPulse</span><span><a href="https://www.weforum.org/publications/the-future-of-jobs-report-2025/" target="_blank" rel="noreferrer">Data sources</a><span className="footer-dot">·</span><button onClick={() => void refreshKnowledge()}>Knowledge base</button><span className="footer-dot">·</span><button onClick={() => setShowHistory(true)}>Export &amp; history</button></span></footer>
        </div>
      </section>

      {notice && <div className="toast"><Check size={14} /> {notice}</div>}
      {showHistory && <div className="modal-backdrop" onClick={() => setShowHistory(false)}><section className="history-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow small"><span className="eyebrow-line" /> YOUR ACTIVITY</span><h2>Conversation history</h2></div><button className="icon-action" onClick={() => setShowHistory(false)} aria-label="Close"><X size={18} /></button></div><p>Your recent conversation is saved on this device only.</p><div className="history-actions"><button onClick={() => exportConversation("json")}><Download size={15} /> Export JSON</button><button onClick={() => exportConversation("csv")}><Download size={15} /> Export CSV</button><button className="clear-button" onClick={clearHistory}>Clear history</button></div><div className="history-list">{messages.length ? messages.slice(-12).map((item, index) => <div key={index} className={`history-item ${item.role}`}><span>{item.role === "user" ? "YOU" : "ADVISOR"}</span><p>{item.content}</p></div>) : <div className="empty-history">Your conversation will appear here.</div>}</div></section></div>}
      {mobileMenu && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}
    </main>
  );
}

function PathCard({ initials, color, title, description, salary, progress, skills, onClick }: { initials: string; color: string; title: string; description: string; salary: string; progress: number; skills: string[]; onClick: () => void }) {
  return <button className="path-card" onClick={onClick}>
    <div className="path-card-top"><span className={`path-icon ${color}`}>{initials}</span><Bookmark size={16} className="bookmark-icon" /></div>
    <h3>{title}</h3><p>{description}</p>
    <div className="path-meta"><span>Example salary range</span><b>{salary}<small> / yr</small></b></div>
    <div className="path-progress"><span style={{ width: `${progress}%` }} /></div>
    <div className="path-card-bottom"><span>{skills.map((skill) => <i key={skill}>{skill}</i>)}</span><span className="path-arrow"><ArrowRight size={15} /></span></div>
  </button>;
}

function ToolCard({ tool }: { tool: ToolResult }) {
  const result = tool.result;
  return <div className="tool-card"><div className="tool-card-head"><span className="tool-card-icon"><Wallet size={13} /></span><b>{tool.label}</b><Check size={13} className="tool-check" /></div><div className="tool-card-content">
    {tool.name === "salary_path" ? <><div><span>Entry-level annual</span><b>{formatRange(result.entryLevelGrossAnnual, result.currency)}</b></div><div><span>Est. monthly net</span><b>{formatMoney(result.estimatedMonthlyNetAtMidpoint, result.currency)}</b></div><div><span>After {String(result.estimatedGrossAfterYears)} years</span><b>{formatMoney(result.estimatedGrossAnnualAfterYears, result.currency)} / yr</b></div></> : tool.name === "housing_affordability" ? <><div><span>Example monthly rent</span><b>{formatMoney(result.estimatedMonthlyRent, result.currency)}</b></div><div><span>Est. rent / take-home</span><b>{String(result.estimatedRentToNetIncomePercent)}%</b></div><small>{String(result.note)}</small></> : <><div><span>{String(result.track)} · {String(result.hoursPerWeek)} hrs / wk</span><b>{String(result.estimatedTotalHours)} hours total</b></div>{Array.isArray(result.weeks) && result.weeks.map((week, index) => Array.isArray(week) ? <div key={index}><span>{String(week[0])}</span><b>{String(week[1])}</b></div> : null)}</>}
    {tool.name === "salary_path" && <small>{String(result.assumption)}</small>}
  </div></div>;
}

function formatMoney(value: unknown, currency: unknown) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: typeof currency === "string" ? currency : "USD", maximumFractionDigits: 0 }).format(value);
}

function formatRange(value: unknown, currency: unknown) {
  if (!Array.isArray(value) || value.length !== 2) return "—";
  return `${formatMoney(value[0], currency)} – ${formatMoney(value[1], currency)}`;
}
