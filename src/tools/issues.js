import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest, formatLabels } from "../client.js";
import { summarizeIssue } from "../helpers.js";

export const ListIssuesSchema = RepoParamsSchema.extend({
  state: z.enum(["open", "closed", "all"]).optional().default("open").describe("Filter issues by state: 'open' (default), 'closed', or 'all'"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Label names to filter by (comma-separated string or array of strings, e.g. 'bug,enhancement')"),
  assignee: z.string().optional().describe("Filter by assignee username, or '*' for any assigned issue, or 'none' for unassigned"),
  creator: z.string().optional().describe("Filter issues created by this GitHub username"),
  milestone: z.union([z.string(), z.number()]).optional().describe("Filter by milestone number, or '*' for any milestone, or 'none' for no milestone"),
  sort: z.enum(["created", "updated", "comments"]).optional().default("created").describe("Sort issues by: 'created', 'updated', or 'comments' (default: 'created')"),
  direction: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort direction: 'asc' or 'desc' (default: 'desc')"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(30).describe("Number of issues per page (default: 30, max: 100)"),
});

export const GetIssueSchema = RepoParamsSchema.extend({
  issue_number: z.number().describe("The issue ticket number (e.g. 42)"),
});

export const CreateIssueSchema = RepoParamsSchema.extend({
  title: z.string().describe("Descriptive title for the issue ticket"),
  body: z.string().optional().describe("Markdown text containing detailed issue description, reproduction steps, or context"),
  assignees: z.array(z.string()).optional().describe("Array of GitHub usernames to assign to this issue"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Array or comma-separated string of label names to attach"),
  milestone: z.number().optional().describe("Milestone number to associate with this issue"),
});

export const UpdateIssueSchema = RepoParamsSchema.extend({
  issue_number: z.number().describe("The issue ticket number to update"),
  title: z.string().optional().describe("Updated title for the issue"),
  body: z.string().optional().describe("Updated description markdown text"),
  state: z.enum(["open", "closed"]).optional().describe("New state: 'open' or 'closed'"),
  state_reason: z.enum(["completed", "not_planned", "reopened"]).optional().describe("Reason for closing or reopening: 'completed', 'not_planned', or 'reopened'"),
  assignees: z.array(z.string()).optional().describe("Updated array of assigned usernames (replaces existing assignees)"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Updated array of label names (replaces existing labels)"),
  milestone: z.number().nullable().optional().describe("Milestone number to associate, or null to remove milestone association"),
});

export const ListIssueCommentsSchema = RepoParamsSchema.extend({
  issue_number: z.number().describe("Issue number to retrieve comments for"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(30).describe("Number of comments per page (default: 30, max: 100)"),
});

export const CreateIssueCommentSchema = RepoParamsSchema.extend({
  issue_number: z.number().describe("Issue number to post comment on"),
  body: z.string().describe("Markdown text of the comment"),
});

export const ListLabelsSchema = RepoParamsSchema.extend({
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(50).describe("Number of labels per page (default: 50, max: 100)"),
});

export const CreateLabelSchema = RepoParamsSchema.extend({
  name: z.string().describe("Label name (e.g. 'bug', 'documentation', 'p1')"),
  color: z.string().describe("6-character hexadecimal color code without '#' symbol (e.g. 'f29513', '0075ca')"),
  description: z.string().optional().describe("Brief description explaining when this label should be applied"),
});

export const issueTools = [
  {
    name: "list_issues",
    description: "Search and filter repository issue tickets by state, assignee, milestone, or labels. Note: Unlike the raw GitHub API, this tool filters out pull requests so only genuine issues are returned. For pull requests, use list_pull_requests instead. Returns concise metadata (numbers, titles, state reasons, labels) to minimize context token usage.",
    inputSchema: zodToJsonSchema(ListIssuesSchema),
  },
  {
    name: "get_issue",
    description: "Get full details of a specific issue ticket, including markdown body, assignees, milestone, state reason, and comment count. Use when investigating a bug report or reading issue specifications.",
    inputSchema: zodToJsonSchema(GetIssueSchema),
  },
  {
    name: "create_issue",
    description: "Create a new issue ticket in a repository with optional labels, assignees, and milestone. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CreateIssueSchema),
    mutating: true,
  },
  {
    name: "update_issue",
    description: "Update an existing issue's title, body, state ('open'/'closed'), state reason ('completed'/'not_planned'), labels, assignees, or milestone. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(UpdateIssueSchema),
    mutating: true,
  },
  {
    name: "list_issue_comments",
    description: "List discussion comments on an issue ticket chronologically. Use to read conversation history, debugging updates, or user feedback on an issue.",
    inputSchema: zodToJsonSchema(ListIssueCommentsSchema),
  },
  {
    name: "create_issue_comment",
    description: "Add a markdown comment to an issue ticket. Use to reply to discussions, log progress, or provide resolution details. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CreateIssueCommentSchema),
    mutating: true,
  },
  {
    name: "list_labels",
    description: "List all labels configured in a repository with their names, descriptions, and hex color codes. Use to discover available tags before creating or updating issues.",
    inputSchema: zodToJsonSchema(ListLabelsSchema),
  },
  {
    name: "create_label",
    description: "Create a new label in a repository with a name, description, and 6-character hex color code. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CreateLabelSchema),
    mutating: true,
  },
];

export const issueHandlers = {
  list_issues: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListIssuesSchema.parse(args);
    const q = new URLSearchParams({
      state: parsed.state,
      sort: parsed.sort,
      direction: parsed.direction,
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.assignee) q.set("assignee", parsed.assignee);
    if (parsed.creator) q.set("creator", parsed.creator);
    if (parsed.milestone !== undefined) q.set("milestone", parsed.milestone.toString());
    if (parsed.labels) {
      const formatted = formatLabels(parsed.labels);
      if (formatted && formatted.length > 0) {
        q.set("labels", formatted.join(","));
      }
    }

    const res = await githubRequest(`/repos/${owner}/${repo}/issues?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    // Filter out pull requests as GitHub returns PRs under issues endpoint
    return items.filter((item) => !item.pull_request).map((issue) => summarizeIssue(issue, true));
  },

  get_issue: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetIssueSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/issues/${parsed.issue_number}`);
    return summarizeIssue(res, false);
  },

  create_issue: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreateIssueSchema.parse(args);
    const body = {
      title: parsed.title,
      body: parsed.body,
      assignees: parsed.assignees,
      milestone: parsed.milestone,
    };
    if (parsed.labels) {
      body.labels = formatLabels(parsed.labels);
    }
    const res = await githubRequest(`/repos/${owner}/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizeIssue(res, false);
  },

  update_issue: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = UpdateIssueSchema.parse(args);
    const body = {};
    if (parsed.title !== undefined) body.title = parsed.title;
    if (parsed.body !== undefined) body.body = parsed.body;
    if (parsed.state !== undefined) body.state = parsed.state;
    if (parsed.state_reason !== undefined) body.state_reason = parsed.state_reason;
    if (parsed.assignees !== undefined) body.assignees = parsed.assignees;
    if (parsed.milestone !== undefined) body.milestone = parsed.milestone;
    if (parsed.labels !== undefined) {
      body.labels = formatLabels(parsed.labels);
    }

    const res = await githubRequest(`/repos/${owner}/${repo}/issues/${parsed.issue_number}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return summarizeIssue(res, false);
  },

  list_issue_comments: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListIssueCommentsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await githubRequest(`/repos/${owner}/${repo}/issues/${parsed.issue_number}/comments?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map((c) => ({
      id: c.id,
      user: c.user ? c.user.login : null,
      created_at: c.created_at,
      updated_at: c.updated_at,
      body: c.body,
      html_url: c.html_url,
    }));
  },

  create_issue_comment: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreateIssueCommentSchema.parse(args);
    const body = { body: parsed.body };
    return await githubRequest(`/repos/${owner}/${repo}/issues/${parsed.issue_number}/comments`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  list_labels: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListLabelsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await githubRequest(`/repos/${owner}/${repo}/labels?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      description: l.description,
    }));
  },

  create_label: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreateLabelSchema.parse(args);
    const body = {
      name: parsed.name,
      color: parsed.color.replace(/^#/, ""),
      description: parsed.description,
    };
    return await githubRequest(`/repos/${owner}/${repo}/labels`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
