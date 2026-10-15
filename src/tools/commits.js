import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeCommit, sliceDiff } from "../helpers.js";

export const ListCommitsSchema = RepoParamsSchema.extend({
  sha: z.string().optional().describe("SHA or branch to start listing commits from (default: default branch)"),
  path: z.string().optional().describe("Only commits containing this file path will be returned"),
  author: z.string().optional().describe("GitHub login or email address to filter by"),
  since: z.string().optional().describe("Only commits after this date (ISO 8601 format, e.g. '2026-01-01T00:00:00Z')"),
  until: z.string().optional().describe("Only commits before this date (ISO 8601 format)"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const GetCommitSchema = RepoParamsSchema.extend({
  ref: z.string().describe("Commit SHA, branch, or tag name to inspect"),
  file_path: z.string().optional().describe("Optional: filter diff to only inspect this specific file"),
  max_diff_lines: z.number().optional().default(400).describe("Maximum diff lines to return (default: 400)"),
});

export const commitTools = [
  {
    name: "list_commits",
    description: "List repository commit logs with author, date, and commit message summaries",
    inputSchema: zodToJsonSchema(ListCommitsSchema),
  },
  {
    name: "get_commit",
    description: "Get detailed commit information, file modification manifest, stats, and token-capped diffs",
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
    return items.map(summarizeCommit);
  },

  get_commit: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetCommitSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/commits/${encodeURIComponent(parsed.ref)}`);

    let files = res.files || [];
    if (parsed.file_path) {
      files = files.filter((f) => f.filename === parsed.file_path || f.previous_filename === parsed.file_path);
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
      files_count: files.length,
      files: filesManifest,
      html_url: res.html_url,
    };
  },
};
