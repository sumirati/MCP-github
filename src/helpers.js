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

export function summarizeCommit(c) {
  if (!c) return null;
  const sha = c.sha || c.id;
  const commitObj = c.commit || {};
  return {
    sha,
    short_sha: sha ? sha.slice(0, 7) : null,
    message: commitObj.message || c.message || "",
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
