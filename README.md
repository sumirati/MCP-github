# @sumirati/mcp-github

Model Context Protocol (MCP) server for GitHub REST API, engineered specifically for autonomous AI agents and developer workflows.

Architecturally aligned with `@sumirati/mcp-gitlab`, this server implements the **5-Tool Hybrid Architecture (2026 AI-Native Standard)** with a strict **Token Economy First** design, native zero-dependency HTTP client, and a **3-Tier Read-Only** security guard.

---

## 1. Architectural Mandate: The 5-Tool Hybrid Architecture (2026 Standard)

Exposing 50–100+ eager tool definitions floods every LLM completion with thousands of redundant schema tokens ("System Prompt Tax") and degrades reasoning coherence. 

`@sumirati/mcp-github` exposes **exactly 5 eager tools** to the client:
1. **Meta Discovery Tool (`github_find_actions`)**: Dynamic discovery tool for searching the catalog of 75 GitHub actions across 12 domains. It returns parameter schemas on-demand.
2. **Meta Execution Tool (`github_execute_action`)**: Universal execution dispatcher with strict input validation and recursive token projection filters.
3. **Eager Daily Driver #1 (`get_file_contents`)**: Instant file reading or directory listing without cloning.
4. **Eager Daily Driver #2 (`get_repository`)**: Instant repository inspection, metadata, topics, and clone URLs.
5. **Eager Daily Driver #3 (`get_commit`)**: Instant commit inspection, author details, and token-capped diffs.

```
                    ┌──────────────────────────────────────────────┐
                    │               LLM Context Window             │
                    │   5 Eager Tools (~900 tokens vs ~14.7k tax)  │
                    └──────┬──────────────────────┬──────────┬─────┘
                           │                      │          │
             get_file_contents             get_repository  get_commit
             (Daily Driver #1)             (Daily Driver #2)(Daily Driver #3)
                           │                      │          │
                           ▼                      ▼          ▼
            ┌────────────────────────────┐ ┌─────────────────────────┐
            │   github_find_actions      │ │  github_execute_action  │
            │ (Search 75-Action Catalog) │ │ (Execute any of the 75) │
            └──────────────┬─────────────┘ └───────────┬─────────────┘
                           │                           │
                           ▼                           ▼
            ┌────────────────────────────────────────────────────────┐
            │         Recursive Output Projection Filter             │
            │ (Strips _links, avatar_url, node_id, 70%+ token save)  │
            └──────────────────────────┬─────────────────────────────┘
                                       │
                                       ▼
                             GitHub REST API v3
```

---

## 2. Token Economy & Output Projection Filters

Raw GitHub REST API responses are notoriously heavy (often 30KB–100KB per Issue or PR). `@sumirati/mcp-github` enforces strict token economy:

- **System Prompt Tax Reduction (>93% savings)**: Shrinks MCP tool definition footprint from ~14.7k tokens down to **~900 tokens**.
- **Recursive Output Projection Filter (`projectOutput`)**: Automatically strips redundant metadata fields (`_links`, `avatar_url`, `gravatar_id`, `node_id`, `site_admin`, user navigation URLs, internal API links, and null/empty fields) before payloads reach the LLM, guaranteeing **70%+ output token savings**.
- **Unified Diff Truncation**: PR and commit diffs are capped by line count (`max_diff_lines`, default: 400).
- **Safe Log Tailing**: CI workflow job logs extract the failure tail (`tail_lines`, default: 200) instead of megabyte log dumps.

---

## 3. The 5 Eager Tools

| Tool Name | Type | Description |
| :--- | :---: | :--- |
| `github_find_actions` | Discovery | Search the 75-action catalog by keyword or domain filter. Returns schemas on demand. |
| `github_execute_action` | Execution | Dispatches any catalog action with input validation and token compression. |
| `get_file_contents` | Daily Driver | Read file contents (Base64 auto-decoded) or directory entries at any git ref. |
| `get_repository` | Daily Driver | Inspect repository metadata, default branch, visibility, topics, and clone URLs. |
| `get_commit` | Daily Driver | Inspect commit metadata, author details, message, and token-budget capped diffs. |

### Tool Annotations (Glama TDQS Tier A Compliant)
All tools include explicit MCP annotations:
- `readOnlyHint`: Boolean flag marking side-effect-free operations.
- `destructiveHint`: Boolean flag marking permanent modifications or deletions.
- `idempotentHint`: Boolean flag indicating safe replayability.
- `openWorldHint`: Explicit indication of network-bound execution.

---

## 4. The 75-Action Catalog (via `github_execute_action`)

All 75 operations can be discovered via `github_find_actions` and executed via `github_execute_action`:

### 1. Repositories (11 actions)
- `search_repositories`: Search repositories with queries and filters.
- `get_repository`: Get repository metadata, stats, and default branch.
- `create_repository` *(mutating)*: Create a new repository under user or organization.
- `get_file_contents`: Read file or directory content with automatic Base64 decoding.
- `create_or_update_file` *(mutating)*: Create or update a file with commit message.
- `delete_file` *(mutating)*: Delete a file from a repository branch.
- `list_branches`: List repository branches.
- `get_branch`: Get branch details and protection status.
- `create_branch` *(mutating)*: Create a branch off a branch or commit SHA.
- `delete_branch` *(mutating)*: Delete a branch (protected from deleting default branch).
- `fork_repository` *(mutating)*: Fork a repository into user or organization namespace.

### 2. Commits & Statuses (4 actions)
- `list_commits`: List commits in a repository with author, message, and SHA summaries.
- `get_commit`: Get detailed commit info, file stats, and token-capped diffs.
- `get_commit_status`: Get combined CI status checks and context states for a commit.
- `create_commit_status` *(mutating)*: Create or update a CI commit status check.

### 3. Pull Requests (11 actions)
- `list_pull_requests`: List PRs with summarized metadata.
- `get_pull_request`: Fetch detailed PR description, state, and mergeability.
- `get_pull_request_diff`: Retrieve token-sliced unified diff.
- `create_pull_request` *(mutating)*: Create a new pull request.
- `update_pull_request` *(mutating)*: Update PR title, body, state, or target branch.
- `merge_pull_request` *(mutating)*: Merge PR (merge, squash, or rebase).
- `list_pull_request_comments`: List inline review comments.
- `create_pull_request_comment` *(mutating)*: Add inline diff comment.
- `create_pull_request_reply` *(mutating)*: Reply to an existing review thread.
- `list_pull_request_reviews`: List PR reviews with submitter and state.
- `create_pull_request_review` *(mutating)*: Submit an approval, change request, or review comment.

### 4. Issues & Labels (8 actions)
- `list_issues`: List issues (excluding PRs) with summary metadata.
- `get_issue`: Get issue description and metadata.
- `create_issue` *(mutating)*: Create a new issue.
- `update_issue` *(mutating)*: Update issue fields, labels, state, or assignees.
- `list_issue_comments`: List comments on an issue.
- `create_issue_comment` *(mutating)*: Post a comment on an issue.
- `list_labels`: List repository labels.
- `create_label` *(mutating)*: Create a repository label.

### 5. Milestones (4 actions)
- `list_milestones`: List milestones with state, open/closed issues, and due dates.
- `get_milestone`: Get details of a specific milestone.
- `create_milestone` *(mutating)*: Create a milestone with title, description, and due date.
- `update_milestone` *(mutating)*: Update milestone title, state, description, or due date.

### 6. Collaborators (4 actions)
- `list_collaborators`: List repository collaborators and their role names.
- `get_collaborator_permission`: Check specific user permission level on a repository.
- `add_collaborator` *(mutating)*: Add or invite a collaborator with permissions.
- `remove_collaborator` *(mutating)*: Remove a collaborator from a repository.

### 7. Actions Variables & Secrets (6 actions)
- `list_actions_variables`: List GitHub Actions configuration variables.
- `get_actions_variable`: Get a specific repository variable by name.
- `create_actions_variable` *(mutating)*: Create a configuration variable for Actions.
- `update_actions_variable` *(mutating)*: Update value of an existing Actions variable.
- `delete_actions_variable` *(mutating)*: Delete an Actions variable.
- `list_actions_secrets`: List Actions secret names and last updated timestamps (values redacted).

### 8. Gists (5 actions)
- `list_gists`: List public or user gists with file summaries.
- `get_gist`: Get a gist by ID including file contents and descriptions.
- `create_gist` *(mutating)*: Create a new public or secret gist with one or more files.
- `update_gist` *(mutating)*: Update gist description or file contents.
- `delete_gist` *(mutating)*: Delete a gist by ID.

### 9. GitHub Actions & CI (8 actions)
- `list_workflows`: List CI/CD workflow files.
- `list_workflow_runs`: List workflow runs with status and conclusions.
- `get_workflow_run`: Inspect a specific workflow execution.
- `list_workflow_run_jobs`: List jobs and steps.
- `get_job_logs`: Fetch and safely tail the execution log.
- `trigger_workflow` *(mutating)*: Dispatch a workflow with inputs.
- `cancel_workflow_run` *(mutating)*: Cancel a running workflow.
- `rerun_workflow` *(mutating)*: Re-run a completed workflow.

### 10. Releases & Git Tags (5 actions)
- `list_releases`: List releases and assets.
- `get_release`: Fetch release by tag or ID.
- `create_release` *(mutating)*: Publish a release.
- `list_tags`: List Git tags.
- `create_tag` *(mutating)*: Create a tag reference.

### 11. Webhooks & Topics (4 actions)
- `get_repository_topics`: Get topic tags for a repository.
- `set_repository_topics` *(mutating)*: Replace repository topic tags.
- `list_repository_webhooks`: List configured repository webhooks.
- `get_repository_webhook`: Get webhook configuration and active events.

### 12. Security & Dependabot (1 action)
- `list_dependabot_alerts`: List Dependabot vulnerability alerts and severity levels.

### 13. User & Organizations (4 actions)
- `get_authenticated_user`: Retrieve authenticated user profile.
- `get_user`: Retrieve public profile of a user.
- `list_user_organizations`: List organizations for current user.
- `list_accessible_repositories`: List accessible repositories.

---

## 5. Security: 3-Tier Read-Only Mode (`GITHUB_READ_ONLY=true`)

When `GITHUB_READ_ONLY=true` is set, the server enforces safety across three redundant layers:
1. **Catalog Layer**: `github_find_actions` flags mutating tools and `github_execute_action` blocks any mutating action before execution.
2. **Dispatch Guard**: Invocations of mutating actions reject immediately with descriptive errors.
3. **HTTP Client Interceptor**: `src/client.js` blocks any non-`GET` and non-`HEAD` request from being dispatched to GitHub.

---

## 6. Quickstart & Installation

### Option 1: Run with `npx` (No installation needed)

```bash
npx -y @sumirati/mcp-github
```

### Option 2: Install Globally

```bash
npm install -g @sumirati/mcp-github
mcp-github
```

### Option 3: Local Clone

```bash
git clone http://192.168.99.9/buggycode/mcp-github.git
cd mcp-github
npm install
node index.js
```

---

## 7. Configuration & Environment Variables

Configure the following environment variables:

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | **Yes** | — | GitHub Personal Access Token (classic or fine-grained) |
| `GITHUB_TOKEN` | No | — | Alternative token variable name |
| `GITHUB_API_URL` | No | `https://api.github.com` | Base API URL (or GitHub Enterprise Server) |
| `GITHUB_READ_ONLY` | No | `false` | Enable 3-tier read-only mode (`true`, `1`, `yes`) |
| `GITHUB_TOOL_DOMAINS` | No | `*` (all) | Comma-separated domain filter (e.g. `'repositories,pull-requests,issues'`) |

---

## 8. Client Configuration

### Google Antigravity / Claude Desktop / Cursor

Add to your MCP configuration file (`mcp_config.json` or `claude_desktop_config.json`):

#### Using npm / npx (Recommended):
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@sumirati/mcp-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here",
        "GITHUB_READ_ONLY": "false"
      }
    }
  }
}
```

#### Using local clone:
```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["/path/to/mcp-github/index.js"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here",
        "GITHUB_READ_ONLY": "false"
      }
    }
  }
}
```

---

## 9. Acknowledgements & Attribution

- **jmrplens/gitlab-mcp-server**: Dynamic action discovery and meta-dispatcher pattern concepts ([https://github.com/jmrplens/gitlab-mcp-server](https://github.com/jmrplens/gitlab-mcp-server)).
- **@sumirati/mcp-gitlab**: Sibling project architecture, 3-tier read-only safety, and token projection standards ([https://gitlab.com/sumirati/mcp-gitlab](https://gitlab.com/sumirati/mcp-gitlab)).

---

## 10. License

MIT License — Copyright (c) 2026 sumirati@buggycode.net.
