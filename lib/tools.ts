import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { cities, type City } from "@/lib/knowledge";

export type ToolResult = {
  name: string;
  label: string;
  result: Record<string, unknown>;
};

const citySchema = z.enum(["New York", "London", "Nairobi"]);

const salaryPathTool = new DynamicStructuredTool({
    name: "salary_path",
    description:
      "Estimate a junior developer salary band, monthly take-home after a simple 20% planning deduction, and income growth over a selected career horizon for a city.",
    schema: z.object({
      city: citySchema,
      years: z.number().int().min(1).max(10).default(3),
    }),
    func: async ({ city, years }) => {
      const estimate = cities[city as City];
      const midpoint = (estimate.salaryMin + estimate.salaryMax) / 2;
      const growth = 1 + Math.min(years, 10) * 0.08;
      return JSON.stringify({
        city,
        currency: estimate.currency,
        entryLevelGrossAnnual: [estimate.salaryMin, estimate.salaryMax],
        estimatedMonthlyNetAtMidpoint: Math.round((midpoint * 0.8) / 12),
        estimatedGrossAfterYears: years,
        estimatedGrossAnnualAfterYears: Math.round(midpoint * growth),
        assumption:
          "Illustrative planning estimate only; 20% deduction and 8% annual growth are simplified assumptions, not tax or wage advice.",
      });
    },
  });
const housingAffordabilityTool = new DynamicStructuredTool({
    name: "housing_affordability",
    description:
      "Compare the city's illustrative monthly rent with estimated entry-level monthly take-home pay and calculate a rent-to-net-income ratio.",
    schema: z.object({ city: citySchema }),
    func: async ({ city }) => {
      const estimate = cities[city as City];
      const midpoint = (estimate.salaryMin + estimate.salaryMax) / 2;
      const monthlyNet = (midpoint * 0.8) / 12;
      const ratio = (estimate.rent / monthlyNet) * 100;
      return JSON.stringify({
        city,
        currency: estimate.currency,
        estimatedMonthlyRent: estimate.rent,
        estimatedMonthlyNetAtSalaryMidpoint: Math.round(monthlyNet),
        estimatedRentToNetIncomePercent: Number(ratio.toFixed(1)),
        note:
          "Illustrative defaults, not live housing data. A ratio above 30% is a commonly used budgeting flag, not a universal rule.",
      });
    },
  });
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

export const careerTools = [
  salaryPathTool,
  housingAffordabilityTool,
  learningRoadmapTool,
];

export async function invokeCareerTool(name: string, args: unknown) {
  switch (name) {
    case "salary_path":
      return salaryPathTool.invoke(salaryPathTool.schema.parse(args));
    case "housing_affordability":
      return housingAffordabilityTool.invoke(housingAffordabilityTool.schema.parse(args));
    case "learning_roadmap":
      return learningRoadmapTool.invoke(learningRoadmapTool.schema.parse(args));
    default:
      throw new Error(`Unknown career tool: ${name}`);
  }
}

export const toolLabels: Record<string, string> = {
  salary_path: "Salary growth estimate",
  housing_affordability: "Housing affordability",
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
