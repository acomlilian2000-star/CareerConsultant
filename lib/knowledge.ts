export type KnowledgeSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  updated: string;
  topics: ("skills" | "salary" | "jobs" | "learning" | "portfolio")[];
  locations: string[];
  text: string;
};

export const knowledgeBase: KnowledgeSource[] = [
  {
    id: "wef-skills",
    title: "Future of Jobs Report 2025",
    publisher: "World Economic Forum",
    url: "https://www.weforum.org/publications/the-future-of-jobs-report-2025/",
    updated: "January 2025",
    topics: ["skills"],
    locations: ["global"],
    text:
      "The World Economic Forum's Future of Jobs Report 2025 surveys employers about expected job and skill changes through 2030. It identifies AI and big data, networks and cybersecurity, and technological literacy among the fastest-growing skills. Analytical thinking remains a leading core skill. Treat these as global employer expectations, not a guarantee of local entry-level vacancies. Developers can translate them into practical projects: data-informed applications, secure authentication, and clear technical documentation.",
  },
  {
    id: "bls-outlook",
    title: "Software Developers, Quality Assurance Analysts, and Testers",
    publisher: "U.S. Bureau of Labor Statistics",
    url: "https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm",
    updated: "Occupational Outlook Handbook",
    topics: ["salary", "jobs"],
    locations: ["United States"],
    text:
      "The U.S. Bureau of Labor Statistics publishes employment outlook and wage information for software developers, quality assurance analysts, and testers. Its figures describe the United States and broad occupational groups; they are not a substitute for city-specific junior job listings. Compare the latest BLS figures with current local postings, required experience, and local living costs before making a career or relocation decision.",
  },
  {
    id: "remotive",
    title: "Remote software job listings",
    publisher: "Remotive public jobs API",
    url: "https://remotive.com/remote-jobs",
    updated: "Cached for up to 24 hours",
    topics: ["jobs"],
    locations: ["remote"],
    text:
      "MarketPulse loads up to 10 public remote job listings from Remotive into a server-side snapshot cached for up to 24 hours; searches rank that snapshot locally. Listings are remote-first and are not a representative sample of a particular city's entire job market. Candidate eligibility is not necessarily the employer's location. Remotive says listings may be delayed by up to 24 hours, and its feed does not provide applicant counts or formal employment terms. Job titles, descriptions, and salary information may be incomplete or change after retrieval. Always check the original listing before applying.",
  },
  {
    id: "roadmap",
    title: "Entry-level learning tracks",
    publisher: "MarketPulse curriculum guide",
    url: "https://roadmap.sh/",
    updated: "Reviewed June 2025",
    topics: ["learning"],
    locations: ["global"],
    text:
      "A job-ready frontend track commonly combines HTML and CSS fundamentals, JavaScript and TypeScript, React, accessible responsive UI, API integration, testing, Git, and a deployed portfolio project. A backend track can combine JavaScript or Python, HTTP and REST APIs, a relational database, authentication and secure input handling, automated tests, Docker basics, and a documented project. Prioritize skills that recur in several local entry-level job descriptions rather than collecting frameworks.",
  },
  {
    id: "portfolio",
    title: "Portfolio evidence for junior developers",
    publisher: "MarketPulse curriculum guide",
    url: "https://roadmap.sh/",
    updated: "Reviewed June 2025",
    topics: ["portfolio"],
    locations: ["global"],
    text:
      "A strong junior portfolio shows two or three finished projects with a live demo, readable source code, a concise README, screenshots, tests, and a short explanation of trade-offs. Make one project relevant to the target market: for example an accessible React dashboard, a tested Node or Python API, or a full-stack application with a relational database. A smaller polished project is more persuasive than a long list of unfinished tutorials.",
  },
];
