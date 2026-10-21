import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export type ToolResult = {
  name: string;
  label: string;
  result: Record<string, unknown>;
};

const learningRoadmapTool = new DynamicStructuredTool({
    name: "learning_roadmap",
    description:
      "Create a practical, staged 12-week learning roadmap for frontend, backend, or full-stack software developer goals.",
    schema: z.object({
      track: z.enum(["frontend", "backend", "full-stack"]),
      hoursPerWeek: z.number().int().min(2).max(40).default(8),
    }),
    func: async ({ track, hoursPerWeek }) => {
      const plans = {
        frontend: [
          ["Weeks 1–3", "TypeScript, semantic HTML, responsive CSS, accessibility"],
          ["Weeks 4–6", "React fundamentals, component state, forms, API integration"],
          ["Weeks 7–9", "Testing, performance, error states, a polished dashboard project"],
          ["Weeks 10–12", "Deploy, document, review local job descriptions, prepare interviews"],
        ],
        backend: [
          ["Weeks 1–3", "TypeScript or Python, HTTP, REST API design, Git"],
          ["Weeks 4–6", "SQL, relational modeling, validation, authentication fundamentals"],
          ["Weeks 7–9", "Automated tests, API security, logging, a documented service"],
          ["Weeks 10–12", "Deploy, Docker basics, portfolio polish, practice interviews"],
        ],
        "full-stack": [
          ["Weeks 1–3", "TypeScript, HTML/CSS, React fundamentals, Git"],
          ["Weeks 4–6", "REST APIs, Node.js, SQL schema design"],
          ["Weeks 7–9", "Connect UI and API, validation, authentication, end-to-end tests"],
          ["Weeks 10–12", "Deploy one complete app, document trade-offs, practice interviews"],
        ],
      };
      return JSON.stringify({
        track,
        hoursPerWeek,
        estimatedTotalHours: hoursPerWeek * 12,
        weeks: plans[track],
        project:
          "Build one accessible, tested, deployed project that solves a real problem and includes a clear README.",
      });
    },
  });

export const careerTools = [learningRoadmapTool];

export async function invokeCareerTool(name: string, args: unknown) {
  switch (name) {
    case "learning_roadmap":
      return learningRoadmapTool.invoke(learningRoadmapTool.schema.parse(args));
    default:
      throw new Error(`Unknown career tool: ${name}`);
  }
}

export const toolLabels: Record<string, string> = {
  learning_roadmap: "12-week learning roadmap",
};

export function asToolResult(name: string, result: string): ToolResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(result) as Record<string, unknown>;
  } catch {
    parsed = { detail: result };
  }
  return { name, label: toolLabels[name] ?? name, result: parsed };
}
