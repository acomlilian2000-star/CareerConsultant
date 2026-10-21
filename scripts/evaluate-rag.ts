import { retrieveKnowledge, translateCareerQuery } from "../lib/rag";

const cases = [
  { query: "What skills should a frontend developer learn?", expected: "roadmap" },
  { query: "How can I compare junior pay and rent?", expected: "bls-outlook" },
  { query: "What does the World Economic Forum say about emerging skills?", expected: "wef-skills" },
  { query: "Where can I find remote software listings?", expected: "jobicy" },
  { query: "Compare junior pay in the United States", expected: "bls-outlook", topic: "salary", location: "United States" },
  { query: "Build me a 12-week frontend roadmap", expected: "roadmap", topic: "learning" },
];

async function main() {
  let passed = 0;
  for (const testCase of cases) {
    const result = await retrieveKnowledge(testCase.query, 3);
    const hit = result.results.some((item) => item.id === testCase.expected);
    const plan = translateCareerQuery(testCase.query);
    const metadataMatches =
      (!testCase.topic || plan.topic === testCase.topic) &&
      (!testCase.location || plan.location === testCase.location);
    if (hit && metadataMatches) passed++;
    console.log(
      `${hit && metadataMatches ? "PASS" : "FAIL"} ${JSON.stringify(testCase.query)} -> ${result.results
        .map((item) => item.id)
        .join(", ")} [${plan.topic ?? "general"}${plan.location ? ` · ${plan.location}` : ""}]`,
    );
  }
  console.log(`Recall@3: ${passed}/${cases.length} (${Math.round((passed / cases.length) * 100)}%)`);
  if (passed < cases.length) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error("RAG evaluation failed:", error);
  process.exitCode = 1;
});
