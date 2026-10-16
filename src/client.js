export const GITHUB_PERSONAL_ACCESS_TOKEN =
  process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
export const GITHUB_API_URL = process.env.GITHUB_API_URL || "https://api.github.com";

if (!GITHUB_PERSONAL_ACCESS_TOKEN) {
  console.error("GITHUB_PERSONAL_ACCESS_TOKEN (or GITHUB_TOKEN) environment variable is not set");
  process.exit(1);
}

export function isReadOnly() {
  const val = process.env.GITHUB_READ_ONLY;
  return val === "true" || val === "1" || val === "yes";
}

export function parseLinkHeader(linkHeader) {
  if (!linkHeader) return null;
  const links = {};
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const section = part.split(";");
    if (section.length !== 2) continue;
    const url = section[0].replace(/<(.*)>/, "$1").trim();
    const nameMatch = section[1].match(/rel="(.*)"/);
    if (nameMatch) {
      links[nameMatch[1]] = url;
    }
  }
  return links;
}

export function formatLabels(labels) {
  if (!labels) return undefined;
  if (Array.isArray(labels)) {
    return labels.map((l) => l.trim()).filter(Boolean);
  }
  return labels
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function githubRequest(endpoint, options = {}, responseType = "json") {
  if (isReadOnly()) {
    const method = (options.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      throw new Error(
        `GitHub MCP server is running in read-only mode (GITHUB_READ_ONLY=true). HTTP ${method} requests are blocked.`
      );
    }
  }

  const url = endpoint.startsWith("http") ? endpoint : `${GITHUB_API_URL}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "@sumirati/mcp-github",
    ...(options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const remaining = response.headers.get("x-ratelimit-remaining");
  const resetTime = response.headers.get("x-ratelimit-reset");

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errJson = await response.json();
      errorDetail = typeof errJson === "object" ? JSON.stringify(errJson) : String(errJson);
    } catch {
      errorDetail = await response.text();
    }

    // 1. Primary and Secondary Rate Limits (Abuse Detection / Concurrency / 429)
    const isSecondaryRateLimit =
      response.status === 429 ||
      (response.status === 403 && errorDetail.toLowerCase().includes("secondary rate limit"));

    if (isSecondaryRateLimit) {
      const retryAfter = response.headers.get("retry-after") || "60";
      throw new Error(
        `GitHub API Secondary Rate Limit (abuse detection) triggered. Back off and wait ${retryAfter}s before retrying. (Status ${response.status}): ${errorDetail}`
      );
    }

    if (response.status === 403 && remaining === "0") {
      const resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000).toISOString() : "unknown";
      throw new Error(
        `GitHub API rate limit exceeded. Limit resets at ${resetDate}. (Status ${response.status}): ${errorDetail}`
      );
    }

    // 2. Scope Diagnostics on 403 or 404 (e.g. private repo masked as 404 or insufficient token permissions)
    if (response.status === 403 || response.status === 404) {
      const currentScopes = response.headers.get("x-oauth-scopes");
      const acceptedScopes = response.headers.get("x-accepted-oauth-scopes");
      if (acceptedScopes) {
        errorDetail += ` [Scope Diagnostic: Current token has [${currentScopes || "none"}], endpoint requires [${acceptedScopes}]]`;
      }
    }

    throw new Error(`GitHub API error (${response.status} ${response.statusText}): ${errorDetail}`);
  }

  if (response.status === 204) {
    return { success: true };
  }

  if (responseType === "text") {
    return await response.text();
  }

  const data = await response.json();

  // 3. Guard against ghost writes where server returns 201 Created with id: null
  if (response.status === 201 && data && typeof data === "object" && !Array.isArray(data) && data.id === null) {
    throw new Error(
      `GitHub API mutation anomaly: Server responded with 201 Created but entity 'id' is null (write was not persisted).`
    );
  }
  const linkHeader = response.headers.get("link");
  const parsedLinks = parseLinkHeader(linkHeader);

  if (Array.isArray(data) && parsedLinks) {
    return {
      pagination: {
        links: parsedLinks,
        rate_limit_remaining: remaining ? parseInt(remaining, 10) : undefined,
      },
      items: data,
    };
  }

  return data;
}
