import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeCommit, sliceDiff } from "../helpers.js";

export const ListCommitsSchema = RepoParamsSchema.extend({
  sha: z.string().optional().describe("SHA or branch to start listing commits from (default: repository default branch)"),
  path: z.string().optional().describe("Filter to only return commits that affected this specific file path"),
  author: z.string().optional().describe("Filter by author GitHub username or email address"),
  since: z.string().optional().describe("Only return commits pushed on or after this timestamp (ISO 8601 format, e.g. '2026-01-01T00:00:00Z')"),
  until: z.string().optional().describe("Only return commits pushed on or before this timestamp (ISO 8601 format)"),
  with_message: z.boolean().optional().default(false).describe("If true, includes full multi-paragraph commit message body. Default is false (headline only) to conserve tokens."),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().min(1).max(100).optional().default(30).describe("Number of commits per page (default: 30, max: 100)"),
});

export const GetCommitSchema = RepoParamsSchema.extend({
  ref: z.string().describe("Commit SHA, branch name, or tag reference to inspect"),
  file_path: z.string().optional().describe("Optional file path filter: only include diff and stats for this single file"),
  max_diff_lines: z.number().optional().default(400).describe("Maximum unified diff lines to return across files to conserve LLM context tokens (default: 400)"),
});

export const commitTools = [
  {
    name: "list_commits",
    description: "List repository commit history chronologically with upstream filtering (sha, path, author, since, until) and capped pagination (max 100). For viewing actual line-by-line diffs of a commit, use get_commit instead.",
    inputSchema: zodToJsonSchema(ListCommitsSchema),
  },
  {
    name: "get_commit",
    description: "Get detailed commit metadata, file modification statistics, and unified diffs for a specific commit SHA or ref. Use when reviewing code changes in a commit or debugging regressions. Diffs are token-budget optimized and truncated at max_diff_lines (default: 400 lines).",
    inputSchema: zodToJsonSchema(GetCommitSchema),
  },
];

export const commitHandlers = {
  list_commits: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListCommitsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.sha) q.set("sha", parsed.sha);
    if (parsed.path) q.set("path", parsed.path);
    if (parsed.author) q.set("author", parsed.author);
    if (parsed.since) q.set("since", parsed.since);
    if (parsed.until) q.set("until", parsed.until);

    const res = await githubRequest(`/repos/${owner}/${repo}/commits?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map((c) => summarizeCommit(c, { full_message: parsed.with_message }));
  },

  get_commit: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetCommitSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/commits/${encodeURIComponent(parsed.ref)}`);

    let files = res.files || [];
    const totalFilesCount = files.length;
    let diffNote;
    if (parsed.file_path) {
      files = files.filter((f) => f.filename === parsed.file_path || f.previous_filename === parsed.file_path);
    } else if (files.length > 10) {
      diffNote = `Commit contains ${totalFilesCount} files. Showing diffs for first 10 files. Use file_path parameter to inspect others.`;
      files = files.slice(0, 10);
    }

    const filesManifest = files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch ? sliceDiff(f.patch, parsed.max_diff_lines) : null,
    }));

    return {
      sha: res.sha,
      short_sha: res.sha ? res.sha.slice(0, 7) : null,
      message: res.commit?.message,
      author: {
        name: res.commit?.author?.name,
        email: res.commit?.author?.email,
        date: res.commit?.author?.date,
      },
      stats: res.stats || null,
      files_count: totalFilesCount,
      ...(diffNote ? { diff_note: diffNote } : {}),
      files: filesManifest,
      html_url: res.html_url,
    };
  },
};
