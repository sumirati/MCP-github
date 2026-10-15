import { z } from "zod";
import { zodToJsonSchema } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeGist } from "../helpers.js";

export const ListGistsSchema = z.object({
  since: z.string().optional().describe("Only gists updated at or after this time (ISO 8601 format)"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const GetGistSchema = z.object({
  gist_id: z.string().describe("Gist ID"),
});

export const CreateGistSchema = z.object({
  description: z.string().optional().describe("Description of the gist"),
  public: z.boolean().optional().default(false).describe("Whether the gist is public or secret"),
  files: z
    .record(
      z.object({
        content: z.string().describe("Content of the file"),
      })
    )
    .describe("Map of filename to content object (e.g. {'snippet.js': {'content': 'console.log(\"hello\")'}}"),
});

export const UpdateGistSchema = z.object({
  gist_id: z.string().describe("Gist ID to update"),
  description: z.string().optional().describe("Updated description"),
  files: z
    .record(
      z.object({
        content: z.string().optional().describe("New content of the file (or null/empty to delete)"),
        filename: z.string().optional().describe("New name for the file if renaming"),
      })
    )
    .describe("Map of existing filename to updated content/name"),
});

export const DeleteGistSchema = z.object({
  gist_id: z.string().describe("Gist ID to delete"),
});

export const gistTools = [
  {
    name: "list_gists",
    description: "List code snippets and gists for the authenticated user",
    inputSchema: zodToJsonSchema(ListGistsSchema),
  },
  {
    name: "get_gist",
    description: "Get full contents and metadata of a specific code snippet/gist",
    inputSchema: zodToJsonSchema(GetGistSchema),
  },
  {
    name: "create_gist",
    description: "Create a new code snippet or gist with one or more files",
    inputSchema: zodToJsonSchema(CreateGistSchema),
    mutating: true,
  },
  {
    name: "update_gist",
    description: "Update an existing code snippet or gist",
    inputSchema: zodToJsonSchema(UpdateGistSchema),
    mutating: true,
  },
  {
    name: "delete_gist",
    description: "Delete a code snippet or gist",
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
