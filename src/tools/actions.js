import { z } from "zod";
import { zodToJsonSchema, RepoParamsSchema, normalizeRepoParams } from "../schemas.js";
import { githubRequest } from "../client.js";
import { summarizeWorkflow, summarizeWorkflowRun, summarizeWorkflowJob, tailLog } from "../helpers.js";

export const ListWorkflowsSchema = RepoParamsSchema.extend({
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(30).describe("Number of workflows per page (default: 30, max: 100)"),
});

export const ListWorkflowRunsSchema = RepoParamsSchema.extend({
  workflow_id: z.union([z.string(), z.number()]).optional().describe("Workflow ID number or workflow YAML file name (e.g. 'ci.yml', 'release.yaml')"),
  branch: z.string().optional().describe("Filter runs by head branch name (e.g. 'main', 'feature/auth')"),
  event: z.string().optional().describe("Filter runs by triggering event type (e.g. 'push', 'pull_request', 'workflow_dispatch')"),
  status: z
    .enum(["completed", "action_required", "cancelled", "failure", "neutral", "skipped", "stale", "success", "timed_out", "in_progress", "queued", "requested", "waiting"])
    .optional()
    .describe("Filter runs by execution status or conclusion (e.g. 'completed', 'success', 'failure', 'in_progress', 'queued')"),
  page: z.number().optional().default(1).describe("Page number for pagination (default: 1)"),
  per_page: z.number().optional().default(20).describe("Number of workflow runs per page (default: 20, max: 100)"),
});

export const GetWorkflowRunSchema = RepoParamsSchema.extend({
  run_id: z.number().describe("Unique numeric identifier of the workflow run"),
});

export const ListWorkflowRunJobsSchema = RepoParamsSchema.extend({
  run_id: z.number().describe("Unique numeric identifier of the workflow run"),
  filter: z.enum(["latest", "all"]).optional().default("latest").describe("Filter jobs: 'latest' (latest execution attempt) or 'all' (all attempts)"),
});

export const GetJobLogsSchema = RepoParamsSchema.extend({
  job_id: z.number().describe("Unique numeric identifier of the job"),
  tail_lines: z.number().optional().default(200).describe("Number of trailing log lines to return to preserve LLM token context (default: 200)"),
});

export const TriggerWorkflowSchema = RepoParamsSchema.extend({
  workflow_id: z.union([z.string(), z.number()]).describe("Workflow ID or YAML filename containing a workflow_dispatch trigger (e.g. 'deploy.yml')"),
  ref: z.string().describe("Git branch or tag name on which to run the workflow (e.g. 'main')"),
  inputs: z.record(z.any()).optional().describe("Input parameters dictionary matching workflow_dispatch input definitions"),
});

export const CancelWorkflowRunSchema = RepoParamsSchema.extend({
  run_id: z.number().describe("Numeric identifier of the active workflow run to cancel"),
});

export const RerunWorkflowSchema = RepoParamsSchema.extend({
  run_id: z.number().describe("Numeric identifier of the completed or failed workflow run to re-run"),
});

export const actionTools = [
  {
    name: "list_workflows",
    description: "List GitHub Actions CI/CD workflow files configured in a repository (.github/workflows). Use to discover workflow names and IDs before triggering or inspecting runs.",
    inputSchema: zodToJsonSchema(ListWorkflowsSchema),
  },
  {
    name: "list_workflow_runs",
    description: "List workflow execution runs with status, conclusion ('success', 'failure'), triggering event, and commit SHA. Use to check CI/CD pipeline health or find run IDs.",
    inputSchema: zodToJsonSchema(ListWorkflowRunsSchema),
  },
  {
    name: "get_workflow_run",
    description: "Get detailed status, timing, and conclusion for a specific workflow execution run. Use when monitoring CI pipeline completion.",
    inputSchema: zodToJsonSchema(GetWorkflowRunSchema),
  },
  {
    name: "list_workflow_run_jobs",
    description: "List all individual jobs and step breakdown within a workflow run. Use to identify which specific job or step failed during a build.",
    inputSchema: zodToJsonSchema(ListWorkflowRunJobsSchema),
  },
  {
    name: "get_job_logs",
    description: "Fetch plain text execution logs for an Actions job with tail extraction (defaults to last 200 lines). Behavioral safety: automatically trims massive log files to preserve LLM token context while capturing failure stack traces.",
    inputSchema: zodToJsonSchema(GetJobLogsSchema),
  },
  {
    name: "trigger_workflow",
    description: "Dispatch a workflow run on a branch or tag via workflow_dispatch event with custom inputs. Requires write permissions and GITHUB_READ_ONLY=false. The target workflow file must define a workflow_dispatch trigger.",
    inputSchema: zodToJsonSchema(TriggerWorkflowSchema),
    mutating: true,
  },
  {
    name: "cancel_workflow_run",
    description: "Cancel a queued or currently executing GitHub Actions workflow run. Requires write permissions and GITHUB_READ_ONLY=false.",
    inputSchema: zodToJsonSchema(CancelWorkflowRunSchema),
    mutating: true,
  },
  {
    name: "rerun_workflow",
    description: "Re-execute all jobs in a completed or failed GitHub Actions workflow run. Requires write permissions and GITHUB_READ_ONLY=false.",
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
