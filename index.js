#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { isReadOnly } from "./src/client.js";
import { repositoryTools, repositoryHandlers } from "./src/tools/repositories.js";
import { commitTools, commitHandlers } from "./src/tools/commits.js";
import { pullRequestTools, pullRequestHandlers } from "./src/tools/pull-requests.js";
import { issueTools, issueHandlers } from "./src/tools/issues.js";
import { milestoneTools, milestoneHandlers } from "./src/tools/milestones.js";
import { collaboratorTools, collaboratorHandlers } from "./src/tools/collaborators.js";
import { variableTools, variableHandlers } from "./src/tools/variables.js";
import { gistTools, gistHandlers } from "./src/tools/gists.js";
import { actionTools, actionHandlers } from "./src/tools/actions.js";
import { releaseTools, releaseHandlers } from "./src/tools/releases.js";
import { userTools, userHandlers } from "./src/tools/user.js";

const DOMAIN_MODULES = {
  repositories: { tools: repositoryTools, handlers: repositoryHandlers },
  commits: { tools: commitTools, handlers: commitHandlers },
  "pull-requests": { tools: pullRequestTools, handlers: pullRequestHandlers },
  issues: { tools: issueTools, handlers: issueHandlers },
  milestones: { tools: milestoneTools, handlers: milestoneHandlers },
  collaborators: { tools: collaboratorTools, handlers: collaboratorHandlers },
  variables: { tools: variableTools, handlers: variableHandlers },
  gists: { tools: gistTools, handlers: gistHandlers },
  actions: { tools: actionTools, handlers: actionHandlers },
  releases: { tools: releaseTools, handlers: releaseHandlers },
  user: { tools: userTools, handlers: userHandlers },
};

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
};

function getCliDomains() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--domains=")) {
      return args[i].slice("--domains=".length);
    }
    if (args[i] === "--domains" && args[i + 1]) {
      return args[i + 1];
    }
  }
  return null;
}

export function getActiveDomains() {
  const rawDomains = getCliDomains() || process.env.GITHUB_TOOL_DOMAINS;
  if (!rawDomains || rawDomains.trim() === "" || rawDomains.trim() === "*") {
    return Object.keys(DOMAIN_MODULES);
  }
  const requested = rawDomains
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .map((d) => DOMAIN_ALIASES[d] || d);
  const active = requested.filter((d) => Boolean(DOMAIN_MODULES[d]));
  return active.length > 0 ? Array.from(new Set(active)) : Object.keys(DOMAIN_MODULES);
}

const activeDomains = getActiveDomains();
const TOOLS = activeDomains.flatMap((d) => DOMAIN_MODULES[d].tools);
const HANDLERS = Object.assign(
  {},
  ...activeDomains.map((d) => DOMAIN_MODULES[d].handlers)
);

const server = new Server(
  {
    name: "@sumirati/mcp-github",
    version: "1.3.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const availableTools = isReadOnly() ? TOOLS.filter((t) => !t.mutating) : TOOLS;
  return {
    tools: availableTools.map(({ mutating, ...tool }) => ({
      ...tool,
      title:
        tool.title ||
        tool.name
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      annotations: {
        readOnlyHint: !mutating,
        destructiveHint: tool.name.startsWith("delete_") || tool.name.startsWith("remove_"),
        idempotentHint: !mutating,
        openWorldHint: false,
        ...(tool.annotations || {}),
      },
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolDef = TOOLS.find((t) => t.name === name);
  if (!toolDef) {
    throw new Error(`Unknown tool: ${name}`);
  }

  if (isReadOnly() && toolDef.mutating) {
    throw new Error(
      `GitHub MCP server is running in read-only mode (GITHUB_READ_ONLY=true). Tool '${name}' is a mutating operation and cannot be executed.`
    );
  }

  const handler = HANDLERS[name];
  if (!handler) {
    throw new Error(`Unknown tool handler: ${name}`);
  }

  try {
    const result = await handler(args || {});
    return {
      content: [
        {
          type: "text",
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      );
    }
    throw error;
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const modeStr = isReadOnly() ? " [READ-ONLY MODE: mutating tools disabled]" : "";
  const domainFilterStr = (getCliDomains() || process.env.GITHUB_TOOL_DOMAINS)
    ? ` [DOMAINS: ${activeDomains.join(",")}]`
    : "";
  console.error(`GitHub MCP Server v1.3.0 running on stdio (${TOOLS.length} tools registered)${modeStr}${domainFilterStr}`);
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
