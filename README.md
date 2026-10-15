# @sumirati/mcp-github

Model Context Protocol (MCP) server for GitHub REST API, engineered specifically for autonomous AI agents and developer workflows.

Architecturally aligned with `@sumirati/mcp-gitlab`, this server provides high-performance GitHub interactions with a strict **Token Economy First** design, native zero-dependency HTTP client, and a **3-Tier Read-Only** security guard.

---

## Key Invariants

### 1. Token Economy First
Raw GitHub REST API responses are notoriously heavy (often 30KB–100KB per Issue or PR). `@sumirati/mcp-github` incorporates automated payload summarizers across all endpoints to eliminate >80% of redundant metadata (URLs, avatar links, AST blobs, node IDs) before reaching LLM context windows:
- **PR Diffs**: Sliced and truncated with token-budget safeguards (`max_lines`, default: 400).
- **Actions Logs**: Tail-extracted for diagnosing failures (`tail_lines`, default: 200 lines) instead of megabyte log dumps.
- **Search & Listings**: Slim summaries focusing on titles, numbers, branches, SHAs, and states.

### 2. 3-Tier Read-Only Mode (`GITHUB_READ_ONLY=true`)
When `GITHUB_READ_ONLY=true` is set, the server enforces safety across three redundant layers:
1. **Tool Discovery Filter**: Mutating tools are completely omitted from `ListToolsRequestSchema`.
2. **Dispatch Guard**: Any incoming `CallToolRequestSchema` for a mutating tool is rejected before invocation.
3. **HTTP Client Interceptor**: `src/client.js` blocks any non-`GET` and non-`HEAD` request from being dispatched to GitHub.

### 3. Native Fetch Runtime
Zero bloated external SDK dependencies. Uses native Node.js 18+ `fetch` with automated rate-limit header parsing (`x-ratelimit-remaining`, `x-ratelimit-reset`), RFC 5988 `Link` pagination, and clean error formatting.

---

## Directory Structure

```text
MCP-github/
├── index.js                  # MCP Server entrypoint, transport & tool registration
├── package.json
├── LICENSE                   # MIT License — Copyright (c) 2026 sumirati@buggycode.net
├── NOTICE
├── README.md
└── src/
    ├── client.js             # Native fetch client, rate limits, 3-tier read-only guard
    ├── schemas.js            # Shared repo/owner base schemas & Zod to JSON Schema converter
    ├── helpers.js            # Payload summarizers (PRs, issues, commits, actions, releases, diffs)
    └── tools/
        ├── repositories.js   # Repos, search, files, branches
        ├── pull-requests.js  # PRs, token-sliced diffs, review comments, thread replies
        ├── issues.js         # Issues, labels, comments
        ├── actions.js        # Workflows, runs, safe job log tailing
        ├── releases.js       # Releases & Git tags
        └── user.js           # Current user, orgs, accessible repos
```

---

## Tool Catalog

### Repositories (`src/tools/repositories.js`)
- `search_repositories`: Search repositories with queries and filters.
- `get_repository`: Get metadata, default branch, statistics.
- `create_repository` *(mutating)*: Create a new repository under user or organization.
- `get_file_contents`: Read file or directory content (with automatic Base64 decoding).
- `create_or_update_file` *(mutating)*: Create or update a file.
- `delete_file` *(mutating)*: Delete a file from a repository branch.
- `list_branches`: List repository branches.
- `create_branch` *(mutating)*: Create a branch off a branch or commit SHA.
- `fork_repository` *(mutating)*: Fork a repository into user or organization namespace.

### Pull Requests (`src/tools/pull-requests.js`)
- `list_pull_requests`: List PRs with summarized metadata.
- `get_pull_request`: Fetch detailed PR details.
- `get_pull_request_diff`: Retrieve token-sliced unified diff.
- `create_pull_request` *(mutating)*: Create a new PR.
- `update_pull_request` *(mutating)*: Update PR title, body, state, or target branch.
- `merge_pull_request` *(mutating)*: Merge PR (merge, squash, or rebase).
- `list_pull_request_comments`: List inline review comments.
- `create_pull_request_comment` *(mutating)*: Add inline diff comment.
- `create_pull_request_reply` *(mutating)*: Reply to an existing review thread.

### Issues (`src/tools/issues.js`)
- `list_issues`: List issues (excluding PRs) with summary metadata.
- `get_issue`: Get issue description and metadata.
- `create_issue` *(mutating)*: Create a new issue.
- `update_issue` *(mutating)*: Update issue fields, labels, state, or assignees.
- `list_issue_comments`: List comments on an issue.
- `create_issue_comment` *(mutating)*: Post a comment on an issue.
- `list_labels`: List repository labels.
- `create_label` *(mutating)*: Create a repository label.

### GitHub Actions (`src/tools/actions.js`)
- `list_workflows`: List CI/CD workflow files.
- `list_workflow_runs`: List workflow runs with status and conclusions.
- `get_workflow_run`: Inspect a specific workflow execution.
- `list_workflow_run_jobs`: List jobs and steps.
- `get_job_logs`: Fetch and safely tail the execution log.
- `trigger_workflow` *(mutating)*: Dispatch a workflow with inputs.
- `cancel_workflow_run` *(mutating)*: Cancel a running workflow.
- `rerun_workflow` *(mutating)*: Re-run a completed workflow.

### Releases & Tags (`src/tools/releases.js`)
- `list_releases`: List releases and assets.
- `get_release`: Fetch release by tag or ID.
- `create_release` *(mutating)*: Publish a release.
- `list_tags`: List Git tags.
- `create_tag` *(mutating)*: Create a tag reference.

### User & Organizations (`src/tools/user.js`)
- `get_authenticated_user`: Retrieve authenticated user profile.
- `get_user`: Retrieve public profile of a user.
- `list_user_organizations`: List organizations for current user.
- `list_accessible_repositories`: List accessible repositories.

---

## Configuration & Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub Personal Access Token (classic or fine-grained) | *Required* |
| `GITHUB_TOKEN` | Alternative token variable name | - |
| `GITHUB_API_URL` | Base API URL | `https://api.github.com` |
| `GITHUB_READ_ONLY` | Enable 3-tier read-only mode (`true`, `1`, `yes`) | `false` |

---

## MCP Client Configuration Example

In `antigravity.json` or your MCP client configuration:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["/Users/sumirati/src/antigravity/MCP-github/index.js"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here",
        "GITHUB_READ_ONLY": "false"
      }
    }
  }
}
```

---

## License

MIT License — Copyright (c) 2026 sumirati@buggycode.net.
