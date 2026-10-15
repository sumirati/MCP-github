import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeMilestone } from "../helpers.js";

export const ListMilestonesSchema = RepoParamsSchema.extend({
  state: z.enum(["open", "closed", "all"]).optional().default("open"),
  sort: z.enum(["due_on", "completeness"]).optional().default("due_on"),
  direction: z.enum(["asc", "desc"]).optional().default("asc"),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const GetMilestoneSchema = RepoParamsSchema.extend({
  milestone_number: z.number().describe("Milestone number (e.g. 1)"),
});

export const CreateMilestoneSchema = RepoParamsSchema.extend({
  title: z.string().describe("Milestone title"),
  state: z.enum(["open", "closed"]).optional().default("open"),
  description: z.string().optional().describe("Milestone description"),
  due_on: z.string().optional().describe("Milestone due date in ISO 8601 format (e.g. '2026-12-31T23:59:59Z')"),
});

export const UpdateMilestoneSchema = RepoParamsSchema.extend({
  milestone_number: z.number().describe("Milestone number"),
  title: z.string().optional().describe("Updated title"),
  state: z.enum(["open", "closed"]).optional().describe("Updated state"),
  description: z.string().optional().describe("Updated description"),
  due_on: z.string().optional().describe("Updated due date (ISO 8601)"),
});

export const milestoneTools = [
  {
    name: "list_milestones",
    description: "List project milestones with due dates and open/closed issue counts",
    inputSchema: zodToJsonSchema(ListMilestonesSchema),
  },
  {
    name: "get_milestone",
    description: "Get detailed milestone information by milestone number",
    inputSchema: zodToJsonSchema(GetMilestoneSchema),
  },
  {
    name: "create_milestone",
    description: "Create a new project milestone",
    inputSchema: zodToJsonSchema(CreateMilestoneSchema),
    mutating: true,
  },
  {
    name: "update_milestone",
    description: "Update milestone title, state, description, or due date",
    inputSchema: zodToJsonSchema(UpdateMilestoneSchema),
    mutating: true,
  },
];

export const milestoneHandlers = {
  list_milestones: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListMilestonesSchema.parse(args);
    const q = new URLSearchParams({
      state: parsed.state,
      sort: parsed.sort,
      direction: parsed.direction,
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await githubRequest(`/repos/${owner}/${repo}/milestones?${q.toString()}`);
    const items = Array.isArray(res) ? res : res.items || [];
    return items.map(summarizeMilestone);
  },

  get_milestone: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetMilestoneSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/milestones/${parsed.milestone_number}`);
    return summarizeMilestone(res);
  },

  create_milestone: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CreateMilestoneSchema.parse(args);
    const body = {
      title: parsed.title,
      state: parsed.state,
      ...(parsed.description ? { description: parsed.description } : {}),
      ...(parsed.due_on ? { due_on: parsed.due_on } : {}),
    };
    const res = await githubRequest(`/repos/${owner}/${repo}/milestones`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return summarizeMilestone(res);
  },

  update_milestone: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = UpdateMilestoneSchema.parse(args);
    const body = {};
    if (parsed.title !== undefined) body.title = parsed.title;
    if (parsed.state !== undefined) body.state = parsed.state;
    if (parsed.description !== undefined) body.description = parsed.description;
    if (parsed.due_on !== undefined) body.due_on = parsed.due_on;

    const res = await githubRequest(`/repos/${owner}/${repo}/milestones/${parsed.milestone_number}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return summarizeMilestone(res);
  },
};
