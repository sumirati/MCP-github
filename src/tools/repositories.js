import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeRepository, summarizeBranch, extractSymbolOutline } from "../helpers.js";

// Schemas
export const SearchRepositoriesSchema = z.object({
  query: z.string().describe("Search query string supporting GitHub qualifiers (e.g. 'org:myorg stars:>50', 'language:typescript topic:mcp')"),
  sort: z.enum(["stars", "forks", "help-wanted-issues", "updated"]).optional().describe("Field to sort results by: 'stars', 'forks', 'help-wanted-issues', or 'updated'"),
  order: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort direction: 'asc' or 'desc' (default: 'desc')"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().min(1).max(100).optional().default(10).describe("Number of results per page (default: 10, max: 100)"),
});

export const GetRepositorySchema = RepoParamsSchema.extend({
  format: z.enum(["json", "markdown"]).optional().default("markdown").describe("Output format: 'markdown' (default) or 'json'"),
});

export const CreateRepositorySchema = z.object({
  name: z.string().describe("Repository name (alphanumeric with hyphens/dots, e.g. 'my-api-server')"),
  description: z.string().optional().describe("Short project description"),
  private: z.boolean().optional().default(false).describe("Whether the repository visibility is private (true) or public (false, default)"),
  auto_init: z.boolean().optional().default(true).describe("Initialize repository with an initial commit containing a README (default: true)"),
  org: z.string().optional().describe("Optional target organization name. If omitted, creates under the authenticated user account"),
});

export const GetFileContentsSchema = RepoParamsSchema.extend({
  path: z.string().describe("Relative path to file or directory in repository (e.g. 'README.md', 'src/index.js', or '' for root)"),
  ref: z.string().optional().describe("Git reference (branch name, tag, or commit SHA) to read from (default: default branch / HEAD)"),
  outline_only: z.boolean().optional().default(false).describe("Extract top-level symbol signatures (functions, classes, interfaces, types) with line numbers to conserve tokens (default: false)"),
  start_line: z.number().optional().describe("Optional 1-based start line to slice file contents"),
  end_line: z.number().optional().describe("Optional 1-based end line to slice file contents"),
});

export const CreateOrUpdateFileSchema = RepoParamsSchema.extend({
  path: z.string().describe("Relative file path in repository to create or modify (e.g. 'src/index.js')"),
  content: z.string().describe("Full plain text content to write into the file"),
  message: z.string().describe("Git commit message explaining the change"),
  branch: z.string().optional().describe("Target branch to commit changes to (default: repository default branch)"),
  sha: z.string().optional().describe("Current blob SHA of the file being overwritten. Recommended when modifying existing files to prevent conflicts; if omitted, latest blob SHA will be resolved automatically"),
});

export const DeleteFileSchema = RepoParamsSchema.extend({
  path: z.string().describe("Relative file path in repository to delete"),
  message: z.string().describe("Git commit message explaining the deletion"),
  sha: z.string().describe("Current blob SHA of the file being deleted (required by GitHub API to prevent race conditions)"),
  branch: z.string().optional().describe("Target branch to delete file from (default: repository default branch)"),
});

export const ListBranchesSchema = RepoParamsSchema.extend({
  protected: z.boolean().optional().describe("Filter branches by protected status (true/false) directly pushed upstream"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().min(1).max(100).optional().default(10).describe("Number of results per page (default: 10, max: 100)"),
});

export const CreateBranchSchema = RepoParamsSchema.extend({
  branch: z.string().describe("Name of the new branch to create (e.g. 'feature/auth-provider')"),
  from_branch: z.string().optional().describe("Source branch name to branch off from (e.g. 'main', default: 'main')"),
  sha: z.string().optional().describe("Exact commit SHA to point the new branch to (takes precedence over from_branch)"),
});

export const GetBranchSchema = RepoParamsSchema.extend({
  branch: z.string().describe("Exact branch name to inspect (e.g. 'main', 'feature/auth')"),
});

export const DeleteBranchSchema = RepoParamsSchema.extend({
  branch: z.string().describe("Branch name to delete (cannot delete the repository default branch)"),
});

export const GetBranchProtectionSchema = RepoParamsSchema.extend({
  branch: z.string().describe("Exact branch name to inspect branch protection rules for (e.g. 'main')"),
});

export const ForkRepositorySchema = RepoParamsSchema.extend({
  organization: z.string().optional().describe("Target organization namespace to fork into (if omitted, forks into authenticated user account)"),
});

// Tool Definitions
export const repositoryTools = [
  {
    name: "search_repositories",
    description: "Search for repositories across GitHub or within an organization using query qualifiers (e.g. 'org:myorg language:typescript') with capped pagination (max 100). If owner and repository name are known, prefer 'get_repository' for exact O(1) lookup.",
    inputSchema: zodToJsonSchema(SearchRepositoriesSchema),
  },
  {
    name: "get_repository",
    description: "Get repository metadata, visibility, description, default branch, clone URL, and statistics for an exact owner/repo. Use when verifying repository settings or checking default branch name.",
    inputSchema: zodToJsonSchema(GetRepositorySchema),
  },
  {
    name: "create_repository",
    description: "Create a new GitHub repository under the authenticated user account or a specified organization. Requires write permissions and GITHUB_READ_ONLY=false. Auto-initializes with a default README commit unless auto_init is false.",
    inputSchema: zodToJsonSchema(CreateRepositorySchema),
    mutating: true,
  },
  {
    name: "get_file_contents",
    description: "Read current file contents, extract symbol outlines ('outline_only: true'), slice line ranges, or list directory entries at a specified git ref. Automatically decodes Base64 into UTF-8. Use 'outline_only: true' first to inspect structure in ~50-100 tokens, then request specific line ranges.",
    inputSchema: zodToJsonSchema(GetFileContentsSchema),
  },
  {
    name: "create_or_update_file",
    description: "Create a new file or overwrite an existing file on a branch in a single atomic commit. If updating, provide the file's current blob SHA in 'sha' (or leave empty to auto-resolve). Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CreateOrUpdateFileSchema),
    mutating: true,
  },
  {
    name: "delete_file",
    description: "Delete an existing file from a branch in a git commit. Requires the current blob SHA to guard against concurrent overwrites. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(DeleteFileSchema),
    mutating: true,
  },
  {
    name: "list_branches",
    description: "List branches in a repository with protection status and head commit SHAs. Supports upstream filtering by protected status and capped pagination (max 100). If branch name is already known, prefer 'get_branch'.",
    inputSchema: zodToJsonSchema(ListBranchesSchema),
  },
  {
    name: "get_branch",
    description: "Get detailed status of a specific branch, including branch protection rules and latest commit details. Use to verify branch existence or protection policies before merging or deleting.",
    inputSchema: zodToJsonSchema(GetBranchSchema),
  },
  {
    name: "get_branch_protection",
    description: "Retrieve comprehensive branch protection rules for a specific Git branch, including required status checks, required reviews, admin enforcement, and force-push / deletion restrictions.",
    inputSchema: zodToJsonSchema(GetBranchProtectionSchema),
  },
  {
    name: "create_branch",
    description: "Create a new git branch pointing to a commit SHA or branched from an existing branch (defaults to 'main'). Use before committing changes or opening a pull request. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CreateBranchSchema),
    mutating: true,
  },
  {
    name: "delete_branch",
    description: "Delete a branch from a repository. Protected: explicitly rejects requests to delete the default branch (e.g. 'main') to prevent repository breakage. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(DeleteBranchSchema),
    mutating: true,
  },
  {
    name: "fork_repository",
    description: "Fork a repository into the authenticated user's account or a specified organization namespace. Use when contributing to upstream projects where direct push access is restricted. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(ForkRepositorySchema),
    mutating: true,
  },
];

// Handlers
export const repositoryHandlers = {
  search_repositories: async (args) => {
    const parsed = SearchRepositoriesSchema.parse(args);
    const q = new URLSearchParams({
      q: parsed.query,
      order: parsed.order,
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.sort) q.set("sort", parsed.sort);
    const res = await githubRequest(`/search/repositories?${q.toString()}`);
    return {
      total_count: res.total_count,
      items: (res.items || []).map(summarizeRepository),
    };
  },

  get_repository: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const res = await githubRequest(`/repos/${owner}/${repo}`);
    return summarizeRepository(res);
  },

  create_repository: async (args) => {
    const parsed = CreateRepositorySchema.parse(args);
    const body = {
      name: parsed.name,
      description: parsed.description,
      private: parsed.private,
      auto_init: parsed.auto_init,
    };
    const endpoint = parsed.org ? `/orgs/${parsed.org}/repos` : "/user/repos";
    const res = await githubRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizeRepository(res);
  },

  get_file_contents: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetFileContentsSchema.parse(args);
    const cleanPath = parsed.path.replace(/^\//, "");
    const q = parsed.ref ? `?ref=${encodeURIComponent(parsed.ref)}` : "";
    const res = await githubRequest(`/repos/${owner}/${repo}/contents/${cleanPath}${q}`);

    if (Array.isArray(res)) {
      return res.map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size,
        sha: item.sha,
      }));
    }

    const result = {
      name: res.name,
      path: res.path,
      sha: res.sha,
      size: res.size,
    };

    if (typeof res.content === "string" && (res.encoding === "base64" || res.content === "")) {
      const decoded = Buffer.from(res.content, "base64").toString("utf-8");
      if (parsed.outline_only) {
        result.outline = extractSymbolOutline(decoded, cleanPath);
      } else if (parsed.start_line || parsed.end_line) {
        const lines = decoded.split(/\r?\n/);
        const start = Math.max(1, parsed.start_line || 1);
        const end = Math.min(lines.length, parsed.end_line || lines.length);
        result.decoded_content = lines.slice(start - 1, end).join("\n");
        result.sliced_lines = `${start}-${end} of ${lines.length}`;
      } else {
        result.decoded_content = decoded;
      }
    } else {
      result.decoded_content = null;
    }

    return result;
  },

  create_or_update_file: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreateOrUpdateFileSchema.parse(args);
    const cleanPath = parsed.path.replace(/^\//, "");
    const endpoint = `/repos/${owner}/${repo}/contents/${cleanPath}`;

    let sha = parsed.sha;
    if (!sha) {
      try {
        const existing = await githubRequest(
          `${endpoint}${parsed.branch ? `?ref=${encodeURIComponent(parsed.branch)}` : ""}`
        );
        if (existing && existing.sha) {
          sha = existing.sha;
        }
      } catch {
        // File does not exist yet
      }
    }

    const body = {
      message: parsed.message,
      content: Buffer.from(parsed.content, "utf-8").toString("base64"),
      ...(sha ? { sha } : {}),
      ...(parsed.branch ? { branch: parsed.branch } : {}),
    };

    const res = await githubRequest(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    return {
      content: {
        name: res.content?.name,
        path: res.content?.path,
        sha: res.content?.sha,
      },
      commit: {
        sha: res.commit?.sha,
        message: res.commit?.message,
      },
    };
  },

  delete_file: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = DeleteFileSchema.parse(args);
    const cleanPath = parsed.path.replace(/^\//, "");
    const body = {
      message: parsed.message,
      sha: parsed.sha,
      ...(parsed.branch ? { branch: parsed.branch } : {}),
    };

    return await githubRequest(`/repos/${owner}/${repo}/contents/${cleanPath}`, {
      method: "DELETE",
      body: JSON.stringify(body),
    });
  },

  list_branches: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListBranchesSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.protected !== undefined) q.set("protected", parsed.protected.toString());
    const res = await githubRequest(`/repos/${owner}/${repo}/branches?${q.toString()}`);
    const rawItems = Array.isArray(res) ? res : res.items || [];
    const items = rawItems.map(summarizeBranch);
    return res.pagination ? { pagination: res.pagination, branches: items } : items;
  },

  get_branch: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetBranchSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/branches/${encodeURIComponent(parsed.branch)}`);
    return summarizeBranch(res);
  },

  get_branch_protection: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetBranchProtectionSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/branches/${encodeURIComponent(parsed.branch)}/protection`);
    return {
      branch: parsed.branch,
      required_status_checks: res.required_status_checks
        ? {
            strict: res.required_status_checks.strict,
            contexts: res.required_status_checks.contexts,
          }
        : null,
      enforce_admins: res.enforce_admins?.enabled || false,
      required_pull_request_reviews: res.required_pull_request_reviews
        ? {
            dismiss_stale_reviews: res.required_pull_request_reviews.dismiss_stale_reviews,
            require_code_owner_reviews: res.required_pull_request_reviews.require_code_owner_reviews,
            required_approving_review_count: res.required_pull_request_reviews.required_approving_review_count,
          }
        : null,
      restrictions: res.restrictions
        ? {
            users: res.restrictions.users?.map((u) => u.login),
            teams: res.restrictions.teams?.map((t) => t.slug),
            apps: res.restrictions.apps?.map((a) => a.slug),
          }
        : null,
      allow_force_pushes: res.allow_force_pushes?.enabled || false,
      allow_deletions: res.allow_deletions?.enabled || false,
    };
  },

  create_branch: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreateBranchSchema.parse(args);

    let sha = parsed.sha;
    if (!sha) {
      let sourceBranch = parsed.from_branch;
      if (!sourceBranch) {
        const repoInfo = await githubRequest(`/repos/${owner}/${repo}`);
        sourceBranch = repoInfo.default_branch || "main";
      }
      const branchData = await githubRequest(`/repos/${owner}/${repo}/branches/${encodeURIComponent(sourceBranch)}`);
      sha = branchData.commit?.sha;
    }

    if (!sha) {
      throw new Error(`Could not determine target commit SHA to create branch '${parsed.branch}'`);
    }

    const res = await githubRequest(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${parsed.branch}`,
        sha,
      }),
    });

    return {
      ref: res.ref,
      sha: res.object?.sha,
    };
  },

  delete_branch: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = DeleteBranchSchema.parse(args);

    const repoInfo = await githubRequest(`/repos/${owner}/${repo}`);
    if (repoInfo.default_branch === parsed.branch) {
      throw new Error(`Cannot delete the default branch '${parsed.branch}' of ${owner}/${repo}`);
    }

    await githubRequest(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(parsed.branch)}`, {
      method: "DELETE",
    });

    return {
      message: `Branch '${parsed.branch}' deleted successfully from ${owner}/${repo}`,
      branch: parsed.branch,
      deleted: true,
    };
  },

  fork_repository: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ForkRepositorySchema.parse(args);
    const body = parsed.organization ? { organization: parsed.organization } : {};
    const res = await githubRequest(`/repos/${owner}/${repo}/forks`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizeRepository(res);
  },
};
