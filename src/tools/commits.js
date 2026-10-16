import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeCommit, sliceDiff, isLockfile } from "../helpers.js";

export const ListCommitsSchema = RepoParamsSchema.extend({
  sha: z.string().optional().describe("SHA or branch to start listing commits from (default: repository default branch)"),
  path: z.string().optional().describe("Filter to only return commits that affected this specific file path"),
  author: z.string().optional().describe("Filter by author GitHub username or email address"),
  since: z.string().optional().describe("Only return commits pushed on or after this timestamp (ISO 8601 format, e.g. '2026-01-01T00:00:00Z')"),
  until: z.string().optional().describe("Only return commits pushed on or before this timestamp (ISO 8601 format)"),
  with_message: z.boolean().optional().default(false).describe("If true, includes full multi-paragraph commit message body. Default is false (headline only) to conserve tokens."),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().min(1).max(100).optional().default(10).describe("Number of commits per page (default: 10, max: 100)"),
});

export const GetCommitSchema = RepoParamsSchema.extend({
  ref: z.string().describe("Commit SHA, branch name, or tag reference to inspect"),
  path: z.string().optional().describe("Optional file path filter: only include diff and stats for this single file"),
  max_diff_lines: z.number().optional().default(400).describe("Maximum unified diff lines to return across files to conserve LLM context tokens (default: 400)"),
  ignore_lockfiles: z.boolean().optional().default(true).describe("If true, automatically collapses diffs for lockfiles and minified assets (default: true)"),
  format: z.enum(["json", "markdown"]).optional().default("markdown").describe("Output format: 'markdown' (default) or 'json'"),
});

export const CreateCommitSchema = RepoParamsSchema.extend({
  branch: z.string().describe("Target branch name to commit changes to (e.g. 'main' or 'feature/auth')"),
  message: z.string().min(1).describe("Clear Git commit message describing the atomic changes"),
  files: z
    .array(
      z.object({
        path: z.string().min(1).describe("File path relative to repository root (e.g. 'src/index.js')"),
        action: z.enum(["create", "update", "delete"]).optional().default("update").describe("File operation: 'create', 'update', or 'delete' (default: 'update')"),
        content: z.string().optional().describe("Full content of the file to write (required for 'create' and 'update'; omit for 'delete')"),
      })
    )
    .min(1)
    .describe("Array of files to create, update, or delete atomically in a single Git commit"),
});

export const PushFilesSchema = CreateCommitSchema;

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
  {
    name: "create_commit",
    description: "Create an atomic Git commit with multiple created, updated, or deleted files using the GitHub Git Trees API. Use when refactoring, applying multi-file code changes, or updating code and docs together. Avoids multiple individual single-file commits and does not require local git cloning. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CreateCommitSchema),
    mutating: true,
  },
  {
    name: "push_files",
    description: "Alias for 'create_commit': atomically commit additions, modifications, or deletions to multiple files in a single Git commit via the GitHub Git Database API. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(PushFilesSchema),
    mutating: true,
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
    const rawItems = Array.isArray(res) ? res : res.items || [];
    const items = rawItems.map((c) => summarizeCommit(c, { full_message: parsed.with_message }));
    return res.pagination ? { pagination: res.pagination, commits: items } : items;
  },

  get_commit: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetCommitSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/commits/${encodeURIComponent(parsed.ref)}`);

    let files = res.files || [];
    const totalFilesCount = files.length;
    let diffNote;
    if (parsed.path) {
      files = files.filter((f) => f.filename === parsed.path || f.previous_filename === parsed.path);
    } else if (files.length > 10) {
      diffNote = `Commit contains ${totalFilesCount} files. Showing diffs for first 10 files. Use path parameter to inspect others.`;
      files = files.slice(0, 10);
    }

    const filesManifest = files.map((f) => {
      let patch = null;
      if (f.patch) {
        if (parsed.ignore_lockfiles !== false && isLockfile(f.filename)) {
          patch = `[... Diff collapsed for lockfile: ${f.filename}. Pass ignore_lockfiles: false to view full diff ...]`;
        } else {
          patch = sliceDiff(f.patch, parsed.max_diff_lines);
        }
      }
      return {
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch,
      };
    });

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

  create_commit: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreateCommitSchema.parse(args);
    const commitMsg = parsed.message.trim();
    if (!commitMsg) {
      throw new Error("Commit 'message' cannot be empty");
    }

    const branch = parsed.branch;
    const fileItems = parsed.files.map((f, idx) => {
      const p = f.path.trim().replace(/^\/+/, "");
      if (!p) {
        throw new Error(`File at index ${idx} has an empty 'path'`);
      }
      const action = f.action || "update";
      if (action !== "delete" && f.content === undefined) {
        throw new Error(`File '${p}' at index ${idx} requires 'content' when action is '${action}'`);
      }
      return {
        path: p,
        action,
        content: f.content,
      };
    });

    // 1. Get branch head reference
    let refRes;
    try {
      refRes = await githubRequest(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    } catch (err) {
      throw new Error(
        `Branch '${branch}' not found in repository ${owner}/${repo}. Call 'create_branch' first or verify branch name: ${err.message}`
      );
    }

    const currentCommitSha = refRes.object.sha;

    // 2. Get base tree SHA from current commit
    const commitRes = await githubRequest(`/repos/${owner}/${repo}/git/commits/${currentCommitSha}`);
    const baseTreeSha = commitRes.tree?.sha;

    // 3. Create new tree with updated or deleted file entries
    const treeElements = fileItems.map((f) =>
      f.action === "delete"
        ? {
            path: f.path,
            mode: "100644",
            type: "blob",
            sha: null,
          }
        : {
            path: f.path,
            mode: "100644",
            type: "blob",
            content: f.content,
          }
    );

    const newTree = await githubRequest(`/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeElements,
      }),
    });

    // 4. Create new commit pointing to tree and parent commit
    const newCommit = await githubRequest(`/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: commitMsg,
        tree: newTree.sha,
        parents: [currentCommitSha],
      }),
    });

    // 5. Update branch reference
    await githubRequest(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH",
      body: JSON.stringify({
        sha: newCommit.sha,
        force: false,
      }),
    });

    return {
      sha: newCommit.sha,
      short_sha: newCommit.sha ? newCommit.sha.slice(0, 7) : null,
      message: commitMsg,
      branch,
      files_committed: fileItems.map((f) => f.path),
      html_url: newCommit.html_url || `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
    };
  },

  push_files: async (args) => {
    return commitHandlers.create_commit(args);
  },
};
