import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";

// Schemas
export const GetRepositoryTopicsSchema = RepoParamsSchema.extend({});

export const SetRepositoryTopicsSchema = RepoParamsSchema.extend({
  names: z.array(z.string()).describe("Array of topic strings to assign to the repository (e.g. ['mcp', 'nodejs', 'ai-agent'])"),
});

export const ListRepositoryWebhooksSchema = RepoParamsSchema.extend({
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(10).describe("Number of webhooks per page (default: 10, max: 100)"),
});

export const GetRepositoryWebhookSchema = RepoParamsSchema.extend({
  hook_id: z.number().describe("Unique numeric identifier of the repository webhook"),
});

export const GetCommitStatusSchema = RepoParamsSchema.extend({
  ref: z.string().describe("Commit SHA, branch name, or tag to query combined status check for"),
});

export const CreateCommitStatusSchema = RepoParamsSchema.extend({
  sha: z.string().describe("Commit SHA to attach the status check to"),
  state: z.enum(["error", "failure", "pending", "success"]).describe("Status check state: 'error', 'failure', 'pending', or 'success'"),
  target_url: z.string().optional().describe("URL associating this status with an external build or report"),
  description: z.string().optional().describe("Short summary description of the status check"),
  context: z.string().optional().default("default").describe("Unique string label identifying the status system (default: 'default')"),
});

export const ListDependabotAlertsSchema = RepoParamsSchema.extend({
  state: z.enum(["auto_dismissed", "dismissed", "fixed", "open"]).optional().describe("Filter by alert state: 'auto_dismissed', 'dismissed', 'fixed', or 'open'"),
  severity: z.enum(["low", "medium", "high", "critical"]).optional().describe("Filter by security severity: 'low', 'medium', 'high', or 'critical'"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(10).describe("Number of alerts per page (default: 10, max: 100)"),
});

// Tool Definitions
export const extendedTools = [
  {
    name: "get_repository_topics",
    description: "Get all topic tags associated with a GitHub repository. Use to inspect project categories and discoverability keywords.",
    inputSchema: zodToJsonSchema(GetRepositoryTopicsSchema),
  },
  {
    name: "set_repository_topics",
    description: "Replace all topic tags on a repository with a new array of topic strings. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(SetRepositoryTopicsSchema),
    mutating: true,
  },
  {
    name: "list_repository_webhooks",
    description: "List configured event webhooks on a repository with target URLs, active status, and subscribed event triggers.",
    inputSchema: zodToJsonSchema(ListRepositoryWebhooksSchema),
  },
  {
    name: "get_repository_webhook",
    description: "Get detailed configuration of a specific repository webhook by ID, including delivery URL and subscribed events.",
    inputSchema: zodToJsonSchema(GetRepositoryWebhookSchema),
  },
  {
    name: "get_commit_status",
    description: "Get the combined status check state (pending, success, failure) and individual check runs for a commit SHA or branch ref.",
    inputSchema: zodToJsonSchema(GetCommitStatusSchema),
  },
  {
    name: "create_commit_status",
    description: "Set or update a commit status check (pending, success, failure, error) on a specific commit SHA. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CreateCommitStatusSchema),
    mutating: true,
  },
  {
    name: "list_dependabot_alerts",
    description: "List Dependabot vulnerability alerts for a repository, including affected package, severity (critical, high, medium, low), and patch advisory.",
    inputSchema: zodToJsonSchema(ListDependabotAlertsSchema),
  },
];

// Handlers
export const extendedHandlers = {
  get_repository_topics: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/topics`);
    return {
      names: res.names || [],
    };
  },

  set_repository_topics: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = SetRepositoryTopicsSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/topics`, {
      method: "PUT",
      body: JSON.stringify({ names: parsed.names }),
    });
    return {
      names: res.names || [],
    };
  },

  list_repository_webhooks: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListRepositoryWebhooksSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await githubRequest(`/repos/${owner}/${repo}/hooks?${q.toString()}`);
    const rawItems = Array.isArray(res) ? res : res.items || [];
    const items = rawItems.map((h) => ({
      id: h.id,
      name: h.name,
      active: h.active,
      events: h.events || [],
      config: {
        url: h.config?.url,
        content_type: h.config?.content_type,
      },
      updated_at: h.updated_at,
      created_at: h.created_at,
    }));
    return res.pagination ? { pagination: res.pagination, webhooks: items } : items;
  },

  get_repository_webhook: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetRepositoryWebhookSchema.parse(args);
    const h = await githubRequest(`/repos/${owner}/${repo}/hooks/${parsed.hook_id}`);
    return {
      id: h.id,
      name: h.name,
      active: h.active,
      events: h.events || [],
      config: {
        url: h.config?.url,
        content_type: h.config?.content_type,
      },
      updated_at: h.updated_at,
      created_at: h.created_at,
    };
  },

  get_commit_status: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetCommitStatusSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/commits/${encodeURIComponent(parsed.ref)}/status`);
    return {
      state: res.state,
      total_count: res.total_count,
      statuses: (res.statuses || []).map((s) => ({
        id: s.id,
        state: s.state,
        description: s.description,
        target_url: s.target_url,
        context: s.context,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
      sha: res.sha,
    };
  },

  create_commit_status: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreateCommitStatusSchema.parse(args);
    const body = {
      state: parsed.state,
      target_url: parsed.target_url,
      description: parsed.description,
      context: parsed.context,
    };
    const s = await githubRequest(`/repos/${owner}/${repo}/statuses/${encodeURIComponent(parsed.sha)}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      id: s.id,
      state: s.state,
      description: s.description,
      target_url: s.target_url,
      context: s.context,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  },

  list_dependabot_alerts: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListDependabotAlertsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.state) q.set("state", parsed.state);
    if (parsed.severity) q.set("severity", parsed.severity);

    const res = await githubRequest(`/repos/${owner}/${repo}/dependabot/alerts?${q.toString()}`);
    const rawItems = Array.isArray(res) ? res : res.items || [];
    const items = rawItems.map((a) => ({
      number: a.number,
      state: a.state,
      dependency: {
        package: a.dependency?.package?.name,
        ecosystem: a.dependency?.package?.ecosystem,
      },
      security_advisory: {
        ghsa_id: a.security_advisory?.ghsa_id,
        cve_id: a.security_advisory?.cve_id,
        summary: a.security_advisory?.summary,
        severity: a.security_advisory?.severity,
      },
      html_url: a.html_url,
      created_at: a.created_at,
      fixed_at: a.fixed_at,
    }));
    return res.pagination ? { pagination: res.pagination, alerts: items } : items;
  },
};
