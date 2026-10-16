export function summarizeRepository(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    owner: r.owner ? r.owner.login : null,
    private: r.private || false,
    description: r.description || null,
    default_branch: r.default_branch || "main",
    html_url: r.html_url,
    stargazers_count: r.stargazers_count || 0,
    forks_count: r.forks_count || 0,
    open_issues_count: r.open_issues_count || 0,
    updated_at: r.updated_at,
    pushed_at: r.pushed_at,
  };
}

export function summarizeIssue(issue, truncateBody = true) {
  if (!issue) return null;
  return {
    number: issue.number,
    id: issue.id,
    title: issue.title,
    state: issue.state,
    state_reason: issue.state_reason || null,
    user: issue.user ? issue.user.login : null,
    labels: (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name)),
    assignees: (issue.assignees || []).map((a) => a.login),
    milestone: issue.milestone ? { number: issue.milestone.number, title: issue.milestone.title } : null,
    comments_count: issue.comments || 0,
    html_url: issue.html_url,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    body: issue.body
      ? truncateBody && issue.body.length > 300
        ? issue.body.slice(0, 300) + "..."
        : issue.body
      : null,
  };
}

export function summarizePullRequest(pr, truncateBody = true) {
  if (!pr) return null;
  return {
    number: pr.number,
    id: pr.id,
    title: pr.title,
    state: pr.state,
    draft: pr.draft || false,
    merged: pr.merged || false,
    mergeable: pr.mergeable,
    mergeable_state: pr.mergeable_state,
    user: pr.user ? pr.user.login : null,
    head: {
      label: pr.head ? pr.head.label : null,
      ref: pr.head ? pr.head.ref : null,
      sha: pr.head && pr.head.sha ? pr.head.sha.slice(0, 7) : null,
    },
    base: {
      label: pr.base ? pr.base.label : null,
      ref: pr.base ? pr.base.ref : null,
      sha: pr.base && pr.base.sha ? pr.base.sha.slice(0, 7) : null,
    },
    labels: (pr.labels || []).map((l) => (typeof l === "string" ? l : l.name)),
    assignees: (pr.assignees || []).map((a) => a.login),
    milestone: pr.milestone ? pr.milestone.title : null,
    html_url: pr.html_url,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    body: pr.body
      ? truncateBody && pr.body.length > 300
        ? pr.body.slice(0, 300) + "..."
        : pr.body
      : null,
  };
}

export function summarizeCommit(c, options = {}) {
  if (!c) return null;
  const sha = c.sha;
  const commitObj = c.commit || {};
  const rawMessage = commitObj.message || c.message || "";
  const headline = rawMessage.split("\n")[0] || "";
  const fullMessage = options.full_message ?? false;

  return {
    sha,
    short_sha: sha ? sha.slice(0, 7) : null,
    message: fullMessage ? rawMessage : headline,
    author: {
      name: commitObj.author?.name || c.author?.login || null,
      email: commitObj.author?.email || null,
      date: commitObj.author?.date || null,
    },
    html_url: c.html_url,
  };
}

export function summarizeBranch(b) {
  if (!b) return null;
  return {
    name: b.name,
    protected: b.protected || false,
    commit: b.commit
      ? {
          sha: b.commit.sha,
          short_sha: b.commit.sha ? b.commit.sha.slice(0, 7) : null,
        }
      : null,
  };
}

export function summarizeWorkflow(w) {
  if (!w) return null;
  return {
    id: w.id,
    name: w.name,
    path: w.path,
    state: w.state,
    html_url: w.html_url,
  };
}

export function summarizeWorkflowRun(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    head_branch: r.head_branch,
    head_sha: r.head_sha ? r.head_sha.slice(0, 7) : null,
    event: r.event,
    status: r.status,
    conclusion: r.conclusion,
    workflow_id: r.workflow_id,
    run_number: r.run_number,
    created_at: r.created_at,
    updated_at: r.updated_at,
    html_url: r.html_url,
  };
}

export function summarizeWorkflowJob(j) {
  if (!j) return null;
  return {
    id: j.id,
    run_id: j.run_id,
    name: j.name,
    status: j.status,
    conclusion: j.conclusion,
    started_at: j.started_at,
    completed_at: j.completed_at,
    html_url: j.html_url,
    steps: (j.steps || []).map((s) => ({
      name: s.name,
      status: s.status,
      conclusion: s.conclusion,
      number: s.number,
    })),
  };
}

export function summarizeRelease(r) {
  if (!r) return null;
  return {
    id: r.id,
    tag_name: r.tag_name,
    name: r.name,
    draft: r.draft || false,
    prerelease: r.prerelease || false,
    created_at: r.created_at,
    published_at: r.published_at,
    html_url: r.html_url,
    body: r.body || null,
    author: r.author ? r.author.login : null,
    assets: (r.assets || []).map((a) => ({
      name: a.name,
      size: a.size,
      download_count: a.download_count,
      browser_download_url: a.browser_download_url,
    })),
  };
}

export function summarizeUser(u) {
  if (!u) return null;
  return {
    login: u.login,
    id: u.id,
    name: u.name,
    company: u.company,
    blog: u.blog,
    location: u.location,
    email: u.email,
    bio: u.bio,
    public_repos: u.public_repos,
    followers: u.followers,
    html_url: u.html_url,
  };
}

export function summarizeOrganization(org) {
  if (!org) return null;
  return {
    login: org.login,
    id: org.id,
    name: org.name,
    description: org.description,
    blog: org.blog,
    location: org.location,
    email: org.email,
    is_verified: org.is_verified || false,
    public_repos: org.public_repos,
    html_url: org.html_url,
    created_at: org.created_at,
  };
}

export function summarizeTeam(team) {
  if (!team) return null;
  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    description: team.description,
    privacy: team.privacy,
    permission: team.permission,
    members_count: team.members_count,
    repos_count: team.repos_count,
    parent: team.parent ? { id: team.parent.id, name: team.parent.name, slug: team.parent.slug } : null,
    html_url: team.html_url,
  };
}

export function sliceDiff(diffText, maxLines = 400) {
  if (!diffText) return "";
  const lines = diffText.split("\n");
  if (lines.length <= maxLines) {
    return diffText;
  }
  const sliced = lines.slice(0, maxLines).join("\n");
  const omitted = lines.length - maxLines;
  return `${sliced}\n\n[... Diff truncated: ${omitted} additional lines omitted for token economy ...]`;
}

export function tailLog(logText, tailLines = 200) {
  if (!logText) return "";
  const lines = logText.split("\n");
  if (lines.length <= tailLines) {
    return logText;
  }
  return lines.slice(-tailLines).join("\n");
}

export function summarizeMilestone(m) {
  if (!m) return null;
  return {
    number: m.number,
    id: m.id,
    title: m.title,
    state: m.state,
    description: m.description || null,
    due_on: m.due_on || null,
    open_issues: m.open_issues || 0,
    closed_issues: m.closed_issues || 0,
    created_at: m.created_at,
    updated_at: m.updated_at,
    html_url: m.html_url,
  };
}

export function summarizeCollaborator(c) {
  if (!c) return null;
  return {
    login: c.login,
    id: c.id,
    role_name: c.role_name || null,
    permissions: c.permissions || {},
    html_url: c.html_url,
  };
}

export function summarizeActionsVariable(v) {
  if (!v) return null;
  return {
    name: v.name,
    value: v.value,
    created_at: v.created_at,
    updated_at: v.updated_at,
  };
}

export function summarizeGist(g) {
  if (!g) return null;
  const files = Object.keys(g.files || {}).map((filename) => {
    const f = g.files[filename];
    return {
      filename: f.filename,
      type: f.type,
      language: f.language,
      size: f.size,
    };
  });
  return {
    id: g.id,
    description: g.description || null,
    public: g.public || false,
    owner: g.owner ? g.owner.login : null,
    files,
    comments: g.comments || 0,
    created_at: g.created_at,
    updated_at: g.updated_at,
    html_url: g.html_url,
  };
}

export function summarizePullRequestReview(r) {
  if (!r) return null;
  return {
    id: r.id,
    user: r.user ? r.user.login : null,
    body: r.body || null,
    state: r.state,
    submitted_at: r.submitted_at,
    commit_id: r.commit_id ? r.commit_id.slice(0, 7) : null,
    html_url: r.html_url,
  };
}

export const LOCKFILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "cargo.lock",
  "poetry.lock",
  "gemfile.lock",
  "composer.lock",
  "go.sum",
  "mix.lock",
  "podfile.lock",
  "bun.lockb",
  "flake.lock",
  "pipfile.lock",
]);

export function isLockfile(filePath) {
  if (!filePath) return false;
  const filename = filePath.split("/").pop().toLowerCase();
  if (LOCKFILES.has(filename)) return true;
  if (filename.endsWith(".min.js") || filename.endsWith(".min.css") || filename.endsWith(".map")) return true;
  return false;
}

/**
 * Filter unified git diff text, collapsing sections for recognized lockfiles
 * unless explicitly requested otherwise.
 */
export function filterLockfileDiff(diffText) {
  if (!diffText || typeof diffText !== "string") return diffText;
  const chunks = diffText.split(/(?=^diff --git )/m);
  const result = chunks.map((chunk) => {
    const match = chunk.match(/^diff --git a\/(.+?) b\/(.+?)(?:\r?\n|$)/m);
    if (!match) return chunk;
    const filePath = match[2] || match[1];
    if (isLockfile(filePath)) {
      const headerLines = chunk.split(/\r?\n/).slice(0, 4).join("\n");
      return `${headerLines}\n[... Diff collapsed for lockfile: ${filePath}. Pass ignore_lockfiles: false to view full diff ...]\n`;
    }
    return chunk;
  });
  return result.join("");
}

const NOISE_KEYS = new Set([
  "_links",
  "avatar_url",
  "gravatar_id",
  "node_id",
  "site_admin",
  "starred_url",
  "subscriptions_url",
  "organizations_url",
  "repos_url",
  "events_url",
  "received_events_url",
  "gists_url",
  "following_url",
  "followers_url",
  "archive_url",
  "assignees_url",
  "blobs_url",
  "branches_url",
  "collaborators_url",
  "comments_url",
  "commits_url",
  "compare_url",
  "contents_url",
  "contributors_url",
  "deployments_url",
  "downloads_url",
  "forks_url",
  "git_commits_url",
  "git_refs_url",
  "git_tags_url",
  "git_url",
  "hooks_url",
  "issue_comment_url",
  "issue_events_url",
  "issues_url",
  "keys_url",
  "labels_url",
  "languages_url",
  "merges_url",
  "milestones_url",
  "notifications_url",
  "pulls_url",
  "releases_url",
  "ssh_url",
  "stargazers_url",
  "statuses_url",
  "subscribers_url",
  "subscription_url",
  "svn_url",
  "tags_url",
  "teams_url",
  "trees_url",
  "timeline_url",
  "performed_via_github_app",
  "sub_issues_summary",
]);

/**
 * Universal token compression filter that strips redundant GitHub REST API v3 metadata:
 * avatar URLs, Gravatar IDs, GraphQL node IDs, RFC 6570 hypermedia URL templates,
 * internal api.github.com self-links, and null/empty fields.
 * Preserves high-signal functional data (IDs, numbers, names, diffs, bodies, states, timestamps, html_url).
 * Hardened with maxDepth recursion guard (32) and preserves empty root collections.
 */
export function projectOutput(val, depth = 0, maxDepth = 32) {
  if (val === null || val === undefined) return undefined;
  if (typeof val !== "object") return val;
  if (depth >= maxDepth) return val;

  if (Array.isArray(val)) {
    return val.map((item) => projectOutput(item, depth + 1, maxDepth)).filter((item) => item !== undefined);
  }

  const result = {};
  for (const [k, v] of Object.entries(val)) {
    if (NOISE_KEYS.has(k)) continue;
    if (k === "url" && typeof v === "string" && v.includes("api.github.com")) continue;
    if (
      k.endsWith("_url") &&
      k !== "html_url" &&
      k !== "download_url" &&
      k !== "target_url" &&
      k !== "archive_download_url" &&
      typeof v === "string" &&
      (v.includes("api.github.com") || v.includes("{"))
    ) {
      continue;
    }
    const cleaned = projectOutput(v, depth + 1, maxDepth);
    if (cleaned !== undefined && cleaned !== null && cleaned !== "") {
      result[k] = cleaned;
    }
  }

  return result;
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function summarizeArtifact(a) {
  if (!a) return null;
  return {
    id: a.id,
    name: a.name,
    size_in_bytes: a.size_in_bytes,
    size_human: formatBytes(a.size_in_bytes),
    expired: a.expired || false,
    archive_download_url: a.archive_download_url,
    created_at: a.created_at,
    expires_at: a.expires_at,
  };
}

/**
 * Renders a high-density Markdown table from an array of items and column definitions.
 * Column def: { header: string, get: (item) => string }
 */
export function renderMarkdownTable(items, columns) {
  if (!items || items.length === 0) {
    return "_No items found._";
  }
  const headers = columns.map((c) => c.header);
  const headerLine = `| ${headers.join(" | ")} |`;
  const dividerLine = `| ${columns.map(() => ":---").join(" | ")} |`;
  const rows = items.map((item) => {
    const cells = columns.map((c) => {
      const val = c.get(item);
      if (val === null || val === undefined || val === "") return "-";
      return String(val).replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
    });
    return `| ${cells.join(" | ")} |`;
  });
  return [headerLine, dividerLine, ...rows].join("\n");
}

export function formatIssuesMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.items || data?.issues || [];
  return renderMarkdownTable(items, [
    { header: "#", get: (i) => `#${i.number || i.id}` },
    { header: "Title", get: (i) => i.title },
    { header: "State", get: (i) => (i.state_reason ? `${i.state} (${i.state_reason})` : i.state) },
    { header: "Author", get: (i) => (i.user ? `@${i.user}` : "-") },
    { header: "Assignees", get: (i) => (Array.isArray(i.assignees) && i.assignees.length ? i.assignees.map((a) => `@${a}`).join(", ") : "-") },
    { header: "Milestone", get: (i) => (i.milestone ? (i.milestone.title || i.milestone.number) : "-") },
    { header: "Labels", get: (i) => (Array.isArray(i.labels) && i.labels.length ? i.labels.join(", ") : "-") },
  ]);
}

export function formatPullRequestsMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.items || data?.pull_requests || [];
  return renderMarkdownTable(items, [
    { header: "#PR", get: (p) => `#${p.number || p.id}` },
    { header: "Title", get: (p) => (p.draft ? `[Draft] ${p.title}` : p.title) },
    { header: "State", get: (p) => (p.merged ? "merged" : p.state) },
    { header: "Branch", get: (p) => `\`${p.head?.ref || p.head || "-"} -> ${p.base?.ref || p.base || "-"}\`` },
    { header: "Author", get: (p) => (p.user ? `@${p.user}` : "-") },
    { header: "Mergeable", get: (p) => (p.mergeable_state || (p.mergeable ? "clean" : "-")) },
  ]);
}

export function formatWorkflowRunsMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.workflow_runs || data?.items || [];
  return renderMarkdownTable(items, [
    { header: "ID", get: (r) => r.id },
    { header: "Workflow", get: (r) => r.name },
    { header: "Status", get: (r) => r.conclusion || r.status },
    { header: "Branch", get: (r) => `\`${r.head_branch || "-"}\`` },
    { header: "Commit", get: (r) => (r.head_sha ? r.head_sha.slice(0, 7) : "-") },
    { header: "Event", get: (r) => r.event || "-" },
  ]);
}

export function formatWorkflowsMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.workflows || data?.items || [];
  return renderMarkdownTable(items, [
    { header: "ID", get: (w) => w.id },
    { header: "Name", get: (w) => w.name },
    { header: "State", get: (w) => w.state },
    { header: "Path", get: (w) => `\`${w.path}\`` },
  ]);
}

export function formatCommitsMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.commits || data?.items || [];
  return renderMarkdownTable(items, [
    { header: "SHA", get: (c) => (c.sha ? c.sha.slice(0, 7) : "-") },
    { header: "Author", get: (c) => (c.author?.name || c.commit?.author?.name || "-") },
    { header: "Date", get: (c) => ((c.author?.date || c.commit?.author?.date || "").split("T")[0] || "-") },
    { header: "Message", get: (c) => (c.message || c.commit?.message || "").split("\n")[0] },
  ]);
}

export function formatBranchesMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.branches || data?.items || [];
  return renderMarkdownTable(items, [
    { header: "Branch", get: (b) => b.name },
    { header: "Protected", get: (b) => (b.protected ? "Yes" : "No") },
    { header: "Commit", get: (b) => (b.commit?.sha ? b.commit.sha.slice(0, 7) : "-") },
  ]);
}

export function formatCollaboratorsMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.collaborators || data?.items || [];
  return renderMarkdownTable(items, [
    { header: "User", get: (c) => `@${c.login}` },
    { header: "Role", get: (c) => c.role_name || "-" },
    { header: "Permissions", get: (c) => (c.permissions ? Object.entries(c.permissions).filter(([, v]) => v).map(([k]) => k).join(", ") : "-") },
  ]);
}

export function formatVariablesMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.variables || data?.items || [];
  return renderMarkdownTable(items, [
    { header: "Name", get: (v) => v.name },
    { header: "Value", get: (v) => v.value },
    { header: "Updated", get: (v) => (v.updated_at ? v.updated_at.split("T")[0] : "-") },
  ]);
}

export function formatMilestonesMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.milestones || data?.items || [];
  return renderMarkdownTable(items, [
    { header: "#", get: (m) => `#${m.number}` },
    { header: "Title", get: (m) => m.title },
    { header: "State", get: (m) => m.state },
    { header: "Due", get: (m) => (m.due_on ? m.due_on.split("T")[0] : "-") },
    { header: "Open / Closed", get: (m) => `${m.open_issues || 0} / ${m.closed_issues || 0}` },
  ]);
}

export function formatReleasesMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.releases || data?.items || [];
  return renderMarkdownTable(items, [
    { header: "Tag", get: (r) => r.tag_name },
    { header: "Name", get: (r) => r.name || "-" },
    { header: "Status", get: (r) => (r.draft ? "Draft" : r.prerelease ? "Pre-release" : "Published") },
    { header: "Author", get: (r) => (r.author ? `@${r.author}` : "-") },
    { header: "Published", get: (r) => (r.published_at ? r.published_at.split("T")[0] : "-") },
  ]);
}

export function formatRepositoriesListMarkdown(data) {
  const items = Array.isArray(data) ? data : data?.repositories || data?.items || [];
  return renderMarkdownTable(items, [
    { header: "ID", get: (r) => r.id },
    { header: "Repository", get: (r) => r.full_name || r.name },
    { header: "Visibility", get: (r) => (r.private ? "private" : "public") },
    { header: "Stars", get: (r) => r.stargazers_count ?? 0 },
    { header: "Default Branch", get: (r) => `\`${r.default_branch || "main"}\`` },
    { header: "Description", get: (r) => (r.description ? (r.description.length > 60 ? r.description.slice(0, 57) + "..." : r.description) : "-") },
  ]);
}

export function formatRepositoryMarkdown(r) {
  if (!r) return "_No repository data._";
  let md = `## Repository: ${r.full_name || r.name} (ID: ${r.id})\n\n`;
  if (r.description) md += `${r.description}\n\n`;
  md += `- **Visibility**: ${r.private ? "private" : "public"}\n`;
  md += `- **Default Branch**: \`${r.default_branch || "main"}\`\n`;
  md += `- **HTML URL**: ${r.html_url || "-"}\n`;
  md += `- **Stars**: ${r.stargazers_count || 0} | **Forks**: ${r.forks_count || 0} | **Open Issues**: ${r.open_issues_count || 0}\n`;
  if (r.pushed_at) md += `- **Last Pushed**: ${r.pushed_at}\n`;
  return md;
}

export function formatFileContentsMarkdown(f) {
  if (!f) return "_No file data._";
  if (Array.isArray(f)) {
    return renderMarkdownTable(f, [
      { header: "Name", get: (item) => item.name },
      { header: "Path", get: (item) => `\`${item.path}\`` },
      { header: "Type", get: (item) => item.type },
      { header: "Size", get: (item) => formatBytes(item.size) },
      { header: "SHA", get: (item) => (item.sha ? item.sha.slice(0, 7) : "-") },
    ]);
  }
  const shortSha = f.sha ? f.sha.slice(0, 7) : "-";
  let md = `## File: \`${f.path || f.name}\` (${f.size ?? 0} B, SHA: \`${shortSha}\`)${f.sliced_lines ? ` [Lines ${f.sliced_lines}]` : ""}\n\n`;
  if (f.outline) {
    md += `### Symbol Outline\n\n\`\`\`\n${f.outline}\n\`\`\`\n`;
  } else if (f.decoded_content !== undefined && f.decoded_content !== null) {
    md += `\`\`\`\n${f.decoded_content}\n\`\`\`\n`;
  }
  return md;
}

export function formatCommitDetailsMarkdown(c) {
  if (!c) return "_No commit data._";
  let md = `## Commit \`${c.sha?.slice(0, 7) || ""}\`: ${c.headline || c.message?.split("\n")[0] || ""}\n\n`;
  md += `- **Author**: ${c.author?.name || "-"} (${c.author?.email || "-"}) on ${c.author?.date || "-"}\n`;
  if (c.committer && c.committer.name !== c.author?.name) {
    md += `- **Committer**: ${c.committer.name} on ${c.committer.date || "-"}\n`;
  }
  if (c.html_url) md += `- **HTML URL**: ${c.html_url}\n`;
  if (c.diff_note) md += `- **Note**: ${c.diff_note}\n`;
  if (c.message) {
    md += `\n### Message\n\n${c.message}\n`;
  }
  if (Array.isArray(c.files) && c.files.length > 0) {
    md += `\n### Files Changed (${c.files.length})\n\n`;
    md += renderMarkdownTable(c.files, [
      { header: "File", get: (f) => f.filename },
      { header: "Status", get: (f) => f.status },
      { header: "Changes", get: (f) => `+${f.additions || 0}/-${f.deletions || 0}` },
    ]);
    const filesWithPatch = c.files.filter((f) => f.patch);
    if (filesWithPatch.length > 0) {
      md += `\n### Diffs\n`;
      for (const f of filesWithPatch) {
        md += `\n#### \`${f.filename}\` (${f.status})\n\n\`\`\`diff\n${f.patch}\n\`\`\`\n`;
      }
    }
  }
  if (c.diff) {
    md += `\n### Diff\n\n\`\`\`diff\n${c.diff}\n\`\`\`\n`;
  }
  return md;
}

export const ACTION_FORMATTERS = {
  list_issues: formatIssuesMarkdown,
  list_pull_requests: formatPullRequestsMarkdown,
  list_workflow_runs: formatWorkflowRunsMarkdown,
  list_workflows: formatWorkflowsMarkdown,
  list_commits: formatCommitsMarkdown,
  list_branches: formatBranchesMarkdown,
  list_collaborators: formatCollaboratorsMarkdown,
  list_actions_variables: formatVariablesMarkdown,
  list_milestones: formatMilestonesMarkdown,
  list_releases: formatReleasesMarkdown,
  search_repositories: formatRepositoriesListMarkdown,
  list_accessible_repositories: formatRepositoriesListMarkdown,
  get_repository: formatRepositoryMarkdown,
  get_file_contents: formatFileContentsMarkdown,
  get_commit: formatCommitDetailsMarkdown,
};

/**
 * Converts structured JSON/object responses into clean, compact, token-saving Markdown
 */
export function jsonToMarkdown(data, actionName) {
  if (data === null || data === undefined) return "";
  if (typeof data !== "object") return String(data);

  // 1. Dispatch directly by actionName if registered
  if (actionName && ACTION_FORMATTERS[actionName]) {
    return ACTION_FORMATTERS[actionName](data);
  }

  // 2. Shape-based automatic heuristics for common payloads
  if (data.items && Array.isArray(data.items)) {
    if (data.items[0]?.head && data.items[0]?.base) {
      return formatPullRequestsMarkdown(data);
    }
    if (data.items[0]?.number && data.items[0]?.title) {
      return formatIssuesMarkdown(data);
    }
    if (data.items[0]?.full_name !== undefined && data.items[0]?.default_branch !== undefined) {
      return formatRepositoriesListMarkdown(data);
    }
  }
  if (data.workflow_runs && Array.isArray(data.workflow_runs)) {
    return formatWorkflowRunsMarkdown(data);
  }
  if (data.full_name && data.id && data.default_branch) {
    return formatRepositoryMarkdown(data);
  }

  // 3. Array of objects
  if (Array.isArray(data)) {
    if (data.length === 0) return "_No items returned._";
    const first = data[0];
    if (typeof first === "object" && first !== null) {
      // Heuristic detection on first item
      if (first.head && first.base) {
        return formatPullRequestsMarkdown(data);
      }
      if (first.number && first.title) {
        return formatIssuesMarkdown(data);
      }
      if (first.conclusion !== undefined && first.head_branch) {
        return formatWorkflowRunsMarkdown(data);
      }
      if (first.sha && (first.author || first.commit)) {
        return formatCommitsMarkdown(data);
      }
      if (first.name && first.protected !== undefined) {
        return formatBranchesMarkdown(data);
      }
      if (first.login && (first.role_name !== undefined || first.permissions)) {
        return formatCollaboratorsMarkdown(data);
      }

      // General table formatting with prioritized column selection
      const allKeys = Array.from(new Set(data.flatMap((item) => Object.keys(item))));
      const priorityKeys = ["number", "id", "name", "title", "state", "status", "type", "ref", "user", "login", "author", "created_at", "value"];
      const sortedKeys = [
        ...priorityKeys.filter((k) => allKeys.includes(k)),
        ...allKeys.filter((k) => !priorityKeys.includes(k)),
      ];
      // Pick top 6 columns that are not large objects or bodies
      const selectedKeys = sortedKeys.filter((k) => !["description", "body", "diff", "content", "decoded_content"].includes(k)).slice(0, 6);

      if (selectedKeys.length > 0) {
        return renderMarkdownTable(
          data,
          selectedKeys.map((k) => ({
            header: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "),
            get: (item) => {
              const val = item[k];
              if (val === null || val === undefined) return "-";
              if (typeof val === "object") return Array.isArray(val) ? val.join(", ") : JSON.stringify(val);
              return String(val);
            },
          }))
        );
      }
    }
    return data
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const label = item.name || item.title || item.number || item.id || "Item";
          const desc = item.status || item.state || item.description || "";
          return `- **${label}**${desc ? `: ${desc}` : ""}`;
        }
        return `- ${item}`;
      })
      .join("\n");
  }

  // 4. Single structured object
  const lines = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      lines.push(`### ${k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ")}\n\n` + jsonToMarkdown(v));
    } else if (typeof v === "object") {
      lines.push(`**${k}**:`);
      for (const [subK, subV] of Object.entries(v)) {
        lines.push(`  - **${subK}**: ${typeof subV === "object" ? JSON.stringify(subV) : subV}`);
      }
    } else {
      lines.push(`- **${k}**: ${v}`);
    }
  }
  return lines.join("\n");
}

/**
 * Strips ANSI terminal color and control escape sequences.
 */
export function stripAnsi(text) {
  if (!text) return "";
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

/**
 * Intelligent CI log extractor: strips ANSI, scans for failure blocks,
 * and extracts the root cause rather than only blind tail lines.
 */
export function extractSmartJobLog(rawLog, { tail_lines = 100, strip_ansi = true, smart_failure = true } = {}) {
  if (!rawLog) return "";
  let text = strip_ansi ? stripAnsi(rawLog) : rawLog;
  const lines = text.split(/\r?\n/);
  if (!tail_lines || tail_lines <= 0 || lines.length <= tail_lines) {
    return lines.join("\n");
  }

  if (smart_failure) {
    const failureRegex = /(error:|fatal:|panic:|FAIL:|AssertionError|FAILED|Process completed with exit code [1-9]|exit status [1-9]|npm ERR!|BUILD FAILED|Traceback \(most recent call last\):)/i;
    let matchIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (failureRegex.test(lines[i])) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx !== -1) {
      const start = Math.max(0, matchIdx - 15);
      const end = Math.min(lines.length, matchIdx + 60);
      const failureBlock = lines.slice(start, end).join("\n");
      const tailStart = Math.max(end, lines.length - 25);
      const tailBlock = lines.slice(tailStart).join("\n");

      let result = `[... Truncated first ${start} lines ...]\n=== DETECTED FAILURE BLOCK (around line ${matchIdx + 1}) ===\n${failureBlock}`;
      if (tailStart > end) {
        result += `\n\n[... Truncated ${tailStart - end} intermediate lines ...]\n=== JOB TEARDOWN TAIL ===\n${tailBlock}`;
      }
      return result;
    }
  }

  return `[... Truncated first ${lines.length - tail_lines} lines ...]\n` + lines.slice(-tail_lines).join("\n");
}

/**
 * Universal Regex Symbol Extractor for code files (JS/TS, Python, Go, Rust, Ruby, Java, C#).
 * Returns symbol signatures with 1-based line numbers to allow outline-first file inspection.
 */
export function extractSymbolOutline(content, filename = "") {
  if (!content) return "";
  const lines = content.split(/\r?\n/);
  const symbols = [];

  const patterns = [
    /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*([a-zA-Z0-9_$]+)/,
    /^\s*(?:export\s+(?:default\s+)?)?class\s+([a-zA-Z0-9_$]+)/,
    /^\s*(?:export\s+)?(?:interface|type|enum)\s+([a-zA-Z0-9_$]+)/,
    /^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/,
    /^\s*(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(/,
    /^\s*class\s+([a-zA-Z0-9_]+)(?:\s*\(|\s*:)/,
    /^\s*func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)\s*\(/,
    /^\s*type\s+([a-zA-Z0-9_]+)\s+(?:struct|interface)/,
    /^\s*(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?(?:fn|struct|enum|trait|type)\s+([a-zA-Z0-9_]+)/,
    /^\s*impl(?:\s+<[^>]+>)?\s+([a-zA-Z0-9_]+)/,
    /^\s*(?:def|class|module)\s+([a-zA-Z0-9_:]+)/,
  ];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      continue;
    }

    for (const pat of patterns) {
      if (pat.test(line)) {
        const indentLevel = line.search(/\S/);
        const indentStr = " ".repeat(Math.min(indentLevel, 8));
        symbols.push(`L${idx + 1}:${indentStr} ${trimmed.replace(/\{$/, "").trim()}`);
        break;
      }
    }
  }

  if (symbols.length === 0) {
    return `[No top-level function, class, or type declarations detected in ${filename || "file"}. Total lines: ${lines.length}]`;
  }

  return `=== SYMBOL OUTLINE (${symbols.length} declarations across ${lines.length} lines) ===\n` + symbols.join("\n");
}
