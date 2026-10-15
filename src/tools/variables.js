import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeActionsVariable } from "../helpers.js";

export const ListActionsVariablesSchema = RepoParamsSchema.extend({
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const GetActionsVariableSchema = RepoParamsSchema.extend({
  name: z.string().describe("Variable name"),
});

export const CreateActionsVariableSchema = RepoParamsSchema.extend({
  name: z.string().describe("Variable name (e.g. 'ENV_STAGE')"),
  value: z.string().describe("Variable value"),
});

export const UpdateActionsVariableSchema = RepoParamsSchema.extend({
  name: z.string().describe("Variable name to update"),
  value: z.string().describe("New variable value"),
});

export const DeleteActionsVariableSchema = RepoParamsSchema.extend({
  name: z.string().describe("Variable name to delete"),
});

export const ListActionsSecretsSchema = RepoParamsSchema.extend({
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const variableTools = [
  {
    name: "list_actions_variables",
    description: "List GitHub Actions repository configuration variables",
    inputSchema: zodToJsonSchema(ListActionsVariablesSchema),
  },
  {
    name: "get_actions_variable",
    description: "Get value and metadata of a specific GitHub Actions repository variable",
    inputSchema: zodToJsonSchema(GetActionsVariableSchema),
  },
  {
    name: "create_actions_variable",
    description: "Create a new repository configuration variable for GitHub Actions",
    inputSchema: zodToJsonSchema(CreateActionsVariableSchema),
    mutating: true,
  },
  {
    name: "update_actions_variable",
    description: "Update the value of an existing GitHub Actions repository variable",
    inputSchema: zodToJsonSchema(UpdateActionsVariableSchema),
    mutating: true,
  },
  {
    name: "delete_actions_variable",
    description: "Delete a repository variable from GitHub Actions",
    inputSchema: zodToJsonSchema(DeleteActionsVariableSchema),
    mutating: true,
  },
  {
    name: "list_actions_secrets",
    description: "List GitHub Actions repository secret names (values remain masked and secure)",
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
