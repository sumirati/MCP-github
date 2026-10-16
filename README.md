# GitHub MCP Server (`@sumirati/mcp-github`)

A modern, 2026 AI-native Model Context Protocol (MCP) server for GitHub REST API, engineered for autonomous AI agents and developer workflows.

[![npm version](https://img.shields.io/npm/v/@sumirati/mcp-github.svg)](https://www.npmjs.com/package/@sumirati/mcp-github)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-sumirati%2Fmcp--github-181717?logo=github)](https://github.com/sumirati/mcp-github)

---

## What makes v2 Unique: The 2026 5-Tool Hybrid Standard

In early MCP servers, exposing 50–100+ eager tool definitions flooded every LLM turn with thousands of redundant schema tokens ("System Prompt Tax") and degraded reasoning coherence.

`@sumirati/mcp-github` solves this with a **5-Tool Hybrid Surface**:
- **Glama TDQS Coherence Tier A (5/5)**: By exposing exactly 5 tools to the client, the server sits in the ideal 3–15 tool coherence sweet spot.
- **Ultra-Lean System Prompt Tax**: Drops schema overhead from 23,112 tokens (92,447 B) down to **1,125 tokens (4,498 B)** (95.1% reduction), preserving context windows and maximizing LLM prompt-cache hits.
- **Zero-Hop Hourly Drivers**: The 3 operations developers and agents use constantly (`get_file_contents`, `get_repository`, `get_commit`) remain eager tools for instant zero-hop execution.
- **100% Platform Access on Demand**: The entire platform surface of **83 actions across 13 domains** is accessible on-demand via dynamic action discovery (`github_find_actions` $\rightarrow$ `github_execute_action`), delivering **91%–99% token savings** with default high-density Markdown tables and summaries (`format: "markdown" | "json"`).
- **Resilient Fallback**: If an agent directly invokes any catalog action name (e.g. `list_pull_requests`), the server dynamically executes it with full input validation and projection.

```text
LLM Prompt Context (5-Tool Hybrid Surface):
├── 1. github_find_actions(query, [domain], [format])     [Meta Discovery]
├── 2. github_execute_action(action, params, [format])   [Meta Dynamic Execution]
├── 3. get_file_contents(owner, repo, path)               [Eager Daily Driver #1]
├── 4. get_repository(owner, repo)                        [Eager Daily Driver #2]
└── 5. get_commit(owner, repo, ref)                       [Eager Daily Driver #3]

Under the hood (Dynamic Registry):
└── 83 Curated Actions across 13 Domains (grounded in GitHub REST API 2022-11-28)
```

---

## Core Capabilities Across 13 Domains

1. **Repositories & Branch Governance (`repositories`, 12 actions)**: Full repository lifecycle, branch management, branch protection rules (`get_branch_protection`), file reading (auto Base64-decoded, symbol outlines, line slicing), single-file commits, and forks.
2. **Commits & Commit Statuses (`commits`, 6 actions)**: Commit history, token-capped commit diffs (`get_commit`), atomic multi-file commits via Git Trees API (`create_commit`, `push_files`), and commit status checks.
3. **Pull Requests & Code Reviews (`pull-requests`, 11 actions)**: PR lifecycle (`create`, `update`, `merge`), review comments, inline diff reviews, and unified diff inspection with lockfile filtering.
4. **Issues & Labels (`issues`, 8 actions)**: Issue tracking, upstream indexed filtering, conversation comments, and label management.
5. **Project Milestones (`milestones`, 4 actions)**: Milestone creation, progress tracking, and deadline management.
6. **Collaborators & Permissions (`collaborators`, 4 actions)**: Audit and manage repository collaborators and permission levels.
7. **Actions Variables & Secrets (`variables`, 6 actions)**: Manage repository Actions configuration variables and inspect secret metadata.
8. **Gists & Code Snippets (`gists`, 5 actions)**: Full gist lifecycle for sharing multi-file code snippets and configurations.
9. **GitHub Actions & CI/CD (`actions`, 10 actions)**: Workflow inspection, workflow runs, job step breakdown, build artifacts (`list_workflow_run_artifacts`, `get_workflow_run_artifact`), smart failure log extraction (`get_job_logs`), run cancel/rerun, and manual workflow dispatch.
10. **Releases & Git Tags (`releases`, 5 actions)**: Release publishing, lightweight/annotated tag creation, and release asset inspection.
11. **User, Organizations, Teams & Diagnostics (`user`, 7 actions)**: Authenticated user identity, organization inspection, team creation (`create_team`), accessible repositories, and API health/rate-limit diagnostics (`system_health_check`).
12. **Webhooks & Repository Topics (`webhooks`, 4 actions)**: Audit repository event webhooks and manage repository topic tags.
13. **Security & Dependabot (`security`, 1 action)**: Audit Dependabot vulnerability alerts by state and severity.

---

## Quickstart & Installation

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
git clone https://github.com/sumirati/mcp-github.git
cd mcp-github
npm install
npm test
npm start
```

---

## Environment Configuration

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | **Yes** | — | GitHub Personal Access Token (classic or fine-grained) |
| `GITHUB_TOKEN` | No | — | Alternative token variable name |
| `GITHUB_API_URL` | No | `https://api.github.com` | Base API URL (or GitHub Enterprise Server) |
| `GITHUB_READ_ONLY` | No | `false` | Enable 3-tier read-only mode (`true`, `1`, `yes`) |
| `GITHUB_EXPOSE_ALL_TOOLS` | No | `false` | Set to `true` (or `GITHUB_EXPOSE_LEGACY_TOOLS=true`) to expose all 83 tools directly on `ListTools` for legacy clients |
| `MCP_OUTPUT_FORMAT` | No | `markdown` | Default output format for tool execution (`markdown` or `json`) |

---

## Client Configuration

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
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-github-token>",
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
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-github-token>",
        "GITHUB_READ_ONLY": "false"
      }
    }
  }
}
```

---

## Complete Action Catalog Reference (83 Actions)

All 83 actions feature strict Zod input validation and 2-tier output projection:

### 1. The 5 Client-Exposed Tools (Hybrid Mode)
| Tool | Type | Description |
| :--- | :---: | :--- |
| `github_find_actions` | Meta | Search and discover available GitHub operations across all 13 domains with compact parameter signatures |
| `github_execute_action` | Meta | Execute any discovered GitHub platform action with input validation and token-optimized projection |
| `get_file_contents` | Eager | Read raw file contents (auto Base64 decoded), symbol outlines, line ranges, or directory listings at any ref |
| `get_repository` | Eager | Retrieve repository metadata, visibility, description, default branch, HTML URL, and counts |
| `get_commit` | Eager | Inspect Git commit details, author info, and token-capped file diffs |

<!-- START_CATALOG_REFERENCE -->

### 2. Repositories & Branches (`repositories` — 12 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `search_repositories` | Search for repositories across GitHub or within an organization using query qualifiers (e.g. 'org:myorg language:typescript') with capped pagination (max 100). If owner and repository name are known, prefer 'get_repository' for exact O(1) lookup. | No |
| `get_repository` | Get repository metadata, visibility, description, default branch, clone URL, and statistics for an exact owner/repo. Use when verifying repository settings or checking default branch name. | No |
| `create_repository` | Create a new GitHub repository under the authenticated user account or a specified organization. Requires write permissions and GITHUB_READ_ONLY=false. Auto-initializes with a default README commit unless auto_init is false. | **Yes** |
| `get_file_contents` | Read current file contents, extract symbol outlines ('outline_only: true'), slice line ranges, or list directory entries at a specified git ref. Automatically decodes Base64 into UTF-8. Use 'outline_only: true' first to inspect structure in ~50-100 tokens, then request specific line ranges. | No |
| `create_or_update_file` | Create a new file or overwrite an existing file on a branch in a single atomic commit. If updating, provide the file's current blob SHA in 'sha' (or leave empty to auto-resolve). Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `delete_file` | Delete an existing file from a branch in a git commit. Requires the current blob SHA to guard against concurrent overwrites. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `list_branches` | List branches in a repository with protection status and head commit SHAs. Supports upstream filtering by protected status and capped pagination (max 100). If branch name is already known, prefer 'get_branch'. | No |
| `get_branch` | Get detailed status of a specific branch, including branch protection rules and latest commit details. Use to verify branch existence or protection policies before merging or deleting. | No |
| `get_branch_protection` | Retrieve comprehensive branch protection rules for a specific Git branch, including required status checks, required reviews, admin enforcement, and force-push / deletion restrictions. | No |
| `create_branch` | Create a new git branch pointing to a commit SHA or branched from an existing branch (defaults to 'main'). Use before committing changes or opening a pull request. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `delete_branch` | Delete a branch from a repository. Protected: explicitly rejects requests to delete the default branch (e.g. 'main') to prevent repository breakage. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `fork_repository` | Fork a repository into the authenticated user's account or a specified organization namespace. Use when contributing to upstream projects where direct push access is restricted. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |

### 3. Git Commits & Statuses (`commits` — 6 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_commits` | List repository commit history chronologically with upstream filtering (sha, path, author, since, until) and capped pagination (max 100). For viewing actual line-by-line diffs of a commit, use get_commit instead. | No |
| `get_commit` | Get detailed commit metadata, file modification statistics, and unified diffs for a specific commit SHA or ref. Use when reviewing code changes in a commit or debugging regressions. Diffs are token-budget optimized and truncated at max_diff_lines (default: 400 lines). | No |
| `create_commit` | Create an atomic Git commit with multiple created, updated, or deleted files using the GitHub Git Trees API. Use when refactoring, applying multi-file code changes, or updating code and docs together. Avoids multiple individual single-file commits and does not require local git cloning. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `push_files` | Alias for 'create_commit': atomically commit additions, modifications, or deletions to multiple files in a single Git commit via the GitHub Git Database API. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `get_commit_status` | Get the combined status check state (pending, success, failure) and individual check runs for a commit SHA or branch ref. | No |
| `create_commit_status` | Set or update a commit status check (pending, success, failure, error) on a specific commit SHA. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |

### 4. Pull Requests & Code Reviews (`pull-requests` — 11 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_pull_requests` | List and filter pull requests with upstream indexed parameters (state, head, base) and capped pagination (max 100). To inspect a known PR, prefer 'get_pull_request' with pull_number; for diffs, use get_pull_request_diff. | No |
| `get_pull_request` | Get detailed status of a specific pull request including mergeability (clean, dirty, unstable), head/base branch refs, author, and assignees. Use to check if a PR is ready to merge or blocked. Do NOT use to read code changes; use get_pull_request_diff instead. | No |
| `get_pull_request_diff` | Retrieve unified git diff for a pull request to review code modifications. Use this tool when analyzing code changes, reviewing patches, or preparing inline comments. Do NOT use for checking PR mergeability or metadata (use get_pull_request instead). Diffs are token-optimized and automatically truncated at max_lines (default: 400 lines) to prevent LLM context overflows. | No |
| `create_pull_request` | Create a new pull request from a head branch into a base branch. Requires write permissions and GITHUB_READ_ONLY=false. The head branch must already exist and have at least one commit difference from the base branch. | **Yes** |
| `update_pull_request` | Update an existing pull request's title, body, open/closed state, or base branch. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `merge_pull_request` | Merge a pull request into its base branch using merge, squash, or rebase method. Requires write/admin permissions and GITHUB_READ_ONLY=false. Ensure the PR mergeable state is clean before merging. | **Yes** |
| `list_pull_request_comments` | List inline code review comments anchored to specific diff lines of a pull request. Use when inspecting line-by-line review feedback. For overall PR review approvals or change requests, use list_pull_request_reviews instead. | No |
| `create_pull_request_comment` | Post an inline review comment anchored to a specific file and line number in the pull request. Requires commit_id, path, and line number in the file. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `create_pull_request_reply` | Reply to an existing pull request review comment thread. Requires comment_id of the parent comment. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `list_pull_request_reviews` | List formal code reviews (approvals, change requests, comment summaries) submitted on a pull request. Use to check reviewer decisions and approval gates before merging. | No |
| `create_pull_request_review` | Submit a formal code review on a pull request with an approval decision (APPROVE, REQUEST_CHANGES, or COMMENT) and optional summary body or inline comments. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |

### 5. Issues & Labels (`issues` — 8 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_issues` | Search and filter repository issue tickets with upstream indexed parameters (state, labels, assignee, creator, mentioned, milestone, since) and capped pagination (max 100). Filters out pull requests. If the issue number is already known, prefer 'get_issue' for exact O(1) lookup. | No |
| `get_issue` | Get full details of a specific issue ticket, including markdown body, assignees, milestone, state reason, and comment count. Use when investigating a bug report or reading issue specifications. | No |
| `create_issue` | Create a new issue ticket in a repository with optional labels, assignees, and milestone. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `update_issue` | Update an existing issue's title, body, state ('open'/'closed'), state reason ('completed'/'not_planned'), labels, assignees, or milestone. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `list_issue_comments` | List discussion comments on an issue ticket chronologically. Use to read conversation history, debugging updates, or user feedback on an issue. | No |
| `create_issue_comment` | Add a markdown comment to an issue ticket. Use to reply to discussions, log progress, or provide resolution details. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `list_labels` | List all labels configured in a repository with their names, descriptions, and hex color codes. Use to discover available tags before creating or updating issues. | No |
| `create_label` | Create a new label in a repository with a name, description, and 6-character hex color code. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |

### 6. Project Milestones (`milestones` — 4 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_milestones` | List project milestones in a repository with open/closed issue counts and due dates. Use to monitor release roadmaps or locate milestone numbers before associating them with issues or PRs. | No |
| `get_milestone` | Get detailed status of a specific milestone, including title, open/closed issues count, creation date, and deadline. Use when reviewing milestone progress or inspecting milestone deadlines. | No |
| `create_milestone` | Create a new project milestone with a title, description, and optional due date. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `update_milestone` | Update an existing milestone's title, description, state ('open'/'closed'), or due date. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |

### 7. Collaborators & Roles (`collaborators` — 4 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_collaborators` | List collaborators who have access to a repository along with their assigned roles and permissions. Use to audit team access or check user memberships. | No |
| `get_collaborator_permission` | Check a specific user's exact permission level ('admin', 'maintain', 'write', 'triage', 'read', or 'none') on a repository. Use to verify authorization before attempting privileged operations. | No |
| `add_collaborator` | Add or invite a GitHub user to collaborate on a repository with a specified permission level. If the user is not an organization member, this sends a collaboration invitation. Requires admin permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `remove_collaborator` | Remove a collaborator from a repository, revoking their direct access. Requires admin permissions and GITHUB_READ_ONLY=false. | **Yes** |

### 8. Actions Variables & Secrets (`variables` — 6 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_actions_variables` | List non-sensitive GitHub Actions configuration variables defined on a repository with their values and timestamps. Use for inspecting build environment parameters. | No |
| `get_actions_variable` | Get the plain text value and last updated timestamp of a specific GitHub Actions repository variable by name. | No |
| `create_actions_variable` | Create a non-sensitive configuration variable for GitHub Actions workflows. Requires write/admin permissions and GITHUB_READ_ONLY=false. For sensitive credentials, use repository secrets instead. | **Yes** |
| `update_actions_variable` | Update the value of an existing non-sensitive GitHub Actions configuration variable. Requires write/admin permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `delete_actions_variable` | Delete a non-sensitive configuration variable from GitHub Actions. Requires write/admin permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `list_actions_secrets` | List GitHub Actions repository secret names and timestamps. Behavioral safety: secret values are permanently masked by GitHub and never returned in plaintext. | No |

### 9. Gists & Code Snippets (`gists` — 5 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_gists` | List code snippets and gists owned by the authenticated user with file summaries. Use to locate code snippet IDs before reading or editing. | No |
| `get_gist` | Get full source code contents, files, and description of a specific GitHub gist by ID. Use to inspect standalone code snippets or configuration templates. | No |
| `create_gist` | Create a new public or secret GitHub gist with one or more files. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `update_gist` | Update an existing gist's description or modify/rename/delete individual files within the gist. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `delete_gist` | Permanently delete a gist by its identifier. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |

### 10. GitHub Actions & CI/CD Observability (`actions` — 10 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_workflows` | List GitHub Actions CI/CD workflow files configured in a repository (.github/workflows). Use to discover workflow names and IDs before triggering or inspecting runs. | No |
| `list_workflow_run_artifacts` | List artifacts produced by a specific GitHub Actions workflow run, including file size, download archive URLs, and expiration timestamps. Use to discover generated build outputs, test logs, or release binaries. | No |
| `get_workflow_run_artifact` | Retrieve metadata and download archive URL for a specific GitHub Actions build artifact by its numeric artifact ID. Use when downloading build deliverables or inspecting individual artifacts. | No |
| `list_workflow_runs` | List workflow execution runs with status, conclusion ('success', 'failure'), triggering event, and commit SHA. Use to check CI/CD pipeline health or find run IDs. | No |
| `get_workflow_run` | Get detailed status, timing, and conclusion for a specific workflow execution run. Use when monitoring CI pipeline completion. | No |
| `list_workflow_run_jobs` | List all individual jobs and step breakdown within a workflow run. Use to identify which specific job or step failed during a build. | No |
| `get_job_logs` | Fetch plain text execution logs for an Actions job with smart failure extraction and ANSI stripping. Behavioral safety: scans for errors/panics to extract failure blocks and trims massive logs to preserve LLM token context. | No |
| `trigger_workflow` | Dispatch a workflow run on a branch or tag via workflow_dispatch event with custom inputs. Requires write permissions and GITHUB_READ_ONLY=false. The target workflow file must define a workflow_dispatch trigger. | **Yes** |
| `cancel_workflow_run` | Cancel a queued or currently executing GitHub Actions workflow run. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `rerun_workflow` | Re-execute all jobs in a completed or failed GitHub Actions workflow run. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |

### 11. Releases & Git Tags (`releases` — 5 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_releases` | List published and draft releases in a repository with release titles, asset download counts, and published dates. Use to check release history or download URLs. | No |
| `get_release` | Get full details of a specific release by tag name or numeric release ID, including changelog body and asset links. | No |
| `create_release` | Publish a formal GitHub release for a tag, with title, markdown release notes/changelog, and pre-release/draft flags. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `list_tags` | List git tags in a repository with tag names and commit SHAs. Use to inspect available version tags before publishing a release. | No |
| `create_tag` | Create a git tag (lightweight reference or annotated tag object when message is provided) pointing to a specific commit SHA. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |

### 12. User, Organizations & Teams (`user` — 7 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `system_health_check` | Perform end-to-end connectivity, latency, rate limit quota, and permission diagnostics against the GitHub API. Verifies token validity, authenticated account details, remaining rate limits, and active read-only policy. | No |
| `get_authenticated_user` | Retrieve profile metadata (login, name, email, public_repos, followers) for the currently authenticated GitHub token. Use to verify token identity and scope. | No |
| `get_user` | Retrieve public profile information (login, name, company, bio, public_repos count) for any specified GitHub user by username. | No |
| `list_user_organizations` | List GitHub organizations that the authenticated user belongs to. Use to discover org namespaces for creating or querying repositories. | No |
| `get_organization` | Retrieve comprehensive details for a specific GitHub organization (name, description, email, blog, public/private repos). Use when verifying organization access or inspecting org settings. | No |
| `create_team` | Create a new team in a GitHub organization. Supports parent_team_id to establish nested child teams. Requires organization owner/admin privileges and GITHUB_READ_ONLY=false. | **Yes** |
| `list_accessible_repositories` | List repositories accessible to the authenticated user (owned, collaborated on, or member of). Use to discover available repositories across accounts. | No |

### 13. Webhooks & Topics (`webhooks` — 4 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `get_repository_topics` | Get all topic tags associated with a GitHub repository. Use to inspect project categories and discoverability keywords. | No |
| `set_repository_topics` | Replace all topic tags on a repository with a new array of topic strings. Requires write permissions and GITHUB_READ_ONLY=false. | **Yes** |
| `list_repository_webhooks` | List configured event webhooks on a repository with target URLs, active status, and subscribed event triggers. | No |
| `get_repository_webhook` | Get detailed configuration of a specific repository webhook by ID, including delivery URL and subscribed events. | No |

### 14. Security & Dependabot (`security` — 1 action)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_dependabot_alerts` | List Dependabot vulnerability alerts for a repository, including affected package, severity (critical, high, medium, low), and patch advisory. | No |

<!-- END_CATALOG_REFERENCE -->

---

## Benchmarks: Reproducible Token Economy Proof (`test/benchmark-test.js`)

Grounded strictly in official **GitHub REST API (`2022-11-28`)** response schemas (`test/fixtures/github-api-v3-fixtures.js`) and verified on every `npm test` run via `node test/benchmark-test.js`:

| Operation | Raw GitHub API (`2022-11-28`) | Projected JSON (`format: "json"`) | Default Markdown (`format: "markdown"`) | Verified Reduction |
| :--- | :---: | :---: | :---: | :---: |
| **System Prompt Tax (83 tools vs 5 hybrid tools)** | 23,112 tokens (92,447 B) | — | **1,125 tokens (4,498 B)** | **95.1% savings** |
| **`get_repository` (1 repository)** | 1,321 tokens (5,283 B) | 104 tokens (414 B) | **85 tokens (340 B)** | **93.6% savings** |
| **`list_issues` (10 issues)** | 15,375 tokens (61,499 B) | 1,567 tokens (6,267 B) | **313 tokens (1,250 B)** | **98.0% savings** |
| **`list_pull_requests` (10 PRs with `head`/`base` repo)** | 46,536 tokens (186,141 B) | 1,586 tokens (6,341 B) | **330 tokens (1,317 B)** | **99.3% savings** |
| **`list_workflow_runs` (10 workflow runs)** | 14,957 tokens (59,826 B) | 839 tokens (3,356 B) | **212 tokens (846 B)** | **98.6% savings** |
| **`get_file_contents` (`outline_only: true`)** | 3,589 tokens (14,355 B) | 331 tokens (1,323 B) | **314 tokens (1,255 B)** | **91.3% savings** |

### How Token Compression Works
- **System Prompt Tax Reduction (95.1% savings)**: Shrinks MCP `ListTools` schema footprint from 83 full tool schemas (23,112 tokens / 92,447 B) down to the 5-tool hybrid surface (1,125 tokens / 4,498 B).
- **Recursive Output Projection Filter (`projectOutput`)**: Automatically strips GitHub REST API v3 hypermedia template URLs (`*_url` RFC 6570 templates), `avatar_url`, `gravatar_id`, `node_id`, `site_admin`, `_links`, internal `api.github.com` self-links, and `null`/`""` fields.
- **Smart Diff & Lockfile Truncation**: Commit and PR diffs automatically collapse dependency lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `go.sum`, `Cargo.lock`, `*.min.js`) via `ignore_lockfiles: true` by default. Pass `ignore_lockfiles: false` to inspect full lockfile diffs.
- **Conservative Default Pagination**: All list actions default to `per_page: 10` (max: 100).
- **Default High-Density Markdown Format**: Discovery (`github_find_actions`), execution (`github_execute_action`), and all 3 eager tools default to `format: "markdown"`.
- **Unified Diff Truncation**: PR (`max_lines`) and commit (`max_diff_lines`) diffs default to 400 lines.
- **Safe Log Tailing**: CI workflow job logs extract the failure block and teardown tail (`tail_lines`, default: 100) with ANSI escape sequence stripping.

---

## Roadmap

### Completed in v2.1
- [x] Upstream indexed filtering & strict pagination caps (`state`, `labels`, `assignee`, `creator`, `mentioned`, `milestone`, `since`)
- [x] Client error resilience (Secondary rate limit / abuse detection, 403/404 scope diagnostics, empty-body 201/202 handling)
- [x] Hardened output projection with recursion depth guard (`maxDepth = 32`), RFC 6570 hypermedia URL stripping, and empty collection preservation
- [x] Nested child team & organization management (`create_team`, `get_organization`)
- [x] Smart CI/CD failure log extraction & ANSI sequence stripping in `get_job_logs` (`strip_ansi`, `smart_failure`)
- [x] Outline-first code symbol extraction & line range slicing in `get_file_contents` (`outline_only`, `start_line`, `end_line`)
- [x] Atomic multi-file commits (`create_commit`, `push_files`) supporting file creation, updates, and deletions via GitHub Git Trees API
- [ ] Pre-flight mergeability & conflict verification (`get_mergeability`)
- [ ] Token scope self-auditing & permission pre-flight

### Future Horizons (v2.x)
- [ ] Standardized collection `_summary` headers to facilitate multi-turn history pruning in LiteLLM / Eigent agent orchestration
- [ ] Remote Transports: Streamable SSE and HTTP remote server modes
- [ ] Scoped GraphQL query engine for relational deep inspections
- [ ] DevSecOps code scanning & secret scanning alert queries
- [ ] Scoped & rate-guarded code search within project repositories

---

## Acknowledgements & Lineage

This project incorporates architectural concepts, schemas, and patterns from:
- **[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk)** (MIT License) — Copyright (c) Anthropic, PBC.
- **[`zod`](https://github.com/colinhacks/zod)** (MIT License) — Colin McDonnell.
- **GitHub REST API Specifications** — GitHub, Inc.
- **[`jmrplens/gitlab-mcp-server`](https://github.com/jmrplens/gitlab-mcp-server)** — Dynamic action discovery and meta-dispatcher pattern concepts.
- **[`@sumirati/mcp-gitlab`](https://gitlab.com/sumirati/mcp-gitlab)** — Sibling project architecture, 3-tier read-only mode, and token projection standards.

See [`NOTICE`](./NOTICE) for complete third-party attribution details.

---

## License

This project is licensed under the [MIT License](./LICENSE) — Copyright (c) 2026 sumirati@buggycode.net.
