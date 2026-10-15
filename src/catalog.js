import { repositoryTools, repositoryHandlers } from "./tools/repositories.js";
import { commitTools, commitHandlers } from "./tools/commits.js";
import { pullRequestTools, pullRequestHandlers } from "./tools/pull-requests.js";
import { issueTools, issueHandlers } from "./tools/issues.js";
import { milestoneTools, milestoneHandlers } from "./tools/milestones.js";
import { collaboratorTools, collaboratorHandlers } from "./tools/collaborators.js";
import { variableTools, variableHandlers } from "./tools/variables.js";
import { gistTools, gistHandlers } from "./tools/gists.js";
import { actionTools, actionHandlers } from "./tools/actions.js";
import { releaseTools, releaseHandlers } from "./tools/releases.js";
import { userTools, userHandlers } from "./tools/user.js";
import { extendedTools, extendedHandlers } from "./tools/extended.js";
import { projectOutput } from "./helpers.js";
import { isReadOnly } from "./client.js";

// Domain classification mapping
function getDomainForTool(name) {
  if (name.includes("topic") || name.includes("webhook") || name.includes("hook")) return "webhooks";
  if (name.includes("dependabot") || name.includes("alert") || name.includes("security")) return "security";
  if (name.includes("status") && name.includes("commit")) return "commits";
  if (name.includes("gist")) return "gists";
  if (name.includes("variable") || name.includes("secret")) return "variables";
  if (name.includes("collaborator") || name.includes("permission")) return "collaborators";
  if (name.includes("milestone")) return "milestones";
  if (name.includes("pull_request") || name.includes("review")) return "pull-requests";
  if (name.includes("issue") || name.includes("label")) return "issues";
  if (name.includes("workflow") || name.includes("job") || name.includes("run")) return "actions";
  if (name.includes("release") || name.includes("tag")) return "releases";
  if (name.includes("commit")) return "commits";
  if (name.includes("user") || name.includes("organization")) return "user";
  return "repositories";
}

// Assemble all action modules
const RAW_MODULES = [
  { tools: repositoryTools, handlers: repositoryHandlers, defaultDomain: "repositories" },
  { tools: commitTools, handlers: commitHandlers, defaultDomain: "commits" },
  { tools: pullRequestTools, handlers: pullRequestHandlers, defaultDomain: "pull-requests" },
  { tools: issueTools, handlers: issueHandlers, defaultDomain: "issues" },
  { tools: milestoneTools, handlers: milestoneHandlers, defaultDomain: "milestones" },
  { tools: collaboratorTools, handlers: collaboratorHandlers, defaultDomain: "collaborators" },
  { tools: variableTools, handlers: variableHandlers, defaultDomain: "variables" },
  { tools: gistTools, handlers: gistHandlers, defaultDomain: "gists" },
  { tools: actionTools, handlers: actionHandlers, defaultDomain: "actions" },
  { tools: releaseTools, handlers: releaseHandlers, defaultDomain: "releases" },
  { tools: userTools, handlers: userHandlers, defaultDomain: "user" },
  { tools: extendedTools, handlers: extendedHandlers, defaultDomain: "extended" },
];

export const ACTION_CATALOG = new Map();

for (const mod of RAW_MODULES) {
  for (const tool of mod.tools) {
    const domain = mod.defaultDomain === "extended" ? getDomainForTool(tool.name) : mod.defaultDomain;
    ACTION_CATALOG.set(tool.name, {
      name: tool.name,
      domain,
      description: tool.description,
      inputSchema: tool.inputSchema,
      mutating: Boolean(tool.mutating),
      handler: mod.handlers[tool.name],
    });
  }
}

const DOMAIN_ALIASES = {
  repos: "repositories",
  repo: "repositories",
  repository: "repositories",
  pr: "pull-requests",
  prs: "pull-requests",
  pull_requests: "pull-requests",
  pulls: "pull-requests",
  issue: "issues",
  members: "collaborators",
  member: "collaborators",
  collaborator: "collaborators",
  vars: "variables",
  secrets: "variables",
  gist: "gists",
  ci: "actions",
  workflow: "actions",
  workflows: "actions",
  tags: "releases",
  tag: "releases",
  users: "user",
  webhook: "webhooks",
  hooks: "webhooks",
  alerts: "security",
  dependabot: "security",
};

/**
 * Normalizes parameter schema into a token-efficient summary format.
 */
function extractParameterSummary(inputSchema) {
  if (!inputSchema || !inputSchema.properties) {
    return { required: [], properties: {} };
  }
  const required = inputSchema.required || [];
  const properties = {};
  for (const [key, prop] of Object.entries(inputSchema.properties)) {
    properties[key] = {
      type: prop.type || (prop.enum ? "enum" : "any"),
      ...(prop.description ? { description: prop.description } : {}),
      ...(prop.enum ? { enum: prop.enum } : {}),
      ...(prop.default !== undefined ? { default: prop.default } : {}),
    };
  }
  return { required, properties };
}

/**
 * Searches the 75-action catalog.
 * Supports keyword search, domain filtering, and read-only status.
 */
export function findActions(query = "", domain = "") {
  let actions = Array.from(ACTION_CATALOG.values());

  const targetDomain = domain ? (DOMAIN_ALIASES[domain.toLowerCase()] || domain.toLowerCase()) : null;
  if (targetDomain) {
    actions = actions.filter((a) => a.domain.toLowerCase() === targetDomain);
  }

  if (query && query.trim() !== "") {
    const tokens = query.toLowerCase().trim().split(/\s+/);
    actions = actions.filter((a) => {
      const searchSpace = `${a.name} ${a.domain} ${a.description}`.toLowerCase();
      return tokens.every((token) => searchSpace.includes(token));
    });
  }

  // If no filters were provided, return catalog domain breakdown to avoid dumping thousands of tokens
  if (!query && !domain) {
    const domainCounts = {};
    for (const a of Array.from(ACTION_CATALOG.values())) {
      domainCounts[a.domain] = (domainCounts[a.domain] || 0) + 1;
    }
    return {
      message: `GitHub Action Catalog contains ${ACTION_CATALOG.size} actions across ${Object.keys(domainCounts).length} domains. Query by domain or search keyword to retrieve parameter schemas.`,
      available_domains: domainCounts,
      daily_driver_eager_tools: [
        "get_file_contents (owner, repo, path, [ref])",
        "get_repository (owner, repo)",
        "get_commit (owner, repo, ref, [file_path], [max_diff_lines])",
      ],
      usage_hint: "Call github_find_actions(query: 'pull request') or github_find_actions(domain: 'issues') to inspect parameter signatures.",
    };
  }

  // Cap results at 15 matches with full schemas to preserve token budget
  const matches = actions.slice(0, 15).map((a) => ({
    action: a.name,
    domain: a.domain,
    mutating: a.mutating,
    description: a.description,
    parameters: extractParameterSummary(a.inputSchema),
  }));

  return {
    total_matches: actions.length,
    returned_actions: matches.length,
    actions: matches,
    ...(actions.length > 15 ? { notice: `${actions.length - 15} additional actions matched. Refine your query string for narrower results.` } : {}),
  };
}

/**
 * Dispatches action execution with safety guards and output compression.
 */
export async function executeAction(actionName, params = {}) {
  const actionDef = ACTION_CATALOG.get(actionName);
  if (!actionDef) {
    const available = Array.from(ACTION_CATALOG.keys())
      .filter((k) => k.includes(actionName) || actionName.includes(k.split("_")[0]))
      .slice(0, 5);
    const suggestion = available.length > 0 ? ` Did you mean: ${available.join(", ")}?` : "";
    throw new Error(`Unknown GitHub action: '${actionName}'.${suggestion} Use github_find_actions to search the catalog.`);
  }

  if (isReadOnly() && actionDef.mutating) {
    throw new Error(
      `GitHub MCP server is running in read-only mode (GITHUB_READ_ONLY=true). Action '${actionName}' is a mutating operation and cannot be executed.`
    );
  }

  const rawResult = await actionDef.handler(params);
  // Apply token compression output projection
  const projected = projectOutput(rawResult);
  return projected !== undefined ? projected : rawResult;
}
