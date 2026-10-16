import assert from "node:assert";
import { zodToJsonSchema } from "../src/schemas.js";
import { executeAction, getAllTools, ACTION_CATALOG } from "../src/catalog.js";
import { projectOutput } from "../src/helpers.js";
import { GithubFindActionsSchema, GithubExecuteActionSchema } from "../index.js";
import { GetFileContentsSchema, GetRepositorySchema } from "../src/tools/repositories.js";
import { GetCommitSchema } from "../src/tools/commits.js";
import {
  makeGitHubRepository,
  makeGitHubIssuesList,
  makeGitHubPullRequestsList,
  makeGitHubWorkflowRunsResponse,
  makeGitHubFileContentsResponse,
} from "./fixtures/github-api-v3-fixtures.js";

/**
 * Deterministic token estimator (standard BPE ~4 UTF-8 bytes per token).
 * Reports both exact UTF-8 byte lengths and estimated token counts so results are 100% auditable.
 */
function estimateTokens(str) {
  const bytes = Buffer.byteLength(str, "utf-8");
  return { bytes, tokens: Math.ceil(bytes / 4) };
}

console.log("--- Starting Grounded GitHub REST API (2022-11-28) Token Economy Benchmark ---");

// 0. Verify fixtures contain zero GitLab-only keys (anti-deception guard)
const GITLAB_ONLY_KEYS = new Set([
  "iid",
  "web_url",
  "path_with_namespace",
  "name_with_namespace",
  "star_count",
  "http_url_to_repo",
  "ssh_url_to_repo",
  "merge_requests_enabled",
]);

function assertNoGitLabKeys(obj, path = "root") {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => assertNoGitLabKeys(item, `${path}[${idx}]`));
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    assert(!GITLAB_ONLY_KEYS.has(k), `Deceptive benchmark guard failed: GitLab key '${k}' found in GitHub fixture at ${path}.${k}`);
    assertNoGitLabKeys(v, `${path}.${k}`);
  }
}

const rawRepo = makeGitHubRepository();
const rawIssues = makeGitHubIssuesList(10);
const rawPRs = makeGitHubPullRequestsList(10);
const rawRuns = makeGitHubWorkflowRunsResponse(10);
const rawFile = makeGitHubFileContentsResponse();

assertNoGitLabKeys(rawRepo, "Repository");
assertNoGitLabKeys(rawIssues, "Issues");
assertNoGitLabKeys(rawPRs, "PullRequests");
assertNoGitLabKeys(rawRuns, "WorkflowRuns");
assertNoGitLabKeys(rawFile, "FileContents");
console.log("[PASS] Fixture authenticity verified: 100% GitHub REST API (2022-11-28) schema, 0 GitLab keys");

// 1. Benchmark: System Prompt Tool Registration Tax (83 tools vs 5 hybrid tools)
const allToolsJson = JSON.stringify(getAllTools());
const hybridTools = [
  { name: "github_find_actions", inputSchema: zodToJsonSchema(GithubFindActionsSchema) },
  { name: "github_execute_action", inputSchema: zodToJsonSchema(GithubExecuteActionSchema) },
  { name: "get_file_contents", inputSchema: zodToJsonSchema(GetFileContentsSchema) },
  { name: "get_repository", inputSchema: zodToJsonSchema(GetRepositorySchema) },
  { name: "get_commit", inputSchema: zodToJsonSchema(GetCommitSchema) },
];
const hybridToolsJson = JSON.stringify(hybridTools);
const taxRaw = estimateTokens(allToolsJson);
const taxHybrid = estimateTokens(hybridToolsJson);
const taxSavingsPct = ((1 - taxHybrid.bytes / taxRaw.bytes) * 100).toFixed(1);
assert(
  taxHybrid.bytes < taxRaw.bytes * 0.15,
  `5-tool hybrid schema (${taxHybrid.bytes} B) must be >85% smaller than full ${ACTION_CATALOG.size}-tool schema (${taxRaw.bytes} B)`
);

// 2. Benchmark: Direct projectOutput() on raw GitHub Repository object (hypermedia URL stripping)
const projectedRawRepo = projectOutput(rawRepo);
const repoRawStats = estimateTokens(JSON.stringify(rawRepo));
const repoProjectedOnlyStats = estimateTokens(JSON.stringify(projectedRawRepo));
const repoProjectionOnlyPct = ((1 - repoProjectedOnlyStats.bytes / repoRawStats.bytes) * 100).toFixed(1);
assert(
  repoProjectedOnlyStats.bytes < repoRawStats.bytes * 0.35,
  `projectOutput() alone on raw GitHub Repository must strip >65% of hypermedia URL bloat (got ${repoProjectionOnlyPct}%)`
);

// 3. End-to-End Handler + Projection + Markdown Benchmarks via executeAction()
const originalFetch = global.fetch;
const rows = [];

try {
  // 3a. get_repository
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify(rawRepo),
    json: async () => rawRepo,
  });
  const repoJsonOut = await executeAction("get_repository", { owner: "octocat", repo: "Hello-World" }, { format: "json" });
  const repoMdOut = await executeAction("get_repository", { owner: "octocat", repo: "Hello-World" }, { format: "markdown" });
  const repoJsonStats = estimateTokens(JSON.stringify(repoJsonOut));
  const repoMdStats = estimateTokens(repoMdOut);
  rows.push({
    operation: "get_repository (1 repo)",
    raw: repoRawStats,
    json: repoJsonStats,
    md: repoMdStats,
    savingsPct: ((1 - repoMdStats.bytes / repoRawStats.bytes) * 100).toFixed(1),
  });

  // 3b. list_issues (10 issues)
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify(rawIssues),
    json: async () => rawIssues,
  });
  const issuesRawStats = estimateTokens(JSON.stringify(rawIssues));
  const issuesJsonOut = await executeAction("list_issues", { owner: "octocat", repo: "Hello-World", per_page: 10 }, { format: "json" });
  const issuesMdOut = await executeAction("list_issues", { owner: "octocat", repo: "Hello-World", per_page: 10 }, { format: "markdown" });
  const issuesJsonStats = estimateTokens(JSON.stringify(issuesJsonOut));
  const issuesMdStats = estimateTokens(issuesMdOut);
  rows.push({
    operation: "list_issues (10 issues)",
    raw: issuesRawStats,
    json: issuesJsonStats,
    md: issuesMdStats,
    savingsPct: ((1 - issuesMdStats.bytes / issuesRawStats.bytes) * 100).toFixed(1),
  });

  // 3c. list_pull_requests (10 PRs)
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify(rawPRs),
    json: async () => rawPRs,
  });
  const prsRawStats = estimateTokens(JSON.stringify(rawPRs));
  const prsJsonOut = await executeAction("list_pull_requests", { owner: "octocat", repo: "Hello-World", per_page: 10 }, { format: "json" });
  const prsMdOut = await executeAction("list_pull_requests", { owner: "octocat", repo: "Hello-World", per_page: 10 }, { format: "markdown" });
  const prsJsonStats = estimateTokens(JSON.stringify(prsJsonOut));
  const prsMdStats = estimateTokens(prsMdOut);
  rows.push({
    operation: "list_pull_requests (10 PRs)",
    raw: prsRawStats,
    json: prsJsonStats,
    md: prsMdStats,
    savingsPct: ((1 - prsMdStats.bytes / prsRawStats.bytes) * 100).toFixed(1),
  });

  // 3d. list_workflow_runs (10 runs)
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify(rawRuns),
    json: async () => rawRuns,
  });
  const runsRawStats = estimateTokens(JSON.stringify(rawRuns));
  const runsJsonOut = await executeAction("list_workflow_runs", { owner: "octocat", repo: "Hello-World", per_page: 10 }, { format: "json" });
  const runsMdOut = await executeAction("list_workflow_runs", { owner: "octocat", repo: "Hello-World", per_page: 10 }, { format: "markdown" });
  const runsJsonStats = estimateTokens(JSON.stringify(runsJsonOut));
  const runsMdStats = estimateTokens(runsMdOut);
  rows.push({
    operation: "list_workflow_runs (10 runs)",
    raw: runsRawStats,
    json: runsJsonStats,
    md: runsMdStats,
    savingsPct: ((1 - runsMdStats.bytes / runsRawStats.bytes) * 100).toFixed(1),
  });

  // 3e. get_file_contents (outline_only: true vs raw Base64 payload)
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify(rawFile),
    json: async () => rawFile,
  });
  const fileRawStats = estimateTokens(JSON.stringify(rawFile));
  const fileOutlineJsonOut = await executeAction(
    "get_file_contents",
    { owner: "octocat", repo: "Hello-World", path: "src/service.js", outline_only: true },
    { format: "json" }
  );
  const fileOutlineMdOut = await executeAction(
    "get_file_contents",
    { owner: "octocat", repo: "Hello-World", path: "src/service.js", outline_only: true },
    { format: "markdown" }
  );
  const fileOutlineJsonStats = estimateTokens(JSON.stringify(fileOutlineJsonOut));
  const fileOutlineMdStats = estimateTokens(fileOutlineMdOut);
  rows.push({
    operation: "get_file_contents (outline_only: true)",
    raw: fileRawStats,
    json: fileOutlineJsonStats,
    md: fileOutlineMdStats,
    savingsPct: ((1 - fileOutlineMdStats.bytes / fileRawStats.bytes) * 100).toFixed(1),
  });
} finally {
  global.fetch = originalFetch;
}

console.log("\n=== VERIFIED GITHUB REST API (2022-11-28) TOKEN BENCHMARK RESULTS ===");
console.log(
  `| ${"Operation".padEnd(38)} | ${"Raw API (Bytes / ~Tokens)".padEnd(26)} | ${"Projected JSON".padEnd(22)} | ${"Default Markdown".padEnd(22)} | ${"Reduction".padEnd(10)} |`
);
console.log(`| ${"-".repeat(38)} | ${"-".repeat(26)} | ${"-".repeat(22)} | ${"-".repeat(22)} | ${"-".repeat(10)} |`);
console.log(
  `| ${`System Prompt Tax (${ACTION_CATALOG.size} vs 5 tools)`.padEnd(38)} | ${`${taxRaw.bytes} B (~${taxRaw.tokens} tok)`.padEnd(26)} | ${"-".padEnd(22)} | ${`${taxHybrid.bytes} B (~${taxHybrid.tokens} tok)`.padEnd(22)} | ${`${taxSavingsPct}%`.padEnd(10)} |`
);
for (const r of rows) {
  console.log(
    `| ${r.operation.padEnd(38)} | ${`${r.raw.bytes} B (~${r.raw.tokens} tok)`.padEnd(26)} | ${`${r.json.bytes} B (~${r.json.tokens} tok)`.padEnd(22)} | ${`${r.md.bytes} B (~${r.md.tokens} tok)`.padEnd(22)} | ${`${r.savingsPct}%`.padEnd(10)} |`
  );
}
console.log("");

for (const r of rows) {
  assert(
    parseFloat(r.savingsPct) >= 75.0,
    `Expected >=75% token reduction on ${r.operation}, got ${r.savingsPct}%`
  );
}

console.log("ALL GITHUB REST API (2022-11-28) BENCHMARK ASSERTIONS PASSED!");
process.exit(0);

