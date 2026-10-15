import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeRelease } from "../helpers.js";

export const ListReleasesSchema = RepoParamsSchema.extend({
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(20).describe("Number of releases per page (default: 20, max: 100)"),
});

export const GetReleaseSchema = RepoParamsSchema.extend({
  release_id: z.number().optional().describe("Release numeric identifier (e.g. 123456)"),
  tag: z.string().optional().describe("Release tag name (e.g. 'v1.1.0', alternative to release_id)"),
});

export const CreateReleaseSchema = RepoParamsSchema.extend({
  tag_name: z.string().describe("Tag name for the release (e.g. 'v1.1.0')"),
  name: z.string().optional().describe("Human-readable release title"),
  body: z.string().optional().describe("Release notes or changelog description in markdown format"),
  draft: z.boolean().optional().default(false).describe("Whether to create this release as an unpublished draft (default: false)"),
  prerelease: z.boolean().optional().default(false).describe("Whether to flag this release as a pre-release or beta (default: false)"),
  target_commitish: z.string().optional().describe("Commitish value (branch name or commit SHA) if tag does not exist yet (default: default branch)"),
});

export const ListTagsSchema = RepoParamsSchema.extend({
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(30).describe("Number of tags per page (default: 30, max: 100)"),
});

export const CreateTagSchema = RepoParamsSchema.extend({
  tag: z.string().describe("New tag name to create (e.g. 'v1.1.0')"),
  sha: z.string().describe("Full git commit SHA to point the tag to"),
});

export const releaseTools = [
  {
    name: "list_releases",
    description: "List published and draft releases in a repository with release titles, asset download counts, and published dates. Use to check release history or download URLs.",
    inputSchema: zodToJsonSchema(ListReleasesSchema),
  },
  {
    name: "get_release",
    description: "Get full details of a specific release by tag name or numeric release ID, including changelog body and asset links.",
    inputSchema: zodToJsonSchema(GetReleaseSchema),
  },
  {
    name: "create_release",
    description: "Publish a formal GitHub release for a tag, with title, markdown release notes/changelog, and pre-release/draft flags. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CreateReleaseSchema),
    mutating: true,
  },
  {
    name: "list_tags",
    description: "List git tags in a repository with tag names and commit SHAs. Use to inspect available version tags before publishing a release.",
    inputSchema: zodToJsonSchema(ListTagsSchema),
  },
  {
    name: "create_tag",
    description: "Create a lightweight git tag reference pointing to a specific commit SHA. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CreateTagSchema),
    mutating: true,
  },
];

export const releaseHandlers = {
  list_releases: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListReleasesSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await githubRequest(`/repos/${owner}/${repo}/releases?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map(summarizeRelease);
  },

  get_release: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetReleaseSchema.parse(args);
    let endpoint = "";
    if (parsed.tag) {
      endpoint = `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(parsed.tag)}`;
    } else if (parsed.release_id) {
      endpoint = `/repos/${owner}/${repo}/releases/${parsed.release_id}`;
    } else {
      throw new Error("Either 'release_id' or 'tag' must be provided to get_release.");
    }
    const res = await githubRequest(endpoint);
    return summarizeRelease(res);
  },

  create_release: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreateReleaseSchema.parse(args);
    const body = {
      tag_name: parsed.tag_name,
      name: parsed.name || parsed.tag_name,
      body: parsed.body,
      draft: parsed.draft,
      prerelease: parsed.prerelease,
      ...(parsed.target_commitish ? { target_commitish: parsed.target_commitish } : {}),
    };
    const res = await githubRequest(`/repos/${owner}/${repo}/releases`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizeRelease(res);
  },

  list_tags: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListTagsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await githubRequest(`/repos/${owner}/${repo}/tags?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map((t) => ({
      name: t.name,
      commit: {
        sha: t.commit?.sha,
        short_sha: t.commit?.sha ? t.commit.sha.slice(0, 7) : null,
      },
    }));
  },

  create_tag: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreateTagSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/tags/${parsed.tag}`,
        sha,
      }),
    });
    return {
      ref: res.ref,
      sha: res.object?.sha,
    };
  },
};
