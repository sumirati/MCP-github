import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeUser, summarizeRepository } from "../helpers.js";

export const GetAuthenticatedUserSchema = z.object({});

export const GetUserSchema = z.object({
  username: z.string().describe("GitHub username (e.g. 'octocat')"),
});

export const ListUserOrganizationsSchema = z.object({
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const ListAccessibleRepositoriesSchema = z.object({
  visibility: z.enum(["all", "public", "private"]).optional().default("all"),
  affiliation: z.string().optional().default("owner,collaborator,organization_member").describe("Comma-separated list of affiliations"),
  sort: z.enum(["created", "updated", "pushed", "full_name"]).optional().default("updated"),
  direction: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const userTools = [
  {
    name: "get_authenticated_user",
    description: "Get profile information for the authenticated GitHub user/token",
    inputSchema: zodToJsonSchema(GetAuthenticatedUserSchema),
  },
  {
    name: "get_user",
    description: "Get public profile information for any GitHub user",
    inputSchema: zodToJsonSchema(GetUserSchema),
  },
  {
    name: "list_user_organizations",
    description: "List organizations the authenticated user belongs to",
    inputSchema: zodToJsonSchema(ListUserOrganizationsSchema),
  },
  {
    name: "list_accessible_repositories",
    description: "List repositories accessible to the authenticated user",
    inputSchema: zodToJsonSchema(ListAccessibleRepositoriesSchema),
  },
];

export const userHandlers = {
  get_authenticated_user: async () => {
    const res = await githubRequest("/user");
    return summarizeUser(res);
  },

  get_user: async (args) => {
    const parsed = GetUserSchema.parse(args);
    const res = await githubRequest(`/users/${encodeURIComponent(parsed.username)}`);
    return summarizeUser(res);
  },

  list_user_organizations: async (args) => {
    const parsed = ListUserOrganizationsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await githubRequest(`/user/orgs?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map((org) => ({
      id: org.id,
      login: org.login,
      description: org.description,
      html_url: `https://github.com/${org.login}`,
    }));
  },

  list_accessible_repositories: async (args) => {
    const parsed = ListAccessibleRepositoriesSchema.parse(args);
    const q = new URLSearchParams({
      visibility: parsed.visibility,
      affiliation: parsed.affiliation,
      sort: parsed.sort,
      direction: parsed.direction,
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await githubRequest(`/user/repos?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map(summarizeRepository);
  },
};
