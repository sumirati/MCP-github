import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeActionsVariable } from "../helpers.js";

export const ListActionsVariablesSchema = RepoParamsSchema.extend({
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(30).describe("Number of variables per page (default: 30, max: 100)"),
});

export const GetActionsVariableSchema = RepoParamsSchema.extend({
  name: z.string().describe("Exact name of the configuration variable (case-sensitive, e.g. 'DEPLOY_ENV')"),
});

export const CreateActionsVariableSchema = RepoParamsSchema.extend({
  name: z.string().describe("Variable name identifier (e.g. 'SERVICE_PORT' or 'ENABLE_FEATURE')"),
  value: z.string().describe("Plain text string value of the configuration variable"),
});

export const UpdateActionsVariableSchema = RepoParamsSchema.extend({
  name: z.string().describe("Name of the existing variable to update"),
  value: z.string().describe("New plain text string value to assign to the variable"),
});

export const DeleteActionsVariableSchema = RepoParamsSchema.extend({
  name: z.string().describe("Name of the configuration variable to delete"),
});

export const ListActionsSecretsSchema = RepoParamsSchema.extend({
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(30).describe("Number of secrets per page (default: 30, max: 100)"),
});

export const variableTools = [
  {
    name: "list_actions_variables",
    description: "List non-sensitive GitHub Actions configuration variables defined on a repository with their values and timestamps. Use for inspecting build environment parameters.",
    inputSchema: zodToJsonSchema(ListActionsVariablesSchema),
  },
  {
    name: "get_actions_variable",
    description: "Get the plain text value and last updated timestamp of a specific GitHub Actions repository variable by name.",
    inputSchema: zodToJsonSchema(GetActionsVariableSchema),
  },
  {
    name: "create_actions_variable",
    description: "Create a non-sensitive configuration variable for GitHub Actions workflows. Requires write/admin permissions and GITHUB_READ_ONLY=false. For sensitive credentials, use repository secrets instead.",
    inputSchema: zodToJsonSchema(CreateActionsVariableSchema),
    mutating: true,
  },
  {
    name: "update_actions_variable",
    description: "Update the value of an existing non-sensitive GitHub Actions configuration variable. Requires write/admin permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(UpdateActionsVariableSchema),
    mutating: true,
  },
  {
    name: "delete_actions_variable",
    description: "Delete a non-sensitive configuration variable from GitHub Actions. Requires write/admin permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(DeleteActionsVariableSchema),
    mutating: true,
  },
  {
    name: "list_actions_secrets",
    description: "List GitHub Actions repository secret names and timestamps. Behavioral safety: secret values are permanently masked by GitHub and never returned in plaintext.",
    inputSchema: zodToJsonSchema(ListActionsSecretsSchema),
  },
];

export const variableHandlers = {
  list_actions_variables: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListActionsVariablesSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await githubRequest(`/repos/${owner}/${repo}/actions/variables?${q.toString()}`);
    return {
      total_count: res.total_count,
      variables: (res.variables || []).map(summarizeActionsVariable),
    };
  },

  get_actions_variable: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetActionsVariableSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/actions/variables/${encodeURIComponent(parsed.name)}`);
    return summarizeActionsVariable(res);
  },

  create_actions_variable: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreateActionsVariableSchema.parse(args);
    const body = {
      name: parsed.name,
      value: parsed.value,
    };
    return await githubRequest(`/repos/${owner}/${repo}/actions/variables`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  update_actions_variable: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = UpdateActionsVariableSchema.parse(args);
    const body = {
      name: parsed.name,
      value: parsed.value,
    };
    return await githubRequest(`/repos/${owner}/${repo}/actions/variables/${encodeURIComponent(parsed.name)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  delete_actions_variable: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = DeleteActionsVariableSchema.parse(args);
    return await githubRequest(`/repos/${owner}/${repo}/actions/variables/${encodeURIComponent(parsed.name)}`, {
      method: "DELETE",
    });
  },

  list_actions_secrets: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListActionsSecretsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await githubRequest(`/repos/${owner}/${repo}/actions/secrets?${q.toString()}`);
    return {
      total_count: res.total_count,
      secrets: (res.secrets || []).map((s) => ({
        name: s.name,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
    };
  },
};
