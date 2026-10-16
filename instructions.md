# GitHub MCP Server Usage Guide

## Repository Identifiers
Always supply both `owner` and `repo` parameters:
- `owner`: GitHub user or organization name (e.g. `"sumirati"` or `"google"`)
- `repo`: Repository name (e.g. `"mcp-github"`)

## Issues & Discussions
- **Issue Numbering**: Use the repository-scoped issue `number` (e.g. `14` for `#14`).
- **Comments & Updates**: Use `create_issue_comment` to record execution updates, bug triage notes, or PR discussion comments.
- **Labels & Milestones**: Pass `labels` as an array `["bug", "p1"]` or comma-separated string `"bug, p1"`. Pass `milestone` as the integer milestone `number` (use `list_milestones` to resolve milestone numbers).

## Pull Requests
- **Creating PRs**: Use `create_pull_request` with `head` (source branch e.g. `"feature/auth"`), `base` (target branch e.g. `"main"`), `title`, and markdown `body`.
- **Reviewing PRs**:
  1. Call `get_pull_request` with `pull_number` to inspect mergeability (`clean`, `dirty`, `unstable`), head/base branch refs, and metadata.
  2. Call `get_pull_request_diff` with `pull_number` and `max_lines: 400` to review unified code patches without context blowout.
- **Merging**: Use `merge_pull_request` with `merge_method: "squash" | "merge" | "rebase"`.

## GitHub Actions & CI Observability
- **Checking Run Status**: Call `list_workflow_runs` to inspect execution state (`conclusion`: `success`, `failure`, `cancelled`, or `status`: `in_progress`).
- **Diagnosing CI Failures**:
  1. Call `list_workflow_run_jobs` with `run_id` to locate the specific failing job step.
  2. Call `get_job_logs` with `job_id`. By default, `smart_failure: true` and `strip_ansi: true` automatically scan for failure anchors (errors, panics, assertion failures) and return the failure block and teardown tail without context blowout.
- **Artifacts**: Inspect built packages or logs with `list_workflow_run_artifacts` and `get_workflow_run_artifact`.

## Releases & Version Delivery
- **Releases**: Use `create_release` with `tag_name` (e.g. `"v2.1.0"`), `name`, `body` (markdown release notes), and optional `draft` or `prerelease` flags.
- **Tags & Branches**: Use `create_branch` or `create_tag` to pin releases to specific commit SHAs.

## Atomic Multi-File Commits
- **Batch Commits without Local Git**: When creating, modifying, or deleting multiple files simultaneously (e.g. refactoring code and updating documentation together), do **NOT** invoke `create_or_update_file` in a loop.
- **Use `create_commit` (or `push_files`)**: Provide `branch`, `message`, and an array `files: [{ path: "src/file1.js", content: "..." }, { path: "docs/old.md", action: "delete" }]`. This constructs a single atomic Git commit via GitHub's Git Trees / Git Database API directly on the remote branch without local git cloning.

## Daily Drivers & Token Economy
- **Code Inspection (Outline First)**: Always prefer `get_file_contents` to inspect files without cloning.
  - Set `outline_only: true` on initial file inspection to extract function, class, and method symbol signatures with line numbers in ~50-100 tokens.
  - Follow up with `start_line` and `end_line` (e.g. lines 120–160) to inspect only the targeted function implementation.
- **Commit Inspection**: Use `get_commit` with `max_diff_lines` and optional `path` filter.
- **Smart Diff & Lockfile Truncation**: `get_commit` and `get_pull_request_diff` automatically collapse noisy dependency lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `go.sum`, `Cargo.lock`, `*.min.js`) via `ignore_lockfiles: true` by default. Pass `ignore_lockfiles: false` if you explicitly need to inspect lockfile changes.
- **Conservative Pagination**: All list actions default to `per_page: 10` (max: 100) to protect LLM context windows and prevent token waste.
- **Default High-Density Markdown Format**: Discovery (`github_find_actions`), execution (`github_execute_action`), file inspection (`get_file_contents`), repository info (`get_repository`), and commit inspection (`get_commit`) default to `format: "markdown"`, yielding significant token reduction over raw JSON.
- **Dynamic Discovery**: For all other platform actions (collaborators, variables, webhooks, security alerts), use `github_find_actions(query: "...")` to look up parameter signatures before invoking `github_execute_action`.
