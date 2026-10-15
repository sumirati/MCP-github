import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest, formatLabels } from "../client.js";
import { summarizeIssue } from "../helpers.js";

export const ListIssuesSchema = RepoParamsSchema.extend({
  state: z.enum(["open", "closed", "all"]).optional().default("open"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Label names (comma-separated string or array)"),
  assignee: z.string().optional().describe("Filter by assignee username ('*' for any, 'none' for unassigned)"),
  creator: z.string().optional().describe("Filter by author username"),
  milestone: z.union([z.string(), z.number()]).optional().describe("Milestone number or '*' for any or 'none' for unassigned"),
  sort: z.enum(["created", "updated", "comments"]).optional().default("created"),
  direction: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const GetIssueSchema = RepoParamsSchema.extend({
  issue_number: z.number().describe("Issue number"),
});

export const CreateIssueSchema = RepoParamsSchema.extend({
  title: z.string().describe("Issue title"),
  body: z.string().optional().describe("Issue markdown body"),
  assignees: z.array(z.string()).optional().describe("Usernames to assign"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Labels to attach"),
  milestone: z.number().optional().describe("Milestone number to associate"),
});

export const UpdateIssueSchema = RepoParamsSchema.extend({
  issue_number: z.number().describe("Issue number"),
  title: z.string().optional().describe("Updated title"),
  body: z.string().optional().describe("Updated markdown body"),
  state: z.enum(["open", "closed"]).optional().describe("Issue state"),
  state_reason: z.enum(["completed", "not_planned", "reopened"]).optional().describe("Reason for state change"),
  assignees: z.array(z.string()).optional().describe("Updated assignees array"),
  labels: z.union([z.string(), z.array(z.string())]).optional().describe("Updated labels array"),
  milestone: z.number().nullable().optional().describe("Milestone number or null to remove"),
});

export const ListIssueCommentsSchema = RepoParamsSchema.extend({
  issue_number: z.number().describe("Issue number"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const CreateIssueCommentSchema = RepoParamsSchema.extend({
  issue_number: z.number().describe("Issue number"),
  body: z.string().describe("Comment markdown text"),
});

export const ListLabelsSchema = RepoParamsSchema.extend({
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(50),
});

export const CreateLabelSchema = RepoParamsSchema.extend({
  name: z.string().describe("Label name"),
  color: z.string().describe("6-character hex code without # (e.g. 'f29513')"),
  description: z.string().optional().describe("Short label description"),
});

export const issueTools = [
  {
    name: "list_issues",
    description: "List issues in a repository with token-saving summary metadata",
    inputSchema: zodToJsonSchema(ListIssuesSchema),
  },
  {
    name: "get_issue",
    description: "Get detailed issue information including full description",
    inputSchema: zodToJsonSchema(GetIssueSchema),
  },
  {
    name: "create_issue",
    description: "Create a new issue in a repository",
    inputSchema: zodToJsonSchema(CreateIssueSchema),
    mutating: true,
  },
  {
    name: "update_issue",
    description: "Update an existing issue (title, body, state, labels, assignees)",
    inputSchema: zodToJsonSchema(UpdateIssueSchema),
    mutating: true,
  },
  {
    name: "list_issue_comments",
    description: "List comments on an issue",
    inputSchema: zodToJsonSchema(ListIssueCommentsSchema),
  },
  {
    name: "create_issue_comment",
    description: "Add a comment to an issue",
    inputSchema: zodToJsonSchema(CreateIssueCommentSchema),
    mutating: true,
  },
  {
    name: "list_labels",
    description: "List all labels available in a repository",
    inputSchema: zodToJsonSchema(ListLabelsSchema),
  },
  {
    name: "create_label",
    description: "Create a new label in a repository",
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
