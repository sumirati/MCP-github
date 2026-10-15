import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizePullRequest, sliceDiff, summarizePullRequestReview } from "../helpers.js";

export const ListPullRequestsSchema = RepoParamsSchema.extend({
  state: z.enum(["open", "closed", "all"]).optional().default("open").describe("State of pull requests (default: open)"),
  head: z.string().optional().describe("Filter by head user or branch (e.g. 'feature-branch' or 'user:branch')"),
  base: z.string().optional().describe("Filter by base branch (e.g. 'main')"),
  sort: z.enum(["created", "updated", "popularity", "long-running"]).optional().default("created"),
  direction: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const GetPullRequestSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number (e.g. 42)"),
});

export const GetPullRequestDiffSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number"),
  max_lines: z.number().optional().default(400).describe("Maximum diff lines to return to preserve token context (default: 400)"),
});

export const CreatePullRequestSchema = RepoParamsSchema.extend({
  title: z.string().describe("Title of the pull request"),
  head: z.string().describe("Branch containing changes (e.g. 'feature/auth')"),
  base: z.string().describe("Branch into which changes should be merged (e.g. 'main')"),
  body: z.string().optional().describe("Pull request description"),
  draft: z.boolean().optional().default(false).describe("Whether to create as draft PR"),
});

export const UpdatePullRequestSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number"),
  title: z.string().optional().describe("Updated PR title"),
  body: z.string().optional().describe("Updated PR body"),
  state: z.enum(["open", "closed"]).optional().describe("Open or close PR"),
  base: z.string().optional().describe("Target branch to merge into"),
});

export const MergePullRequestSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number"),
  commit_title: z.string().optional().describe("Commit message title"),
  commit_message: z.string().optional().describe("Extended commit message"),
  merge_method: z.enum(["merge", "squash", "rebase"]).optional().default("merge").describe("Merge strategy"),
});

export const ListPullRequestCommentsSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const CreatePullRequestCommentSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number"),
  body: z.string().describe("Comment text"),
  commit_id: z.string().describe("SHA of commit being commented on"),
  path: z.string().describe("Relative path of file being commented on"),
  line: z.number().describe("Line index in diff to attach comment to"),
});

export const CreatePullRequestReplySchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number"),
  comment_id: z.number().describe("Comment ID to reply to"),
  body: z.string().describe("Reply text"),
});

export const ListPullRequestReviewsSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const CreatePullRequestReviewSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number"),
  event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]).describe("Review event action"),
  body: z.string().optional().describe("Summary review comment markdown"),
  comments: z
    .array(
      z.object({
        path: z.string().describe("Relative file path being reviewed"),
        position: z.number().optional().describe("Line index in diff"),
        body: z.string().describe("Review comment text"),
      })
    )
    .optional()
    .describe("Optional inline draft comments to submit with the review"),
});

export const pullRequestTools = [
  {
    name: "list_pull_requests",
    description: "List pull requests for a repository with summarized metadata",
    inputSchema: zodToJsonSchema(ListPullRequestsSchema),
  },
  {
    name: "get_pull_request",
    description: "Get detailed pull request information",
    inputSchema: zodToJsonSchema(GetPullRequestSchema),
  },
  {
    name: "get_pull_request_diff",
    description: "Get token-sliced diff of a pull request",
    inputSchema: zodToJsonSchema(GetPullRequestDiffSchema),
  },
  {
    name: "create_pull_request",
    description: "Create a new pull request",
    inputSchema: zodToJsonSchema(CreatePullRequestSchema),
    mutating: true,
  },
  {
    name: "update_pull_request",
    description: "Update pull request title, body, or state",
    inputSchema: zodToJsonSchema(UpdatePullRequestSchema),
    mutating: true,
  },
  {
    name: "merge_pull_request",
    description: "Merge a pull request (merge, squash, or rebase)",
    inputSchema: zodToJsonSchema(MergePullRequestSchema),
    mutating: true,
  },
  {
    name: "list_pull_request_comments",
    description: "List review comments on a pull request",
    inputSchema: zodToJsonSchema(ListPullRequestCommentsSchema),
  },
  {
    name: "create_pull_request_comment",
    description: "Post an inline review comment on a pull request diff",
    inputSchema: zodToJsonSchema(CreatePullRequestCommentSchema),
    mutating: true,
  },
  {
    name: "create_pull_request_reply",
    description: "Reply to an existing pull request review comment thread",
    inputSchema: zodToJsonSchema(CreatePullRequestReplySchema),
    mutating: true,
  },
  {
    name: "list_pull_request_reviews",
    description: "List formal code reviews (approvals, change requests) on a pull request",
    inputSchema: zodToJsonSchema(ListPullRequestReviewsSchema),
  },
  {
    name: "create_pull_request_review",
    description: "Submit a formal code review (APPROVE, REQUEST_CHANGES, or COMMENT)",
    inputSchema: zodToJsonSchema(CreatePullRequestReviewSchema),
    mutating: true,
  },
];

export const pullRequestHandlers = {
  list_pull_requests: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListPullRequestsSchema.parse(args);
    const q = new URLSearchParams({
      state: parsed.state,
      sort: parsed.sort,
      direction: parsed.direction,
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.head) q.set("head", parsed.head);
    if (parsed.base) q.set("base", parsed.base);

    const res = await githubRequest(`/repos/${owner}/${repo}/pulls?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map((pr) => summarizePullRequest(pr, true));
  },

  get_pull_request: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetPullRequestSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/pulls/${parsed.pull_number}`);
    return summarizePullRequest(res, false);
  },

  get_pull_request_diff: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetPullRequestDiffSchema.parse(args);
    const diffRaw = await githubRequest(
      `/repos/${owner}/${repo}/pulls/${parsed.pull_number}`,
      {
        headers: {
          Accept: "application/vnd.github.v3.diff",
        },
      },
      "text"
    );
    return {
      pull_number: parsed.pull_number,
      diff: sliceDiff(diffRaw, parsed.max_lines),
    };
  },

  create_pull_request: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreatePullRequestSchema.parse(args);
    const body = {
      title: parsed.title,
      head: parsed.head,
      base: parsed.base,
      body: parsed.body,
      draft: parsed.draft,
    };
    const res = await githubRequest(`/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizePullRequest(res, false);
  },

  update_pull_request: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = UpdatePullRequestSchema.parse(args);
    const body = {};
    if (parsed.title !== undefined) body.title = parsed.title;
    if (parsed.body !== undefined) body.body = parsed.body;
    if (parsed.state !== undefined) body.state = parsed.state;
    if (parsed.base !== undefined) body.base = parsed.base;

    const res = await githubRequest(`/repos/${owner}/${repo}/pulls/${parsed.pull_number}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return summarizePullRequest(res, false);
  },

  merge_pull_request: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = MergePullRequestSchema.parse(args);
    const body = {
      commit_title: parsed.commit_title,
      commit_message: parsed.commit_message,
      merge_method: parsed.merge_method,
    };
    return await githubRequest(`/repos/${owner}/${repo}/pulls/${parsed.pull_number}/merge`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  list_pull_request_comments: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListPullRequestCommentsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await githubRequest(`/repos/${owner}/${repo}/pulls/${parsed.pull_number}/comments?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map((c) => ({
      id: c.id,
      path: c.path,
      line: c.line || c.original_line,
      user: c.user ? c.user.login : null,
      body: c.body,
      created_at: c.created_at,
      html_url: c.html_url,
    }));
  },

  create_pull_request_comment: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreatePullRequestCommentSchema.parse(args);
    const body = {
      body: parsed.body,
      commit_id: parsed.commit_id,
      path: parsed.path,
      line: parsed.line,
    };
    return await githubRequest(`/repos/${owner}/${repo}/pulls/${parsed.pull_number}/comments`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  create_pull_request_reply: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreatePullRequestReplySchema.parse(args);
    const body = {
      body: parsed.body,
      in_reply_to: parsed.comment_id,
    };
    return await githubRequest(`/repos/${owner}/${repo}/pulls/${parsed.pull_number}/comments`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  list_pull_request_reviews: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListPullRequestReviewsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await githubRequest(`/repos/${owner}/${repo}/pulls/${parsed.pull_number}/reviews?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map(summarizePullRequestReview);
  },

  create_pull_request_review: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreatePullRequestReviewSchema.parse(args);
    const body = {
      event: parsed.event,
      ...(parsed.body ? { body: parsed.body } : {}),
      ...(parsed.comments ? { comments: parsed.comments } : {}),
    };
    const res = await githubRequest(`/repos/${owner}/${repo}/pulls/${parsed.pull_number}/reviews`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizePullRequestReview(res);
  },
};
