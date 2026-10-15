import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeRepository, summarizeBranch } from "../helpers.js";

// Schemas
export const SearchRepositoriesSchema = z.object({
  query: z.string().describe("Search query to filter GitHub repositories (e.g. 'language:javascript stars:>100')"),
  sort: z.enum(["stars", "forks", "help-wanted-issues", "updated"]).optional().describe("Sort field"),
  order: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order"),
  page: z.number().optional().default(1).describe("Page number (default: 1)"),
  per_page: z.number().optional().default(20).describe("Results per page (default: 20, max: 100)"),
});

export const GetRepositorySchema = RepoParamsSchema.extend({});

export const CreateRepositorySchema = z.object({
  name: z.string().describe("Repository name"),
  description: z.string().optional().describe("Short repository description"),
  private: z.boolean().optional().default(false).describe("Whether the repository is private"),
  auto_init: z.boolean().optional().default(true).describe("Initialize repository with an initial README commit"),
  org: z.string().optional().describe("Optional organization name. If omitted, creates under authenticated user."),
});

export const GetFileContentsSchema = RepoParamsSchema.extend({
  path: z.string().describe("Path to the file or directory in repository (e.g. 'README.md' or 'src/index.js')"),
  ref: z.string().optional().describe("Branch name, tag, or commit SHA (default: default branch / HEAD)"),
});

export const CreateOrUpdateFileSchema = RepoParamsSchema.extend({
  path: z.string().describe("File path in repository (e.g. 'src/index.js')"),
  content: z.string().describe("Full text content of the file"),
  message: z.string().describe("Git commit message"),
  branch: z.string().optional().describe("Branch to commit to (default: repository default branch)"),
  sha: z.string().optional().describe("Blob SHA of file being replaced. Required if updating an existing file."),
});

export const DeleteFileSchema = RepoParamsSchema.extend({
  path: z.string().describe("Path of file to delete"),
  message: z.string().describe("Git commit message"),
  sha: z.string().describe("Blob SHA of the file being deleted"),
  branch: z.string().optional().describe("Branch to commit to"),
});

export const ListBranchesSchema = RepoParamsSchema.extend({
  page: z.number().optional().default(1).describe("Page number"),
  per_page: z.number().optional().default(30).describe("Results per page"),
});

export const CreateBranchSchema = RepoParamsSchema.extend({
  branch: z.string().describe("Name of the new branch to create (e.g. 'feature/auth')"),
  from_branch: z.string().optional().describe("Source branch name to branch off from (e.g. 'main')"),
  sha: z.string().optional().describe("Exact commit SHA to point the new branch to (takes precedence over from_branch)"),
});

export const GetBranchSchema = RepoParamsSchema.extend({
  branch: z.string().describe("Branch name to retrieve (e.g. 'main', 'feature/auth')"),
});

export const DeleteBranchSchema = RepoParamsSchema.extend({
  branch: z.string().describe("Branch name to delete (cannot delete default branch)"),
});

export const ForkRepositorySchema = RepoParamsSchema.extend({
  organization: z.string().optional().describe("Target organization to fork into (defaults to user account)"),
});

// Tool Definitions
export const repositoryTools = [
  {
    name: "search_repositories",
    description: "Search for GitHub repositories with token-saving summary metadata",
    inputSchema: zodToJsonSchema(SearchRepositoriesSchema),
  },
  {
    name: "get_repository",
    description: "Get repository metadata, description, default branch, and stats",
    inputSchema: zodToJsonSchema(GetRepositorySchema),
  },
  {
    name: "create_repository",
    description: "Create a new repository under user or organization account",
    inputSchema: zodToJsonSchema(CreateRepositorySchema),
    mutating: true,
  },
  {
    name: "get_file_contents",
    description: "Read file or directory content from a repository",
    inputSchema: zodToJsonSchema(GetFileContentsSchema),
  },
  {
    name: "create_or_update_file",
    description: "Create or update a single file in a GitHub repository",
    inputSchema: zodToJsonSchema(CreateOrUpdateFileSchema),
    mutating: true,
  },
  {
    name: "delete_file",
    description: "Delete a file from a GitHub repository",
    inputSchema: zodToJsonSchema(DeleteFileSchema),
    mutating: true,
  },
  {
    name: "list_branches",
    description: "List branches in a repository",
    inputSchema: zodToJsonSchema(ListBranchesSchema),
  },
  {
    name: "get_branch",
    description: "Get detailed information about a specific branch",
    inputSchema: zodToJsonSchema(GetBranchSchema),
  },
  {
    name: "create_branch",
    description: "Create a new branch pointing to an existing branch or commit SHA",
    inputSchema: zodToJsonSchema(CreateBranchSchema),
    mutating: true,
  },
  {
    name: "delete_branch",
    description: "Delete a branch from a GitHub repository (protected from deleting default branch)",
    inputSchema: zodToJsonSchema(DeleteBranchSchema),
    mutating: true,
  },
  {
    name: "fork_repository",
    description: "Fork a repository into your user or organization namespace",
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

    if (res.content && res.encoding === "base64") {
      res.decoded_content = Buffer.from(res.content, "base64").toString("utf-8");
    }
    return {
      name: res.name,
      path: res.path,
      sha: res.sha,
      size: res.size,
      decoded_content: res.decoded_content || null,
    };
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
    const res = await githubRequest(`/repos/${owner}/${repo}/branches?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map(summarizeBranch);
  },

  get_branch: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetBranchSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/branches/${encodeURIComponent(parsed.branch)}`);
    return summarizeBranch(res);
  },

  create_branch: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreateBranchSchema.parse(args);

    let sha = parsed.sha;
    if (!sha) {
      const sourceBranch = parsed.from_branch || "main";
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
