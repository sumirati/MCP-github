# GitHub MCP Server (`@sumirati/mcp-github`)

A modern, 2026 AI-native Model Context Protocol (MCP) server for GitHub REST API, engineered for autonomous AI agents and developer workflows.

[![npm version](https://img.shields.io/npm/v/@sumirati/mcp-github.svg)](https://www.npmjs.com/package/@sumirati/mcp-github)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-sumirati%2Fmcp--github-181717?logo=github)](https://github.com/sumirati/mcp-github)

---

## What makes v2 Unique: The 2026 5-Tool Hybrid Standard

In early MCP servers, exposing 50–100+ eager tool definitions flooded every LLM turn with thousands of redundant schema tokens ("System Prompt Tax") and degraded reasoning coherence.

Architecturally aligned with `@sumirati/mcp-gitlab`, `@sumirati/mcp-github` solves this with a **5-Tool Hybrid Surface**:
- **Glama TDQS Coherence Tier A (5/5)**: By exposing exactly 5 tools to the client, the server sits in the ideal 3–15 tool coherence sweet spot.
- **Ultra-Lean System Prompt Tax**: Drops schema overhead from ~14.7k tokens down to **~450 tokens** (97% reduction), preserving context windows and maximizing LLM prompt-cache hits.
- **Zero-Hop Hourly Drivers**: The 3 operations developers and agents use constantly (`get_file_contents`, `get_repository`, `get_commit`) remain eager tools for instant zero-hop execution.
- **100% Platform Access on Demand**: The entire platform surface of **79 actions across 13 domains** is accessible on-demand via dynamic action discovery (`github_find_actions` $\rightarrow$ `github_execute_action`), supporting both JSON and Markdown output (`format: "json" | "markdown"`).
- **Resilient Fallback**: If an agent directly invokes any catalog action name (e.g. `list_pull_requests`), the server dynamically executes it with full input validation and projection.

```text
LLM Prompt Context (~450 tokens total):
├── 1. github_find_actions(query, [domain], [format])     [Meta Discovery]
├── 2. github_execute_action(action, params, [format])   [Meta Dynamic Execution]
├── 3. get_file_contents(owner, repo, path)               [Eager Daily Driver #1]
├── 4. get_repository(owner, repo)                        [Eager Daily Driver #2]
└── 5. get_commit(owner, repo, ref)                       [Eager Daily Driver #3]

Under the hood (Dynamic Registry):
└── 79 Curated Actions across 13 Domains (with 70%+ token reduction projections)
```

---

## Core Capabilities Across 13 Domains

1. **Enterprise Observability & Diagnostics**: End-to-end API latency, authentication verification, remaining rate limits, and read-only status (`system_health_check`).
2. **Repositories & Governance**: Full repository lifecycle, branch management, branch protection rules (`get_branch_protection`), file reading (auto Base64-decoded), atomic multi-file commits, and repository topics.
3. **Pull Requests & Code Reviews**: PR lifecycle (`create`, `update`, `merge`), review comments, inline diff reviews, and two-stage diff inspection with lockfile filtering.
4. **Issues & Milestones**: Issue tracking, milestone assignment, progress notes, and label management.
5. **CI/CD & GitHub Actions**: Workflow inspection, workflow runs, job status, build artifacts (`list_workflow_run_artifacts`, `get_workflow_run_artifact`), log tailing, run cancel/retry, and action triggers.
6. **Releases & Tags**: Release publishing, tag creation, asset inspection, and release notes management.
7. **Actions Variables & Secrets**: Manage repository and environment variables for automated CI/CD pipelines.
8. **Collaborators & Permissions**: Audit and manage repository collaborators and permission levels.
9. **Security & Dependabot**: Audit Dependabot security alerts and vulnerability reports.
10. **Gists & Snippets**: Full gist lifecycle for sharing code templates and configurations.
11. **Webhooks & Integrations**: Audit repository webhooks and subscribed event triggers.

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
| `GITHUB_EXPOSE_ALL_TOOLS` | No | `false` | Set to `true` (or `GITHUB_EXPOSE_LEGACY_TOOLS=true`) to expose all 79 tools directly on `ListTools` for legacy clients |

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

## Complete Action Catalog Reference (75 Actions)

All 75 actions feature strict input validation and 2-tier field-mask projections:

### 1. The 5 Client-Exposed Tools (Hybrid Mode)
| Tool | Type | Description |
| :--- | :---: | :--- |
| `github_find_actions` | Meta | Search and discover available GitHub operations across all 13 domains with compact parameter schemas |
| `github_execute_action` | Meta | Execute any discovered GitHub platform action with input validation and token-optimized projection |
| `get_file_contents` | Eager | Read raw file contents (auto Base64 decoded) or directory listings at any ref without cloning |
| `get_repository` | Eager | Retrieve repository metadata, visibility, description, default branch, clone URLs, and topics |
| `get_commit` | Eager | Inspect Git commit details, author info, and token-capped file diffs |

### 2. Repositories & Branches (11 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `search_repositories` | Search public or accessible GitHub repositories by query | No |
| `create_repository` | Create a new repository for the authenticated user or organization | **Yes** |
| `fork_repository` | Fork a repository to your account or specified organization | **Yes** |
| `list_branches` | List branches with commit SHAs and protection status | No |
| `get_branch` | Get detailed branch metadata, protection rules, and head commit | No |
| `create_branch` | Create a new git branch from an existing branch or SHA | **Yes** |
| `delete_branch` | Delete a git branch (destructive) | **Yes** |
| `create_or_update_file` | Create or update a single file with a commit | **Yes** |
| `delete_file` | Delete a file from a repository with a commit | **Yes** |
| `push_files` | Atomically commit multiple file additions, edits, or deletions | **Yes** |

### 3. Commits & Statuses (4 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_commits` | List chronological commit history filtered by branch, date, or author | No |
| `get_commit_status` | Get combined CI status checks and commit statuses for a ref | No |
| `create_commit_status` | Post a status check result to a specific commit SHA | **Yes** |

### 4. Pull Requests & Reviews (11 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_pull_requests` | List PRs filtered by state (`open`, `closed`, `all`), base branch, or sort | No |
| `get_pull_request` | Get detailed PR metadata, mergeability status, head, and base refs | No |
| `get_pull_request_diff` | Get token-capped unified diff of PR changes with max line limits | No |
| `create_pull_request` | Create a new pull request with head, base, title, and body | **Yes** |
| `update_pull_request` | Update title, body, state, or base branch of an existing PR | **Yes** |
| `merge_pull_request` | Merge a pull request with merge, squash, or rebase strategy | **Yes** |
| `list_pull_request_comments` | List inline review comments on a pull request | No |
| `create_pull_request_comment` | Create an inline review comment on a specific diff line | **Yes** |
| `create_pull_request_reply` | Reply directly to an existing inline review comment thread | **Yes** |
| `list_pull_request_reviews` | List formal reviews submitted on a pull request | No |
| `create_pull_request_review` | Submit an `APPROVE`, `REQUEST_CHANGES`, or `COMMENT` review | **Yes** |

### 5. Issues & Labels (8 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_issues` | List repository issues filtered by state, labels, assignee, or milestone | No |
| `get_issue` | Get detailed issue description, assignees, labels, and state | No |
| `create_issue` | Create a new issue with title, body, labels, and assignees | **Yes** |
| `update_issue` | Modify title, body, state (`open`/`closed`), or assignees | **Yes** |
| `list_issue_comments` | List conversation comments on an issue | No |
| `create_issue_comment` | Post a comment note to an issue | **Yes** |
| `list_labels` | List all repository labels with names and color hex codes | No |
| `create_label` | Create a new label with name, color, and description | **Yes** |

### 6. Milestones (4 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_milestones` | List repository milestones with open/closed counts and due dates | No |
| `get_milestone` | Get milestone metadata and progress statistics | No |
| `create_milestone` | Create a new milestone with title, description, and due date | **Yes** |
| `update_milestone` | Update milestone title, description, state, or due date | **Yes** |

### 7. Collaborators & Roles (4 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_collaborators` | List collaborators with role names (`admin`, `push`, `pull`) | No |
| `get_collaborator_permission` | Check permission level of a specific user on a repository | No |
| `add_collaborator` | Invite or add a collaborator with designated permission | **Yes** |
| `remove_collaborator` | Remove collaborator access from a repository | **Yes** |

### 8. Actions Variables & Secrets (6 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_actions_variables` | List repository Actions variables | No |
| `get_actions_variable` | Get variable value and metadata | No |
| `create_actions_variable` | Create a new Actions variable | **Yes** |
| `update_actions_variable` | Update existing Actions variable value | **Yes** |
| `delete_actions_variable` | Delete an Actions variable | **Yes** |
| `list_actions_secrets` | List repository Actions secrets names (values redacted) | No |

### 9. GitHub Actions & CI (8 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_workflows` | List GitHub Actions workflows defined in `.github/workflows/` | No |
| `list_workflow_runs` | List workflow execution runs filtered by branch, event, or status | No |
| `get_workflow_run` | Get detailed execution status, conclusion, and timing | No |
| `list_workflow_run_jobs` | List individual jobs in a workflow run with step conclusions | No |
| `get_job_logs` | Safely tail failure logs from a workflow job with line truncation | No |
| `trigger_workflow` | Dispatch a manual `workflow_dispatch` run on a ref | **Yes** |
| `cancel_workflow_run` | Cancel an in-progress workflow run | **Yes** |
| `rerun_workflow` | Re-run a failed or completed workflow | **Yes** |

### 10. Releases & Git Tags (5 actions)
| Action | Description | Mutating? |
| :--- | :--- | :---: |
| `list_releases` | List project releases with changelogs and asset metadata | No |
| `get_release` | Get specific release notes and downloadable assets | No |
| `create_release` | Publish a release tied to a git tag with markdown release notes | **Yes** |
| `list_tags` | List git tags with commit hashes | No |
| `create_tag` | Create an annotated git tag pointing to a SHA | **Yes** |

### 11. Webhooks, Gists, Security & User Context (18 actions)
- **Webhooks & Topics (4 actions)**: `list_repository_topics`, `set_repository_topics`, `list_webhooks`, `create_webhook`.
- **Gists (5 actions)**: `list_gists`, `get_gist`, `create_gist`, `update_gist`, `delete_gist`.
- **Security (1 action)**: `list_dependabot_alerts`.
- **User & Orgs (4 actions)**: `get_authenticated_user`, `get_user`, `list_user_organizations`, `list_accessible_repositories`.

---

## Token Economy & Output Projection Filters

Raw GitHub REST API responses are notoriously heavy (often 30KB–100KB per Issue or PR). `@sumirati/mcp-github` enforces strict token economy:

- **System Prompt Tax Reduction (>93% savings)**: Shrinks MCP tool definition footprint from ~14.7k tokens down to **~450 tokens**.
- **Recursive Output Projection Filter (`projectOutput`)**: Automatically strips redundant metadata fields (`_links`, `avatar_url`, `gravatar_id`, `node_id`, `site_admin`, user navigation URLs, internal API links, and null/empty fields) before payloads reach the LLM, guaranteeing **70%+ output token savings**.
- **Unified Diff Truncation**: PR and commit diffs are capped by line count (`max_diff_lines`, default: 400).
- **Safe Log Tailing**: CI workflow job logs extract the failure tail (`tail_lines`, default: 200) instead of megabyte log dumps.

---

## Roadmap

### Upcoming (v2.2)
- [x] Upstream indexed filtering & strict pagination caps (`state`, `labels`, `assignee`, `creator`, `mentioned`, `milestone`, `since`)
- [x] Client error resilience (Secondary rate limit / abuse detection, 403/404 scope diagnostics, 201 ghost write guard)
- [x] Hardened output projection with recursion depth guard (`maxDepth = 32`) and empty collection preservation
- [x] Nested subteam & organization management (`create_team`, `get_organization`, `create_group`)
- [ ] Pre-flight mergeability & conflict verification (`get_mergeability`)
- [ ] Token scope self-auditing & permission pre-flight

### Future Horizons (v2.x)
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
