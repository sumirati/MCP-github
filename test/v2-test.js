import assert from "node:assert";
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
const emptyResult = findActions("", "");
console.log(`[PASS] findActions('', '') returned domain breakdown:`);
console.log(`       Available domains: ${Object.keys(emptyResult.available_domains).length}`);
assert(Object.keys(emptyResult.available_domains).length >= 10, "Expected at least 10 domains in breakdown");

// 3. Find actions - workflow / actions search
const workflowResults = findActions("workflow", "");
console.log(`[PASS] findActions('workflow') returned ${workflowResults.total_matches} matches`);
assert(workflowResults.total_matches >= 2, "Expected at least 2 workflow actions");
const workflowActionNames = workflowResults.actions.map((a) => a.action);
assert(workflowActionNames.includes("list_workflows") || workflowActionNames.includes("trigger_workflow"), "Missing workflow actions");
console.log("       Workflow actions found:", workflowActionNames.join(", "));

// 4. Find actions - pull request search
const prResults = findActions("pull request", "");
console.log(`[PASS] findActions('pull request') returned ${prResults.total_matches} matches`);
assert(prResults.total_matches >= 3, "Expected at least 3 PR actions");

// 5. Find actions - domain filtering
const issueDomainResults = findActions("", "issues");
console.log(`[PASS] findActions(domain: 'issues') returned ${issueDomainResults.total_matches} actions`);
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
const artifactResults = findActions("artifact", "");
console.log(`[PASS] findActions('artifact') returned ${artifactResults.total_matches} matches`);
const artifactActionNames = artifactResults.actions.map((a) => a.action);
assert(artifactActionNames.includes("list_workflow_run_artifacts"), "Missing list_workflow_run_artifacts");
assert(artifactActionNames.includes("get_workflow_run_artifact"), "Missing get_workflow_run_artifact");
console.log("       Artifact actions found:", artifactActionNames.join(", "));

// 10. Branch protection action discovery
const protectionResults = findActions("protection", "");
console.log(`[PASS] findActions('protection') returned ${protectionResults.total_matches} matches`);
const protectionActionNames = protectionResults.actions.map((a) => a.action);
assert(protectionActionNames.includes("get_branch_protection"), "Missing get_branch_protection");
console.log("       Protection action found:", protectionActionNames.join(", "));

// 11. System health check discovery
const healthResults = findActions("health", "");
console.log(`[PASS] findActions('health') returned ${healthResults.total_matches} matches`);
const healthActionNames = healthResults.actions.map((a) => a.action);
assert(healthActionNames.includes("system_health_check"), "Missing system_health_check");

// 12. Smart format: markdown output support
const mdResults = findActions("workflow", "", "markdown");
assert(typeof mdResults === "string", "Expected markdown output string");
assert(mdResults.includes("| Action | Domain | Mutating | Description |"), "Expected markdown table header");
assert(mdResults.includes("`list_workflows`"), "Expected list_workflows in markdown table");
console.log("[PASS] findActions format: 'markdown' rendered valid Markdown table");

console.log("\nALL @sumirati/mcp-github v2.1.0 CHECKS PASSED SUCCESSFULLY!");
