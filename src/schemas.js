import { z } from "zod";
import { zodToJsonSchema as zodToJsonSchemaLib } from "zod-to-json-schema";

export function zodToJsonSchema(schema) {
  if (typeof z.toJSONSchema === "function") {
    return z.toJSONSchema(schema);
  }
  if (typeof schema.toJSONSchema === "function") {
    return schema.toJSONSchema();
  }
  return zodToJsonSchemaLib(schema);
}

export const RepoParamsSchema = z.object({
  owner: z.string().describe("Repository owner (user or organization, e.g. 'octocat' or 'buggycode')"),
  repo: z.string().describe("Repository name (e.g. 'Hello-World' or 'mcp-github')"),
});

export const OptionalRepoParamsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (user or organization)"),
  repo: z.string().describe("Repository name or full path (e.g. 'mcp-github' or 'owner/mcp-github')"),
});

export function normalizeRepoParams(args) {
  let { owner, repo } = args;
  if (repo && repo.includes("/")) {
    const parts = repo.split("/");
    owner = owner || parts[0];
    repo = parts[1];
  }
  if (!owner || !repo) {
    throw new Error(`Both 'owner' and 'repo' are required. Provided owner: '${owner}', repo: '${repo}'`);
  }
  return { owner, repo };
}
