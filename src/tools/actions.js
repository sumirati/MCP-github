import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeWorkflow, summarizeWorkflowRun, summarizeWorkflowJob, tailLog } from "../helpers.js";

export const ListWorkflowsSchema = RepoParamsSchema.extend({
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(30),
});

export const ListWorkflowRunsSchema = RepoParamsSchema.extend({
  workflow_id: z.union([z.string(), z.number()]).optional().describe("Workflow ID or workflow file name (e.g. 'ci.yml')"),
  branch: z.string().optional().describe("Filter runs by branch"),
  event: z.string().optional().describe("Filter runs by triggering event (e.g. 'push', 'pull_request')"),
  status: z
    .enum(["completed", "action_required", "cancelled", "failure", "neutral", "skipped", "stale", "success", "timed_out", "in_progress", "queued", "requested", "waiting"])
    .optional(),
  page: z.number().optional().default(1),
  per_page: z.number().optional().default(20),
});

export const GetWorkflowRunSchema = RepoParamsSchema.extend({
  run_id: z.number().describe("Workflow run ID"),
});

export const ListWorkflowRunJobsSchema = RepoParamsSchema.extend({
  run_id: z.number().describe("Workflow run ID"),
  filter: z.enum(["latest", "all"]).optional().default("latest"),
});

export const GetJobLogsSchema = RepoParamsSchema.extend({
  job_id: z.number().describe("Job ID"),
  tail_lines: z.number().optional().default(200).describe("Number of tail lines to return to preserve token context (default: 200)"),
});

export const TriggerWorkflowSchema = RepoParamsSchema.extend({
  workflow_id: z.union([z.string(), z.number()]).describe("Workflow ID or filename (e.g. 'build.yml')"),
  ref: z.string().describe("Git reference (branch or tag name) to run workflow on"),
  inputs: z.record(z.any()).optional().describe("Key-value input parameters defined in the workflow dispatch trigger"),
});

export const CancelWorkflowRunSchema = RepoParamsSchema.extend({
  run_id: z.number().describe("Workflow run ID"),
});

export const RerunWorkflowSchema = RepoParamsSchema.extend({
  run_id: z.number().describe("Workflow run ID"),
});

export const actionTools = [
  {
    name: "list_workflows",
    description: "List GitHub Actions workflows in a repository",
    inputSchema: zodToJsonSchema(ListWorkflowsSchema),
  },
  {
    name: "list_workflow_runs",
    description: "List workflow runs with status, conclusion, and branch metadata",
    inputSchema: zodToJsonSchema(ListWorkflowRunsSchema),
  },
  {
    name: "get_workflow_run",
    description: "Get detailed status of a specific workflow run",
    inputSchema: zodToJsonSchema(GetWorkflowRunSchema),
  },
  {
    name: "list_workflow_run_jobs",
    description: "List jobs and execution steps for a workflow run",
    inputSchema: zodToJsonSchema(ListWorkflowRunJobsSchema),
  },
  {
    name: "get_job_logs",
    description: "Fetch and safely tail the execution logs of an Actions job (defaults to last 200 lines)",
    inputSchema: zodToJsonSchema(GetJobLogsSchema),
  },
  {
    name: "trigger_workflow",
    description: "Trigger a workflow_dispatch event to run a GitHub Actions workflow",
    inputSchema: zodToJsonSchema(TriggerWorkflowSchema),
    mutating: true,
  },
  {
    name: "cancel_workflow_run",
    description: "Cancel a running or queued GitHub Actions workflow run",
    inputSchema: zodToJsonSchema(CancelWorkflowRunSchema),
    mutating: true,
  },
  {
    name: "rerun_workflow",
    description: "Re-run a completed or failed GitHub Actions workflow run",
    inputSchema: zodToJsonSchema(RerunWorkflowSchema),
    mutating: true,
  },
];

export const actionHandlers = {
  list_workflows: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListWorkflowsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    const res = await githubRequest(`/repos/${owner}/${repo}/actions/workflows?${q.toString()}`);
    return {
      total_count: res.total_count,
      workflows: (res.workflows || []).map(summarizeWorkflow),
    };
  },

  list_workflow_runs: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListWorkflowRunsSchema.parse(args);
    const q = new URLSearchParams({
      page: parsed.page.toString(),
      per_page: parsed.per_page.toString(),
    });
    if (parsed.branch) q.set("branch", parsed.branch);
    if (parsed.event) q.set("event", parsed.event);
    if (parsed.status) q.set("status", parsed.status);

    const endpoint = parsed.workflow_id
      ? `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(parsed.workflow_id)}/runs?${q.toString()}`
      : `/repos/${owner}/${repo}/actions/runs?${q.toString()}`;

    const res = await githubRequest(endpoint);
    return {
      total_count: res.total_count,
      workflow_runs: (res.workflow_runs || []).map(summarizeWorkflowRun),
    };
  },

  get_workflow_run: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetWorkflowRunSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/actions/runs/${parsed.run_id}`);
    return summarizeWorkflowRun(res);
  },

  list_workflow_run_jobs: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = ListWorkflowRunJobsSchema.parse(args);
    const res = await githubRequest(`/repos/${owner}/${repo}/actions/runs/${parsed.run_id}/jobs?filter=${parsed.filter}`);
    return {
      total_count: res.total_count,
      jobs: (res.jobs || []).map(summarizeWorkflowJob),
    };
  },

  get_job_logs: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = GetJobLogsSchema.parse(args);
    const rawLogs = await githubRequest(
      `/repos/${owner}/${repo}/actions/jobs/${parsed.job_id}/logs`,
      {
        redirect: "follow",
      },
      "text"
    );
    return {
      job_id: parsed.job_id,
      logs: tailLog(rawLogs, parsed.tail_lines),
    };
  },

  trigger_workflow: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = TriggerWorkflowSchema.parse(args);
    const body = {
      ref: parsed.ref,
      ...(parsed.inputs ? { inputs: parsed.inputs } : {}),
    };
    return await githubRequest(
      `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(parsed.workflow_id)}/dispatches`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  },

  cancel_workflow_run: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = CancelWorkflowRunSchema.parse(args);
    return await githubRequest(`/repos/${owner}/${repo}/actions/runs/${parsed.run_id}/cancel`, {
      method: "POST",
    });
  },

  rerun_workflow: async (args) => {
    const { owner, repo } = normalizeRepoParams(args);
    const parsed = RerunWorkflowSchema.parse(args);
    return await githubRequest(`/repos/${owner}/${repo}/actions/runs/${parsed.run_id}/rerun`, {
      method: "POST",
    });
  },
};
