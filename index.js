#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "./src/schemas.js";
import { isReadOnly } from "./src/client.js";
import { projectOutput } from "./src/helpers.js";
import {
  ACTION_CATALOG,
  findActions,
  executeAction,
  getAllTools,
} from "./src/catalog.js";
import {
  GetFileContentsSchema,
  GetRepositorySchema,
  repositoryHandlers,
} from "./src/tools/repositories.js";
import {
  GetCommitSchema,
  commitHandlers,
} from "./src/tools/commits.js";
import { jsonToMarkdown } from "./src/helpers.js";

// Meta Discovery & Execution Tool Schemas
export const GithubFindActionsSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      "Search keyword query to match against action names, domains, or descriptions (e.g. 'pull request', 'issue comment', 'webhook', 'deploy', 'dependabot')"
    ),
  domain: z
    .enum([
      "repositories",
      "commits",
      "pull-requests",
      "issues",
      "milestones",
      "collaborators",
      "variables",
      "gists",
      "actions",
      "releases",
      "security",
      "webhooks",
      "user",
    ])
    .optional()
    .describe(
      "Optional domain filter to restrict discovery to a specific functional category"
    ),
  format: z
    .enum(["json", "markdown"])
    .optional()
    .default("markdown")
    .describe("Output format: 'markdown' (default, compact human/LLM-readable text table) or 'json' (structured object with parameter schemas)"),
});

const DEFAULT_FORMAT = process.env.MCP_OUTPUT_FORMAT === "json" ? "json" : "markdown";

export const GithubExecuteActionSchema = z.object({
  action: z
    .string()
    .describe(
      "Exact name of the GitHub action to execute (e.g. 'create_pull_request', 'list_issues', 'trigger_workflow', 'create_branch')"
    ),
  params: z
    .record(z.any())
    .optional()
    .describe(
      "Parameters dictionary for the action matching its parameter schema"
    ),
  parameters: z
    .record(z.any())
    .optional()
    .describe(
      "Alias for params (for cross-client compatibility)"
    ),
  format: z
    .enum(["json", "markdown"])
    .optional()
    .default(DEFAULT_FORMAT)
    .describe("Output format: 'markdown' (default, token-optimized compact table/text for LLM) or 'json' (structured JSON)"),
});

// The 5-Tool Hybrid Architecture (2026 AI-Native Standard)
const EAGER_TOOLS = [
  {
    name: "github_find_actions",
    title: "Find GitHub Actions",
    description:
      `Search and discover available GitHub actions in the ${ACTION_CATALOG.size}-action catalog by keyword query or domain filter. Use this discovery tool first whenever you need to perform an action outside the 3 eager daily drivers (e.g. managing PRs, issues, releases, workflows, collaborators, webhooks, variables, security alerts). Returns matching action names, domain categories, mutating flags, descriptions, and parameter signatures so you can construct the call for github_execute_action.`,
    inputSchema: zodToJsonSchema(GithubFindActionsSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "github_execute_action",
    title: "Execute GitHub Action",
    description:
      `Execute any supported GitHub action from the ${ACTION_CATALOG.size}-action catalog by action name with parameters. Requires the exact action name (discovered via github_find_actions) and its corresponding argument dictionary. Output is automatically compressed with strict token projection filters (stripping hypermedia URL templates, avatar links, empty fields, node_ids) and formatted as compact Markdown by default. Mutating actions are blocked when running in read-only mode (GITHUB_READ_ONLY=true).`,
    inputSchema: zodToJsonSchema(GithubExecuteActionSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "get_file_contents",
    title: "Get File Contents",
    description:
      "Read current file contents, extract symbol outlines, slice line ranges, or list directory entries from a repository at a specified git ref without cloning. Automatically decodes Base64 file contents into plain text UTF-8. Eager daily driver tool for inspecting source code, configuration files, and directory layouts.",
    inputSchema: zodToJsonSchema(GetFileContentsSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "get_repository",
    title: "Get Repository",
    description:
      "Get comprehensive repository metadata, visibility, description, default branch, HTML URL, star count, fork count, and open issues count for an owner/repo. Eager daily driver tool for verifying repository configuration and existence.",
    inputSchema: zodToJsonSchema(GetRepositorySchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "get_commit",
    title: "Get Commit",
    description:
      "Get detailed commit metadata, author information, message, and unified git diffs for a specific commit SHA or reference. Eager daily driver tool for reviewing code modifications, patches, or investigating regressions. Output diffs are token-optimized and automatically truncated to max_diff_lines (default: 400 lines).",
    inputSchema: zodToJsonSchema(GetCommitSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

function formatResult(result, format = DEFAULT_FORMAT, actionName = undefined) {
  if (result && Array.isArray(result.content)) {
    return result;
  }
  if (typeof result === "string") {
    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  }
  if (format === "markdown") {
    return {
      content: [
        {
          type: "text",
          text: jsonToMarkdown(result, actionName),
        },
      ],
    };
  }
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

const server = new Server(
  {
    name: "@sumirati/mcp-github",
    version: "2.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

function shouldExposeAllTools() {
  return (
    process.env.GITHUB_EXPOSE_ALL_TOOLS === "true" ||
    process.env.GITHUB_EXPOSE_LEGACY_TOOLS === "true"
  );
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (shouldExposeAllTools()) {
    return {
      tools: getAllTools(),
    };
  }
  return {
    tools: EAGER_TOOLS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    if (name === "github_find_actions") {
      const parsed = GithubFindActionsSchema.parse(args);
      const result = findActions(parsed.query, parsed.domain, parsed.format);
      return formatResult(result, parsed.format);
    }

    if (name === "github_execute_action") {
      const parsed = GithubExecuteActionSchema.parse(args);
      const actionParams = parsed.params || parsed.parameters || {};
      const result = await executeAction(parsed.action, actionParams, { format: parsed.format });
      return formatResult(result, parsed.format, parsed.action);
    }

    // Eager tools (get_file_contents, get_repository, get_commit) and direct catalog actions
    const requestedFormat = args?.format || DEFAULT_FORMAT;
    const result = await executeAction(name, args, { format: requestedFormat });
    return formatResult(result, requestedFormat, name);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments for '${name}': ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      );
    }
    throw error;
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const modeStr = isReadOnly() ? " [READ-ONLY MODE: mutating actions disabled]" : "";
  const legacyStr = shouldExposeAllTools() ? " [LEGACY MODE: all tools exposed]" : " [HYBRID 5-TOOL MODE]";
  console.error(
    `GitHub MCP Server v2.2.0 running on stdio (${ACTION_CATALOG.size} actions in catalog)${modeStr}${legacyStr}`
  );
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
