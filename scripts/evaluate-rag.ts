import { retrieveKnowledge } from "../lib/rag";

const cases = [
  { query: "What skills should a frontend developer learn?", expected: "roadmap" },
  { query: "How can I compare junior pay and rent?", expected: "marketpulse-estimates" },
  { query: "What does the World Economic Forum say about emerging skills?", expected: "wef-skills" },
  { query: "Where can I find remote software listings?", expected: "remotive" },
];

let passed = 0;
for (const testCase of cases) {
  const result = await retrieveKnowledge(testCase.query, 3);
  const hit = result.results.some((item) => item.id === testCase.expected);
  if (hit) passed++;
  console.log(
    `${hit ? "PASS" : "FAIL"} ${JSON.stringify(testCase.query)} -> ${result.results
      .map((item) => item.id)
      .join(", ")}`,
  );
}
console.log(`Recall@3: ${passed}/${cases.length} (${Math.round((passed / cases.length) * 100)}%)`);
if (passed < cases.length) process.exitCode = 1;
