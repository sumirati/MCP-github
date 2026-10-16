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
  const sha = c.sha || c.id;
  const commitObj = c.commit || {};
  const rawMessage = commitObj.message || c.message || "";
  const headline = rawMessage.split("\n")[0] || "";
  const fullMessage = options.full_message ?? false;

  return {
    sha,
    short_sha: sha ? sha.slice(0, 7) : null,
    message: fullMessage ? rawMessage : headline,
    author: {
      name: commitObj.author ? commitObj.author.name : c.author_name,
      email: commitObj.author ? commitObj.author.email : c.author_email,
      date: commitObj.author ? commitObj.author.date : c.authored_date,
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

/**
 * Universal token compression filter that strips redundant metadata:
 * avatar URLs, Gravatar IDs, node IDs, internal API links, and null/empty fields.
 * Preserves high-signal functional data (IDs, names, diffs, bodies, states, timestamps).
 */
export function projectOutput(val) {
  if (val === null || val === undefined) return undefined;
  if (typeof val !== "object") return val;

  if (Array.isArray(val)) {
    const cleanedArr = val.map(projectOutput).filter((item) => item !== undefined);
    return cleanedArr;
  }

  const result = {};
  for (const [k, v] of Object.entries(val)) {
    // Strip redundant, heavy, or non-functional API metadata
    if (
      k === "_links" ||
      k === "avatar_url" ||
      k === "gravatar_id" ||
      k === "node_id" ||
      k === "site_admin" ||
      k === "starred_url" ||
      k === "subscriptions_url" ||
      k === "organizations_url" ||
      k === "repos_url" ||
      k === "events_url" ||
      k === "received_events_url" ||
      k === "gists_url" ||
      k === "following_url" ||
      k === "followers_url" ||
      (k === "url" && typeof v === "string" && v.includes("api.github.com"))
    ) {
      continue;
    }

    const cleaned = projectOutput(v);
    if (cleaned !== undefined && cleaned !== null && cleaned !== "") {
      result[k] = cleaned;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
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
 * Converts structured JSON/object responses into clean, compact Markdown
 */
export function jsonToMarkdown(data) {
  if (data === null || data === undefined) return "";
  if (typeof data !== "object") return String(data);

  if (Array.isArray(data)) {
    if (data.length === 0) return "_No items returned._";
    if (typeof data[0] === "object" && data[0] !== null) {
      const keys = Array.from(new Set(data.flatMap((item) => Object.keys(item))));
      if (keys.length <= 8) {
        const header = `| ${keys.join(" | ")} |`;
        const divider = `| ${keys.map(() => ":---").join(" | ")} |`;
        const rows = data.map((item) =>
          `| ${keys
            .map((k) => {
              const v = item[k];
              if (v === null || v === undefined) return "";
              if (typeof v === "object") return "`" + JSON.stringify(v) + "`";
              return String(v).replace(/\|/g, "\\|").replace(/\n/g, " ");
            })
            .join(" | ")} |`
        );
        return [header, divider, ...rows].join("\n");
      }
    }
    return data
      .map((item) => `- ${typeof item === "object" ? JSON.stringify(item) : item}`)
      .join("\n");
  }

  const lines = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      lines.push(`### ${k}\n\n` + jsonToMarkdown(v));
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
