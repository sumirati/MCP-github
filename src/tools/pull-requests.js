import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizePullRequest, sliceDiff, summarizePullRequestReview } from "../helpers.js";

export const ListPullRequestsSchema = RepoParamsSchema.extend({
  state: z.enum(["open", "closed", "all"]).optional().default("open").describe("Filter by PR state: 'open' (default), 'closed', or 'all'"),
  head: z.string().optional().describe("Filter by head user or branch (e.g. 'feature-branch' or 'octocat:feature-branch')"),
  base: z.string().optional().describe("Filter by base target branch (e.g. 'main')"),
  sort: z.enum(["created", "updated", "popularity", "long-running"]).optional().default("created").describe("Sort PRs by: 'created', 'updated', 'popularity', or 'long-running' (default: 'created')"),
  direction: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort direction: 'asc' or 'desc' (default: 'desc')"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(30).describe("Number of pull requests per page (default: 30, max: 100)"),
});

export const GetPullRequestSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("The pull request number (e.g. 42)"),
});

export const GetPullRequestDiffSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("The pull request number to fetch unified diff for (e.g. 42)"),
  max_lines: z.number().optional().default(400).describe("Maximum diff lines to return to preserve token context (default: 400)"),
});

export const CreatePullRequestSchema = RepoParamsSchema.extend({
  title: z.string().describe("Title summarizing the pull request changes"),
  head: z.string().describe("Source branch containing commits (e.g. 'feature/auth')"),
  base: z.string().describe("Target branch into which changes should be merged (e.g. 'main')"),
  body: z.string().optional().describe("Detailed pull request description markdown"),
  draft: z.boolean().optional().default(false).describe("Whether to open the PR as a draft (default: false)"),
});

export const UpdatePullRequestSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number to modify"),
  title: z.string().optional().describe("Updated pull request title"),
  body: z.string().optional().describe("Updated description markdown"),
  state: z.enum(["open", "closed"]).optional().describe("New state: 'open' to reopen or 'closed' to close without merging"),
  base: z.string().optional().describe("New target base branch"),
});

export const MergePullRequestSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number to merge"),
  commit_title: z.string().optional().describe("Custom merge commit title"),
  commit_message: z.string().optional().describe("Custom extended commit log message"),
  merge_method: z.enum(["merge", "squash", "rebase"]).optional().default("merge").describe("Merge strategy: 'merge' (create merge commit), 'squash' (squash all commits into one), or 'rebase' (rebase commits onto base branch). Default: 'merge'"),
});

export const ListPullRequestCommentsSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number to list inline comments for"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(30).describe("Number of comments per page (default: 30, max: 100)"),
});

export const CreatePullRequestCommentSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number to comment on"),
  body: z.string().describe("Markdown text of the inline review comment"),
  commit_id: z.string().describe("Full SHA of the specific commit being commented on"),
  path: z.string().describe("Relative repository file path of the file being commented on"),
  line: z.number().describe("Line index in the unified diff to anchor the review comment"),
});

export const CreatePullRequestReplySchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number"),
  comment_id: z.number().describe("Parent comment ID to reply to"),
  body: z.string().describe("Markdown reply text"),
});

export const ListPullRequestReviewsSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number to list reviews for"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(30).describe("Number of reviews per page (default: 30, max: 100)"),
});

export const CreatePullRequestReviewSchema = RepoParamsSchema.extend({
  pull_number: z.number().describe("Pull request number to review"),
  event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]).describe("Review decision action: 'APPROVE', 'REQUEST_CHANGES', or 'COMMENT'"),
  body: z.string().optional().describe("Overall review summary comment in markdown"),
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
    description: "List and filter pull requests in a repository with token-saving summary metadata. Use when locating active PRs, checking open PR numbers, or filtering by author/branch. To view code changes, use get_pull_request_diff; for non-PR issue tickets, use list_issues.",
    inputSchema: zodToJsonSchema(ListPullRequestsSchema),
  },
  {
    name: "get_pull_request",
    description: "Get detailed status of a specific pull request including mergeability (clean, dirty, unstable), head/base branch refs, author, and assignees. Use to check if a PR is ready to merge or blocked. Do NOT use to read code changes; use get_pull_request_diff instead.",
    inputSchema: zodToJsonSchema(GetPullRequestSchema),
  },
  {
    name: "get_pull_request_diff",
    description: "Retrieve unified git diff for a pull request to review code modifications. Use this tool when analyzing code changes, reviewing patches, or preparing inline comments. Do NOT use for checking PR mergeability or metadata (use get_pull_request instead). Diffs are token-optimized and automatically truncated at max_lines (default: 400 lines) to prevent LLM context overflows.",
    inputSchema: zodToJsonSchema(GetPullRequestDiffSchema),
  },
  {
    name: "create_pull_request",
    description: "Create a new pull request from a head branch into a base branch. Requires write permissions and GITHUB_READ_ONLY=false. The head branch must already exist and have at least one commit difference from the base branch.",
    inputSchema: zodToJsonSchema(CreatePullRequestSchema),
    mutating: true,
  },
  {
    name: "update_pull_request",
    description: "Update an existing pull request's title, body, open/closed state, or base branch. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(UpdatePullRequestSchema),
    mutating: true,
  },
  {
    name: "merge_pull_request",
    description: "Merge a pull request into its base branch using merge, squash, or rebase method. Requires write/admin permissions and GITHUB_READ_ONLY=false. Ensure the PR mergeable state is clean before merging.",
    inputSchema: zodToJsonSchema(MergePullRequestSchema),
    mutating: true,
  },
  {
    name: "list_pull_request_comments",
    description: "List inline code review comments anchored to specific diff lines of a pull request. Use when inspecting line-by-line review feedback. For overall PR review approvals or change requests, use list_pull_request_reviews instead.",
    inputSchema: zodToJsonSchema(ListPullRequestCommentsSchema),
  },
  {
    name: "create_pull_request_comment",
    description: "Post an inline review comment anchored to a specific file and line in the pull request diff. Requires commit_id, path, and line index. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CreatePullRequestCommentSchema),
    mutating: true,
  },
  {
    name: "create_pull_request_reply",
    description: "Reply to an existing pull request review comment thread. Requires comment_id of the parent comment. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CreatePullRequestReplySchema),
    mutating: true,
  },
  {
    name: "list_pull_request_reviews",
    description: "List formal code reviews (approvals, change requests, comment summaries) submitted on a pull request. Use to check reviewer decisions and approval gates before merging.",
    inputSchema: zodToJsonSchema(ListPullRequestReviewsSchema),
  },
  {
    name: "create_pull_request_review",
    description: "Submit a formal code review on a pull request with an approval decision (APPROVE, REQUEST_CHANGES, or COMMENT) and optional summary body or inline comments. Requires write permissions and GITHUB_READ_ONLY=false.",
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
