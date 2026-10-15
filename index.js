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
import { pullRequestTools, pullRequestHandlers } from "./src/tools/pull-requests.js";
import { issueTools, issueHandlers } from "./src/tools/issues.js";
import { actionTools, actionHandlers } from "./src/tools/actions.js";
import { releaseTools, releaseHandlers } from "./src/tools/releases.js";
import { userTools, userHandlers } from "./src/tools/user.js";

const TOOLS = [
  ...repositoryTools,
  ...pullRequestTools,
  ...issueTools,
  ...actionTools,
  ...releaseTools,
  ...userTools,
];

const HANDLERS = {
  ...repositoryHandlers,
  ...pullRequestHandlers,
  ...issueHandlers,
  ...actionHandlers,
  ...releaseHandlers,
  ...userHandlers,
};

const server = new Server(
  {
    name: "@sumirati/mcp-github",
    version: "1.0.0",
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
    tools: availableTools.map(({ mutating, ...tool }) => tool),
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
  if (isReadOnly()) {
    console.error("GitHub MCP Server running on stdio [READ-ONLY MODE: mutating tools disabled]");
  } else {
    console.error("GitHub MCP Server running on stdio");
  }
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
