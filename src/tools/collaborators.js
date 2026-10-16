import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeCollaborator } from "../helpers.js";

export const ListCollaboratorsSchema = RepoParamsSchema.extend({
  affiliation: z.enum(["outside", "direct", "all"]).optional().default("all").describe("Filter collaborators by affiliation: 'outside' (outside collaborators), 'direct' (direct permissions), or 'all' (default)"),
  permission: z.enum(["pull", "triage", "push", "maintain", "admin"]).optional().describe("Filter collaborators by permission level: 'pull', 'triage', 'push', 'maintain', or 'admin'"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(10).describe("Number of collaborators per page (default: 10, max: 100)"),
});

export const GetCollaboratorPermissionSchema = RepoParamsSchema.extend({
  username: z.string().describe("GitHub username whose repository permissions to inspect (e.g. 'octocat')"),
});

export const AddCollaboratorSchema = RepoParamsSchema.extend({
  username: z.string().describe("GitHub username to add or invite as a collaborator"),
  permission: z.enum(["pull", "triage", "push", "maintain", "admin"]).optional().default("push").describe("Permission level to grant: 'pull' (read), 'triage' (triage issues/PRs), 'push' (write, default), 'maintain' (maintain repository), or 'admin' (full administrative access)"),
});

export const RemoveCollaboratorSchema = RepoParamsSchema.extend({
  username: z.string().describe("GitHub username to remove from repository collaborators"),
});

export const collaboratorTools = [
  {
    name: "list_collaborators",
    description: "List collaborators who have access to a repository along with their assigned roles and permissions. Use to audit team access or check user memberships.",
    inputSchema: zodToJsonSchema(ListCollaboratorsSchema),
  },
  {
    name: "get_collaborator_permission",
    description: "Check a specific user's exact permission level ('admin', 'maintain', 'write', 'triage', 'read', or 'none') on a repository. Use to verify authorization before attempting privileged operations.",
    inputSchema: zodToJsonSchema(GetCollaboratorPermissionSchema),
  },
  {
    name: "add_collaborator",
    description: "Add or invite a GitHub user to collaborate on a repository with a specified permission level. If the user is not an organization member, this sends a collaboration invitation. Requires admin permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(AddCollaboratorSchema),
    mutating: true,
  },
  {
    name: "remove_collaborator",
    description: "Remove a collaborator from a repository, revoking their direct access. Requires admin permissions and GITHUB_READ_ONLY=false.",
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
