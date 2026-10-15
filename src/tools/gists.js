import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeGist } from "../helpers.js";

export const ListGistsSchema = z.object({
  since: z.string().optional().describe("Filter to only gists updated on or after this timestamp (ISO 8601 format, e.g. '2026-01-01T00:00:00Z')"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(30).describe("Number of gists per page (default: 30, max: 100)"),
});

export const GetGistSchema = z.object({
  gist_id: z.string().describe("Unique alphanumeric string identifier of the gist"),
});

export const CreateGistSchema = z.object({
  description: z.string().optional().describe("Summary description of the gist and its contents"),
  public: z.boolean().optional().default(false).describe("Whether the gist is publicly discoverable (true) or unlisted/secret (false, default)"),
  files: z
    .record(
      z.object({
        content: z.string().describe("Text content of the file"),
      })
    )
    .describe("Dictionary mapping filename string to object with 'content' string (e.g. {'snippet.js': {'content': 'console.log(\"hello\")'}}"),
});

export const UpdateGistSchema = z.object({
  gist_id: z.string().describe("Unique alphanumeric string identifier of the gist to update"),
  description: z.string().optional().describe("Updated summary description for the gist"),
  files: z
    .record(
      z.object({
        content: z.string().optional().describe("New text content for the file (or empty/null to delete this file from the gist)"),
        filename: z.string().optional().describe("New name for the file if renaming"),
      })
    )
    .describe("Dictionary mapping existing filename to object with updated content or new filename"),
});

export const DeleteGistSchema = z.object({
  gist_id: z.string().describe("Unique alphanumeric string identifier of the gist to delete"),
});

export const gistTools = [
  {
    name: "list_gists",
    description: "List code snippets and gists owned by the authenticated user with file summaries. Use to locate code snippet IDs before reading or editing.",
    inputSchema: zodToJsonSchema(ListGistsSchema),
  },
  {
    name: "get_gist",
    description: "Get full source code contents, files, and description of a specific GitHub gist by ID. Use to inspect standalone code snippets or configuration templates.",
    inputSchema: zodToJsonSchema(GetGistSchema),
  },
  {
    name: "create_gist",
    description: "Create a new public or secret GitHub gist with one or more files. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CreateGistSchema),
    mutating: true,
  },
  {
    name: "update_gist",
    description: "Update an existing gist's description or modify/rename/delete individual files within the gist. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(UpdateGistSchema),
    mutating: true,
  },
  {
    name: "delete_gist",
    description: "Permanently delete a gist by its identifier. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(DeleteGistSchema),
    mutating: true,
  },
];

export const gistHandlers = {
  list_gists: async (args) => {
    const parsed = ListGistsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.since) q.set("since", parsed.since);

    const res = await githubRequest(`/gists?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map(summarizeGist);
  },

  get_gist: async (args) => {
    const parsed = GetGistSchema.parse(args);
    const res = await githubRequest(`/gists/${encodeURIComponent(parsed.gist_id)}`);
    const files = {};
    for (const filename of Object.keys(res.files || {})) {
      const f = res.files[filename];
      files[filename] = {
        filename: f.filename,
        type: f.type,
        language: f.language,
        size: f.size,
        content: f.content,
      };
    }
    return {
      id: res.id,
      description: res.description,
      public: res.public,
      owner: res.owner ? res.owner.login : null,
      comments: res.comments,
      created_at: res.created_at,
      updated_at: res.updated_at,
      html_url: res.html_url,
      files,
    };
  },

  create_gist: async (args) => {
    const parsed = CreateGistSchema.parse(args);
    const body = {
      description: parsed.description,
      public: parsed.public,
      files: parsed.files,
    };
    const res = await githubRequest("/gists", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizeGist(res);
  },

  update_gist: async (args) => {
    const parsed = UpdateGistSchema.parse(args);
    const body = {};
    if (parsed.description !== undefined) body.description = parsed.description;
    if (parsed.files !== undefined) body.files = parsed.files;

    const res = await githubRequest(`/gists/${encodeURIComponent(parsed.gist_id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return summarizeGist(res);
  },

  delete_gist: async (args) => {
    const parsed = DeleteGistSchema.parse(args);
    return await githubRequest(`/gists/${encodeURIComponent(parsed.gist_id)}`, {
      method: "DELETE",
    });
  },
};
