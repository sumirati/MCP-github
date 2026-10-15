import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { githubRequest, isReadOnly } from "../client.js";
import { summarizeUser, summarizeRepository } from "../helpers.js";

export const SystemHealthCheckSchema = z.object({});

export const GetAuthenticatedUserSchema = z.object({});

export const GetUserSchema = z.object({
  username: z.string().describe("GitHub username to retrieve public profile for (e.g. 'octocat')"),
});

export const ListUserOrganizationsSchema = z.object({
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(30).describe("Number of organizations per page (default: 30, max: 100)"),
});

export const ListAccessibleRepositoriesSchema = z.object({
  visibility: z.enum(["all", "public", "private"]).optional().default("all").describe("Filter repositories by visibility: 'all' (default), 'public', or 'private'"),
  affiliation: z.string().optional().default("owner,collaborator,organization_member").describe("Comma-separated list of affiliations: 'owner', 'collaborator', 'organization_member' (default: 'owner,collaborator,organization_member')"),
  sort: z.enum(["created", "updated", "pushed", "full_name"]).optional().default("updated").describe("Sort repositories by: 'created', 'updated' (default), 'pushed', or 'full_name'"),
  direction: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort direction: 'asc' or 'desc' (default: 'desc')"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(30).describe("Number of repositories per page (default: 30, max: 100)"),
});

export const userTools = [
  {
    name: "system_health_check",
    description: "Perform end-to-end connectivity, latency, rate limit quota, and permission diagnostics against the GitHub API. Verifies token validity, authenticated account details, remaining rate limits, and active read-only policy.",
    inputSchema: zodToJsonSchema(SystemHealthCheckSchema),
  },
  {
    name: "get_authenticated_user",
    description: "Retrieve profile metadata (login, name, email, public_repos, followers) for the currently authenticated GitHub token. Use to verify token identity and scope.",
    inputSchema: zodToJsonSchema(GetAuthenticatedUserSchema),
  },
  {
    name: "get_user",
    description: "Retrieve public profile information (login, name, company, bio, public_repos count) for any specified GitHub user by username.",
    inputSchema: zodToJsonSchema(GetUserSchema),
  },
  {
    name: "list_user_organizations",
    description: "List GitHub organizations that the authenticated user belongs to. Use to discover org namespaces for creating or querying repositories.",
    inputSchema: zodToJsonSchema(ListUserOrganizationsSchema),
  },
  {
    name: "list_accessible_repositories",
    description: "List repositories accessible to the authenticated user (owned, collaborated on, or member of). Use to discover available repositories across accounts.",
    inputSchema: zodToJsonSchema(ListAccessibleRepositoriesSchema),
  },
];

export const userHandlers = {
  system_health_check: async () => {
    const startTime = Date.now();
    const [userRes, rateLimitRes] = await Promise.all([
      githubRequest("/user"),
      githubRequest("/rate_limit").catch(() => null),
    ]);
    const latencyMs = Date.now() - startTime;
    return {
      status: "healthy",
      api_latency_ms: latencyMs,
      read_only_mode: isReadOnly(),
      authenticated_user: {
        login: userRes.login,
        id: userRes.id,
        name: userRes.name,
        type: userRes.type,
        plan: userRes.plan?.name,
      },
      rate_limit: rateLimitRes?.rate
        ? {
            limit: rateLimitRes.rate.limit,
            remaining: rateLimitRes.rate.remaining,
            reset: new Date(rateLimitRes.rate.reset * 1000).toISOString(),
            used: rateLimitRes.rate.used,
          }
        : null,
    };
  },

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
