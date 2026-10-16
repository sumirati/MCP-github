import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeMilestone } from "../helpers.js";

export const ListMilestonesSchema = RepoParamsSchema.extend({
  state: z.enum(["open", "closed", "all"]).optional().default("open").describe("Filter milestones by state: 'open' (default), 'closed', or 'all'"),
  sort: z.enum(["due_on", "completeness"]).optional().default("due_on").describe("Sort milestones by: 'due_on' (default) or 'completeness'"),
  direction: z.enum(["asc", "desc"]).optional().default("asc").describe("Sort direction: 'asc' (default) or 'desc'"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(10).describe("Number of milestones per page (default: 10, max: 100)"),
});

export const GetMilestoneSchema = RepoParamsSchema.extend({
  milestone_number: z.number().describe("The milestone numeric identifier (e.g. 1)"),
});

export const CreateMilestoneSchema = RepoParamsSchema.extend({
  title: z.string().describe("Descriptive title for the milestone (e.g. 'v1.2.0 Release')"),
  state: z.enum(["open", "closed"]).optional().default("open").describe("Initial milestone state: 'open' (default) or 'closed'"),
  description: z.string().optional().describe("Summary of release goals and deliverables associated with this milestone"),
  due_on: z.string().optional().describe("Target completion deadline in ISO 8601 format (e.g. '2026-12-31T23:59:59Z')"),
});

export const UpdateMilestoneSchema = RepoParamsSchema.extend({
  milestone_number: z.number().describe("Milestone number to update"),
  title: z.string().optional().describe("Updated milestone title"),
  state: z.enum(["open", "closed"]).optional().describe("Updated state: 'open' or 'closed'"),
  description: z.string().optional().describe("Updated description markdown text"),
  due_on: z.string().optional().describe("Updated deadline in ISO 8601 format (e.g. '2026-12-31T23:59:59Z')"),
});

export const milestoneTools = [
  {
    name: "list_milestones",
    description: "List project milestones in a repository with open/closed issue counts and due dates. Use to monitor release roadmaps or locate milestone numbers before associating them with issues or PRs.",
    inputSchema: zodToJsonSchema(ListMilestonesSchema),
  },
  {
    name: "get_milestone",
    description: "Get detailed status of a specific milestone, including title, open/closed issues count, creation date, and deadline. Use when reviewing milestone progress or inspecting milestone deadlines.",
    inputSchema: zodToJsonSchema(GetMilestoneSchema),
  },
  {
    name: "create_milestone",
    description: "Create a new project milestone with a title, description, and optional due date. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CreateMilestoneSchema),
    mutating: true,
  },
  {
    name: "update_milestone",
    description: "Update an existing milestone's title, description, state ('open'/'closed'), or due date. Requires write permissions and GITHUB_READ_ONLY=false.",
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
