import assert from "node:assert";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import {
  ACTION_CATALOG,
  findActions,
  executeAction,
  getAllTools,
} from "../src/catalog.js";

console.log("--- Starting @sumirati/mcp-github Architecture Validation ---");

// 1. Catalog count check (exact: 83 actions across 13 domains)
const catalogSize = ACTION_CATALOG.size;
console.log(`[PASS] Total actions in catalog: ${catalogSize}`);
assert.strictEqual(catalogSize, 83, `Expected exactly 83 actions, found ${catalogSize}`);

// 2. Empty search domain breakdown
const emptyResult = findActions("", "", "json");
console.log(`[PASS] findActions('', '', 'json') returned domain breakdown:`);
console.log(`       Available domains: ${Object.keys(emptyResult.available_domains).length}`);
assert.strictEqual(Object.keys(emptyResult.available_domains).length, 13, "Expected exactly 13 domains in breakdown");

// 3. Find actions - workflow / actions search
const workflowResults = findActions("workflow", "", "json");
console.log(`[PASS] findActions('workflow', '', 'json') returned ${workflowResults.total_matches} matches`);
assert(workflowResults.total_matches >= 2, "Expected at least 2 workflow actions");
const workflowActionNames = workflowResults.actions.map((a) => a.action);
assert(workflowActionNames.includes("list_workflows") || workflowActionNames.includes("trigger_workflow"), "Missing workflow actions");
console.log("       Workflow actions found:", workflowActionNames.join(", "));

// 4. Find actions - pull request search
const prResults = findActions("pull request", "", "json");
console.log(`[PASS] findActions('pull request', '', 'json') returned ${prResults.total_matches} matches`);
assert(prResults.total_matches >= 3, "Expected at least 3 PR actions");

// 5. Find actions - domain filtering
const issueDomainResults = findActions("", "issues", "json");
console.log(`[PASS] findActions(domain: 'issues', format: 'json') returned ${issueDomainResults.total_matches} actions`);
assert.strictEqual(issueDomainResults.total_matches, 8, "Expected 8 issue actions");

// 6. Parameter summary formatting
const createPR = prResults.actions.find((a) => a.action === "create_pull_request");
if (createPR) {
  console.log("[PASS] Compact parameter schema for create_pull_request:");
  console.log(JSON.stringify(createPR.parameters, null, 2));
  assert(createPR.parameters.properties.title, "title property should be present");
  assert(createPR.parameters.properties.head, "head property should be present");
}

// 7. Unknown action error handling with fuzzy suggestions
let caughtUnknown = false;
try {
  await executeAction("create_pull_req_typo", {});
} catch (err) {
  caughtUnknown = true;
  assert(err.message.includes("Did you mean:"), "Error should include 'Did you mean:' suggestion");
  assert(err.message.includes("create_pull_request"), "Suggestion should include create_pull_request");
  console.log(`[PASS] Unknown action error gracefully suggests: ${err.message}`);
}
assert(caughtUnknown, "Should throw on unknown action");

// 8. Legacy getAllTools check
const allTools = getAllTools();
console.log(`[PASS] getAllTools() returns ${allTools.length} tools for legacy mode`);
assert(allTools.length === catalogSize, "getAllTools should match catalog size");

// 9. Artifact actions discovery
const artifactResults = findActions("artifact", "", "json");
console.log(`[PASS] findActions('artifact', '', 'json') returned ${artifactResults.total_matches} matches`);
const artifactActionNames = artifactResults.actions.map((a) => a.action);
assert(artifactActionNames.includes("list_workflow_run_artifacts"), "Missing list_workflow_run_artifacts");
assert(artifactActionNames.includes("get_workflow_run_artifact"), "Missing get_workflow_run_artifact");
console.log("       Artifact actions found:", artifactActionNames.join(", "));

// 10. Branch protection action discovery
const protectionResults = findActions("protection", "", "json");
console.log(`[PASS] findActions('protection', '', 'json') returned ${protectionResults.total_matches} matches`);
const protectionActionNames = protectionResults.actions.map((a) => a.action);
assert(protectionActionNames.includes("get_branch_protection"), "Missing get_branch_protection");
console.log("       Protection action found:", protectionActionNames.join(", "));

// 11. System health check discovery
const healthResults = findActions("health", "", "json");
console.log(`[PASS] findActions('health', '', 'json') returned ${healthResults.total_matches} matches`);
const healthActionNames = healthResults.actions.map((a) => a.action);
assert(healthActionNames.includes("system_health_check"), "Missing system_health_check");

// 11b. Team action discovery & GitLab create_group purge verification
assert(!ACTION_CATALOG.has("create_group"), "GitLab hallucination create_group must not exist in MCP-github catalog");
const teamResults = findActions("create_team", "", "json");
assert(teamResults.actions.map((a) => a.action).includes("create_team"), "Missing create_team");
assert.strictEqual(teamResults.actions[0].mutating, true, "create_team must be marked mutating");
console.log("[PASS] create_team verified and GitLab create_group hallucination absent");

// 11c. Multi-file atomic commit action discovery (create_commit & push_files)
const commitActionResults = findActions("create_commit", "", "json");
console.log(`[PASS] findActions('create_commit', '', 'json') returned ${commitActionResults.total_matches} matches`);
assert(commitActionResults.actions.map((a) => a.action).includes("create_commit"), "Missing create_commit");
assert.strictEqual(commitActionResults.actions[0].mutating, true, "create_commit must be marked mutating");
const pushActionResults = findActions("push_files", "", "json");
assert(pushActionResults.actions.map((a) => a.action).includes("push_files"), "Missing push_files");
assert.strictEqual(pushActionResults.actions[0].mutating, true, "push_files must be marked mutating");
console.log("[PASS] Atomic multi-file commit actions (create_commit & push_files) verified in catalog");

// 12. Smart format: default markdown output support with 5-column Parameters signature
const mdResults = findActions("workflow", ""); // default format is markdown
assert(typeof mdResults === "string", "Expected default markdown output string");
assert(mdResults.includes("| Action | Domain | Mutating | Parameters (`*` = required) | Description |"), "Expected 5-column markdown table header with Parameters");
assert(mdResults.includes("`list_workflows`"), "Expected list_workflows in markdown table");
assert(mdResults.includes("`owner*`"), "Expected required parameter signature in markdown table");
console.log("[PASS] findActions default format: 'markdown' rendered valid 5-column Markdown table with parameter signatures");

// 12b. High-density Markdown domain formatters validation
import {
  jsonToMarkdown,
  formatIssuesMarkdown,
  formatPullRequestsMarkdown,
  formatWorkflowRunsMarkdown,
  ACTION_FORMATTERS,
} from "../src/helpers.js";

const sampleIssues = [
  {
    number: 101,
    title: "Implement Token Economy Formatters",
    state: "open",
    user: "sumirati",
    assignees: ["sumirati"],
    milestone: { title: "v2.2" },
    labels: ["enhancement", "performance"],
  },
];
const issueMd = jsonToMarkdown(sampleIssues, "list_issues");
assert(issueMd.includes("| # | Title | State | Author | Assignees | Milestone | Labels |"), "Expected issue table header");
assert(issueMd.includes("#101"), "Expected #101 in issue markdown");
assert(issueMd.includes("@sumirati"), "Expected @sumirati author");
assert(issueMd.includes("enhancement, performance"), "Expected combined labels");
console.log("[PASS] High-density formatIssuesMarkdown rendered clean 7-column table");

const samplePRs = [
  {
    number: 55,
    title: "Switch list actions to Markdown tables",
    draft: false,
    state: "open",
    head: { ref: "feat/markdown-tables" },
    base: { ref: "main" },
    user: "sumirati",
    mergeable_state: "clean",
  },
];
const prMd = jsonToMarkdown(samplePRs, "list_pull_requests");
assert(prMd.includes("| #PR | Title | State | Branch | Author | Mergeable |"), "Expected PR table header");
assert(prMd.includes("#55"), "Expected #55 in PR markdown");
assert(prMd.includes("feat/markdown-tables -> main"), "Expected branch routing");
console.log("[PASS] High-density formatPullRequestsMarkdown rendered clean 6-column table");

const sampleRuns = [
  {
    id: 8821,
    name: "CI Pipeline",
    status: "completed",
    conclusion: "success",
    head_branch: "main",
    head_sha: "c0ffee1",
    event: "push",
  },
];
const runMd = jsonToMarkdown(sampleRuns, "list_workflow_runs");
assert(runMd.includes("| ID | Workflow | Status | Branch | Commit | Event |"), "Expected workflow run table header");
assert(runMd.includes("8821"), "Expected run 8821 in table");
assert(runMd.includes("c0ffee1"), "Expected short SHA in table");
// 12c. Smart Diff & Lockfile Truncation + Conservative Pagination (Proposals A & B)
import { isLockfile, filterLockfileDiff } from "../src/helpers.js";
import { ListCommitsSchema } from "../src/tools/commits.js";
import { ListPullRequestsSchema } from "../src/tools/pull-requests.js";

assert.strictEqual(isLockfile("package-lock.json"), true);
assert.strictEqual(isLockfile("subdir/yarn.lock"), true);
assert.strictEqual(isLockfile("go.sum"), true);
assert.strictEqual(isLockfile("bundle.min.js"), true);
assert.strictEqual(isLockfile("src/main.js"), false);

const mockDiff = `diff --git a/package-lock.json b/package-lock.json
index 1234567..89abcdef 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,5 +1,5 @@
+  "version": "2.0.0"
diff --git a/src/index.js b/src/index.js
index 1111111..2222222 100644
--- a/src/index.js
+++ b/src/index.js
@@ -1 +1 @@
-console.log('old');
+console.log('new');
`;

const filtered = filterLockfileDiff(mockDiff);
assert(filtered.includes("[... Diff collapsed for lockfile: package-lock.json"), "Expected lockfile diff collapsed");
assert(filtered.includes("console.log('new')"), "Expected non-lockfile diff retained");

const commitParsed = ListCommitsSchema.parse({ owner: "o", repo: "r" });
assert.strictEqual(commitParsed.per_page, 10, "Default per_page must be 10 for commits");
const prParsed = ListPullRequestsSchema.parse({ owner: "o", repo: "r" });
assert.strictEqual(prParsed.per_page, 10, "Default per_page must be 10 for pull requests");
console.log("[PASS] Smart diff lockfile truncation and default per_page: 10 verified");

// 13. Registry metadata & server.json validation
const serverJson = JSON.parse(fs.readFileSync(new URL("../server.json", import.meta.url), "utf8"));
const pkgJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

assert.strictEqual(serverJson.version, pkgJson.version, `server.json version (${serverJson.version}) must match package.json (${pkgJson.version})`);
assert.strictEqual(serverJson.packages?.[0]?.version, pkgJson.version, `server.json package version must match package.json (${pkgJson.version})`);
assert.ok(serverJson.description.length <= 100, `server.json description length (${serverJson.description.length} chars) must be <= 100 chars`);
console.log(`[PASS] server.json schema & version parity verified (v${serverJson.version}, desc: ${serverJson.description.length} chars)`);

// 14. End-to-End executeAction() Runtime Verification (get_repository, create_tag, list_repository_webhooks, create_commit delete)
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    const method = (options.method || "GET").toUpperCase();
    if (u.endsWith("/repos/octocat/Hello-World") && method === "GET") {
      return new Response(
        JSON.stringify({
          id: 1296269,
          node_id: "MDEwOlJlcG9zaXRvcnkxMjk2MjY5",
          name: "Hello-World",
          full_name: "octocat/Hello-World",
          private: false,
          owner: { login: "octocat", id: 1, node_id: "MDQ6VXNlcjE=" },
          html_url: "https://github.com/octocat/Hello-World",
          description: "This your first repo!",
          default_branch: "main",
          visibility: "public",
          stargazers_count: 80,
          forks_count: 9,
          open_issues_count: 0,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (u.endsWith("/repos/octocat/Hello-World/git/refs") && method === "POST") {
      const body = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          ref: body.ref,
          node_id: "MDM6UmVmMTI5NjI2OTpyZWZzL3RhZ3MvdjEuMC4w",
          url: "https://api.github.com/repos/octocat/Hello-World/git/refs/tags/v1.0.0",
          object: { sha: body.sha, type: "commit", url: "https://api.github.com/repos/octocat/Hello-World/git/commits/" + body.sha },
        }),
        { status: 201, headers: { "content-type": "application/json" } }
      );
    }
    if (u.includes("/repos/octocat/Hello-World/hooks") && method === "GET") {
      return new Response(
        JSON.stringify([
          {
            id: 12345678,
            name: "web",
            active: true,
            events: ["push", "pull_request"],
            config: { url: "https://example.com/webhook", content_type: "json" },
            updated_at: "2026-01-01T00:00:00Z",
            created_at: "2026-01-01T00:00:00Z",
          },
        ]),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            link: '<https://api.github.com/repositories/1296269/hooks?page=2>; rel="next", <https://api.github.com/repositories/1296269/hooks?page=3>; rel="last"',
          },
        }
      );
    }
    if (u.endsWith("/repos/octocat/Hello-World/git/ref/heads/main") && method === "GET") {
      return new Response(JSON.stringify({ object: { sha: "baserefsha1234567890" } }), { status: 200 });
    }
    if (u.endsWith("/repos/octocat/Hello-World/git/commits/baserefsha1234567890") && method === "GET") {
      return new Response(JSON.stringify({ sha: "baserefsha1234567890", tree: { sha: "basetreesha1234567890" } }), { status: 200 });
    }
    if (u.endsWith("/repos/octocat/Hello-World/git/trees") && method === "POST") {
      const body = JSON.parse(options.body);
      assert.strictEqual(body.tree[0].sha, null, "delete action must send sha: null to Git Trees API");
      return new Response(JSON.stringify({ sha: "newtreesha1234567890" }), { status: 201 });
    }
    if (u.endsWith("/repos/octocat/Hello-World/git/commits") && method === "POST") {
      return new Response(
        JSON.stringify({
          sha: "newcommitsha1234567890",
          html_url: "https://github.com/octocat/Hello-World/commit/newcommitsha1234567890",
          author: { name: "Octocat", date: "2026-01-01T00:00:00Z" },
          message: "Delete obsolete file",
        }),
        { status: 201 }
      );
    }
    if (u.endsWith("/repos/octocat/Hello-World/git/refs/heads/main") && method === "PATCH") {
      return new Response(JSON.stringify({ ref: "refs/heads/main", object: { sha: "newcommitsha1234567890" } }), { status: 200 });
    }
    throw new Error(`Unexpected fetch in test: ${method} ${u}`);
  };

  const repoMd = await executeAction("get_repository", { owner: "octocat", repo: "Hello-World" }, "markdown");
  assert(typeof repoMd === "string" && repoMd.includes("octocat/Hello-World"), "executeAction('get_repository') must return formatted Markdown without ReferenceError");

  const tagJson = await executeAction(
    "create_tag",
    { owner: "octocat", repo: "Hello-World", tag: "v1.0.0", sha: "c3d0be41ecbe669545ee3e94d31ed9a4bc91ee3c" },
    "json"
  );
  assert.strictEqual(tagJson.ref, "refs/tags/v1.0.0", "executeAction('create_tag') must create lightweight tag ref without ReferenceError");

  const hooksJson = await executeAction("list_repository_webhooks", { owner: "octocat", repo: "Hello-World" }, "json");
  assert.strictEqual(hooksJson.webhooks.length, 1, "list_repository_webhooks must preserve items when Link pagination header is present");
  assert.strictEqual(hooksJson.pagination.next_page, 2, "list_repository_webhooks must preserve Link pagination metadata");

  const delCommitJson = await executeAction(
    "create_commit",
    {
      owner: "octocat",
      repo: "Hello-World",
      branch: "main",
      message: "Delete obsolete file",
      files: [{ path: "old.txt", action: "delete" }],
    },
    "json"
  );
  assert.strictEqual(delCommitJson.sha, "newcommitsha1234567890", "create_commit must support file deletion via sha: null");
  console.log("[PASS] End-to-end executeAction() runtime checks passed (get_repository, create_tag, list_repository_webhooks, create_commit delete)");
} finally {
  globalThis.fetch = originalFetch;
}

// 15. ACTION_FORMATTERS & README.md Catalog Parity Check
for (const formatterAction of Object.keys(ACTION_FORMATTERS)) {
  assert(
    ACTION_CATALOG.has(formatterAction),
    `ACTION_FORMATTERS contains dead key '${formatterAction}' that does not exist in ACTION_CATALOG`
  );
}
const readmeText = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
const catalogSectionMatch = readmeText.split("### 2. Repositories & Branches")[1]?.split("\n## ")[0] || "";
const documentedActions = new Set(
  [...catalogSectionMatch.matchAll(/^\|\s*`([a-z0-9_]+)`\s*\|/gm)].map((m) => m[1])
);
for (const actionName of ACTION_CATALOG.keys()) {
  assert(
    documentedActions.has(actionName),
    `Action '${actionName}' is in ACTION_CATALOG but missing from README.md Full Action Catalog table`
  );
}
for (const docAction of documentedActions) {
  assert(
    ACTION_CATALOG.has(docAction),
    `Action '${docAction}' is listed in README.md Full Action Catalog table but does not exist in ACTION_CATALOG`
  );
}
console.log(`[PASS] ACTION_FORMATTERS (${Object.keys(ACTION_FORMATTERS).length} formatters) and README.md (${documentedActions.size} actions) 100% aligned with ACTION_CATALOG`);

// 16. Zero GitLab API Cross-Contamination Invariant
const FORBIDDEN_GITLAB_PATTERNS = [
  /\bcreate_group\b/,
  /\bcommit_message\b/,
  /\bfile_path\b/,
  /\bauthored_date\b/,
  /\bauthor_name\b/,
  /\bmerge_request\b/i,
  /\bpath_with_namespace\b/,
  /\bweb_url\b/,
  /\bgitlab\b/i,
];
const filesToScan = [
  "../index.js",
  "../README.md",
  "../instructions.md",
  "../server.json",
  "../src/client.js",
  "../src/catalog.js",
  "../src/helpers.js",
  "../src/schemas.js",
  ...fs.readdirSync(new URL("../src/tools", import.meta.url)).map((f) => `../src/tools/${f}`),
];
for (const relPath of filesToScan) {
  const rawContent = fs.readFileSync(new URL(relPath, import.meta.url), "utf8");
  const content = relPath === "../README.md" ? rawContent.split("## Acknowledgements & Lineage")[0] : rawContent;
  for (const pattern of FORBIDDEN_GITLAB_PATTERNS) {
    // In GitHub REST API (2022-11-28), PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge
    // officially defines 'commit_message' alongside 'commit_title'. The forbidden alias was in CreateCommitSchema (commits.js).
    if (pattern.source.includes("commit_message") && relPath.endsWith("pull-requests.js")) {
      continue;
    }
    assert(
      !pattern.test(content),
      `Cross-contamination violation: forbidden GitLab pattern ${pattern} found in ${relPath}`
    );
  }
}
console.log(`[PASS] Zero GitLab cross-contamination verified across ${filesToScan.length} source and documentation files`);

const hasPublisher = spawnSync("which", ["mcp-publisher"]).status === 0 || fs.existsSync(`${process.env.HOME}/bin/mcp-publisher`);
if (hasPublisher) {
  const pubCmd = spawnSync("which", ["mcp-publisher"]).status === 0 ? "mcp-publisher" : `${process.env.HOME}/bin/mcp-publisher`;
  const pubCheck = spawnSync(pubCmd, ["validate"], { stdio: "pipe", encoding: "utf8" });
  if (pubCheck.status === 0) {
    console.log("[PASS] mcp-publisher validate passed against official MCP registry");
  } else {
    throw new Error(`mcp-publisher validate failed:\n${pubCheck.stderr || pubCheck.stdout}`);
  }
} else {
  console.log("[SKIP] mcp-publisher not found in PATH, skipping live remote registry check");
}

console.log("\nALL @sumirati/mcp-github v2.2.0 CHECKS PASSED SUCCESSFULLY!");
