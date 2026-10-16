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

// 1. Catalog count check
const catalogSize = ACTION_CATALOG.size;
console.log(`[PASS] Total actions in catalog: ${catalogSize}`);
assert(catalogSize >= 70, `Expected at least 70 actions, found ${catalogSize}`);

// 2. Empty search domain breakdown
const emptyResult = findActions("", "", "json");
console.log(`[PASS] findActions('', '', 'json') returned domain breakdown:`);
console.log(`       Available domains: ${Object.keys(emptyResult.available_domains).length}`);
assert(Object.keys(emptyResult.available_domains).length >= 10, "Expected at least 10 domains in breakdown");

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
assert(issueDomainResults.total_matches >= 4, "Expected issue actions");

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

// 11b. Team and group action discovery
const groupResults = findActions("create_group", "", "json");
console.log(`[PASS] findActions('create_group', '', 'json') returned ${groupResults.total_matches} matches`);
assert(groupResults.actions.map((a) => a.action).includes("create_group"), "Missing create_group");
assert.strictEqual(groupResults.actions[0].mutating, true, "create_group must be marked mutating");
const teamResults = findActions("create_team", "", "json");
assert(teamResults.actions.map((a) => a.action).includes("create_team"), "Missing create_team");
assert.strictEqual(teamResults.actions[0].mutating, true, "create_team must be marked mutating");

// 12. Smart format: default markdown output support
const mdResults = findActions("workflow", ""); // default format is markdown
assert(typeof mdResults === "string", "Expected default markdown output string");
assert(mdResults.includes("| Action | Domain | Mutating | Description |"), "Expected markdown table header");
assert(mdResults.includes("`list_workflows`"), "Expected list_workflows in markdown table");
console.log("[PASS] findActions default format: 'markdown' rendered valid Markdown table");

// 13. Registry metadata & server.json validation
const serverJson = JSON.parse(fs.readFileSync(new URL("../server.json", import.meta.url), "utf8"));
const pkgJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

assert.strictEqual(serverJson.version, pkgJson.version, `server.json version (${serverJson.version}) must match package.json (${pkgJson.version})`);
assert.strictEqual(serverJson.packages?.[0]?.version, pkgJson.version, `server.json package version must match package.json (${pkgJson.version})`);
assert.ok(serverJson.description.length <= 100, `server.json description length (${serverJson.description.length} chars) must be <= 100 chars`);
console.log(`[PASS] server.json schema & version parity verified (v${serverJson.version}, desc: ${serverJson.description.length} chars)`);

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

console.log("\nALL @sumirati/mcp-github v2.1.0 CHECKS PASSED SUCCESSFULLY!");
