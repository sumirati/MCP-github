import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeCollaborator } from "../helpers.js";

export const ListCollaboratorsSchema = RepoParamsSchema.extend({
  affiliation: z.enum(["outside", "direct", "all"]).optional().default("all"),
  permission: z.enum(["pull", "triage", "push", "maintain", "admin"]).optional(),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const GetCollaboratorPermissionSchema = RepoParamsSchema.extend({
  username: z.string().describe("GitHub username to check"),
});

export const AddCollaboratorSchema = RepoParamsSchema.extend({
  username: z.string().describe("GitHub username to add as collaborator"),
  permission: z.enum(["pull", "triage", "push", "maintain", "admin"]).optional().default("push").describe("Permission level"),
});

export const RemoveCollaboratorSchema = RepoParamsSchema.extend({
  username: z.string().describe("GitHub username to remove from repository collaborators"),
});

export const collaboratorTools = [
  {
    name: "list_collaborators",
    description: "List collaborators and their permission levels on a repository",
    inputSchema: zodToJsonSchema(ListCollaboratorsSchema),
  },
  {
    name: "get_collaborator_permission",
    description: "Check a user's exact permission level on a repository",
    inputSchema: zodToJsonSchema(GetCollaboratorPermissionSchema),
  },
  {
    name: "add_collaborator",
    description: "Add or invite a user as a repository collaborator with specified permission",
    inputSchema: zodToJsonSchema(AddCollaboratorSchema),
    mutating: true,
  },
  {
    name: "remove_collaborator",
    description: "Remove a collaborator from a repository",
    inputSchema: zodToJsonSchema(RemoveCollaboratorSchema),
    mutating: true,
  },
];

export const collaboratorHandlers = {
  list_collaborators: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListCollaboratorsSchema.parse(args);
    const q = new URLSearchParams({
      affiliation: parsed.affiliation,
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.permission) q.set("permission", parsed.permission);

    const res = await githubRequest(`/repos/${owner}/${repo}/collaborators?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map(summarizeCollaborator);
  },

  get_collaborator_permission: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetCollaboratorPermissionSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/collaborators/${encodeURIComponent(parsed.username)}/permission`);
    return {
      username: parsed.username,
      permission: res.permission,
      role_name: res.role_name,
      user: summarizeCollaborator(res.user),
    };
  },

  add_collaborator: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = AddCollaboratorSchema.parse(args);
    const body = { permission: parsed.permission };
    const res = await githubRequest(
      `/repos/${owner}/${repo}/collaborators/${encodeURIComponent(parsed.username)}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      }
    );
    return res;
  },

  remove_collaborator: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = RemoveCollaboratorSchema.parse(args);
    return await githubRequest(
      `/repos/${owner}/${repo}/collaborators/${encodeURIComponent(parsed.username)}`,
      {
        method: "DELETE",
      }
    );
  },
};
