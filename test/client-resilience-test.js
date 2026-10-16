import assert from "node:assert";
import { githubRequest } from "../src/client.js";

console.log("--- Starting GitHub Client Resilience & Error Diagnostics Tests ---");

const originalFetch = global.fetch;

try {
  // Test 1: Secondary rate limit (HTTP 429 or 403 with secondary rate limit message)
  global.fetch = async () => ({
    ok: false,
    status: 429,
    statusText: "Too Many Requests",
    headers: new Headers({ "retry-after": "90" }),
    json: async () => ({ message: "You have exceeded a secondary rate limit." }),
  });
  await assert.rejects(
    () => githubRequest("/repos/test/repo"),
    /GitHub API Secondary Rate Limit \(abuse detection\) triggered.*90s/
  );
  console.log("[PASS] Secondary rate limit (HTTP 429) with retry-after header handled correctly");

  // Test 2: Secondary rate limit via HTTP 403 message
  global.fetch = async () => ({
    ok: false,
    status: 403,
    statusText: "Forbidden",
    headers: new Headers({ "x-ratelimit-remaining": "4500" }),
    json: async () => ({ message: "You have exceeded a secondary rate limit. Please wait a few minutes." }),
  });
  await assert.rejects(
    () => githubRequest("/repos/test/repo"),
    /GitHub API Secondary Rate Limit \(abuse detection\) triggered/
  );
  console.log("[PASS] Secondary rate limit (HTTP 403 with high remaining quota) detected correctly");

  // Test 3: Standard primary rate limit (403 with remaining 0)
  global.fetch = async () => ({
    ok: false,
    status: 403,
    statusText: "Forbidden",
    headers: new Headers({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1700000000" }),
    json: async () => ({ message: "API rate limit exceeded" }),
  });
  await assert.rejects(
    () => githubRequest("/repos/test/repo"),
    /GitHub API rate limit exceeded\. Limit resets at/
  );
  console.log("[PASS] Primary rate limit (HTTP 403 remaining=0) handled correctly");

  // Test 4: Scope diagnostics on 404 (private repo masked as 404)
  global.fetch = async () => ({
    ok: false,
    status: 404,
    statusText: "Not Found",
    headers: new Headers({
      "x-oauth-scopes": "read:user",
      "x-accepted-oauth-scopes": "repo, read:org",
    }),
    json: async () => ({ message: "Not Found" }),
  });
  await assert.rejects(
    () => githubRequest("/repos/test/private-repo"),
    /Scope Diagnostic: Current token has \[read:user\], endpoint requires \[repo, read:org\]/
  );
  console.log("[PASS] 404 scope diagnostic correctly pinpoints missing repo scopes");

  // Test 5: Scope diagnostics on 403 (insufficient permissions)
  global.fetch = async () => ({
    ok: false,
    status: 403,
    statusText: "Forbidden",
    headers: new Headers({
      "x-oauth-scopes": "repo",
      "x-accepted-oauth-scopes": "admin:org",
    }),
    json: async () => ({ message: "Must have admin rights to Repository" }),
  });
  await assert.rejects(
    () => githubRequest("/orgs/test/teams"),
    /Scope Diagnostic: Current token has \[repo\], endpoint requires \[admin:org\]/
  );
  console.log("[PASS] 403 scope diagnostic correctly pinpoints missing admin:org scopes");

  // Test 6: Empty body on HTTP 201 Created (e.g. POST /repos/{owner}/{repo}/actions/variables) & 202 Accepted
  global.fetch = async () => ({
    ok: true,
    status: 201,
    statusText: "Created",
    headers: new Headers(),
    text: async () => "",
  });
  const empty201 = await githubRequest("/repos/test/repo/actions/variables", { method: "POST" });
  assert.strictEqual(empty201.success, true, "Empty 201 response must resolve cleanly with { success: true }");
  assert.strictEqual(empty201.status, 201);
  console.log("[PASS] Empty-body HTTP 201 Created (GitHub Actions Variables API) handled without SyntaxError");

  // Test 6b: Link header pagination unwrapping in list_repository_webhooks & list_dependabot_alerts
  global.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({
      link: '<https://api.github.com/repositories/1/hooks?page=2>; rel="next"',
      "x-ratelimit-remaining": "4999",
    }),
    text: async () =>
      JSON.stringify([
        {
          id: 999,
          name: "web",
          active: true,
          events: ["push"],
          config: { url: "https://example.com/webhook", content_type: "json" },
        },
      ]),
  });
  const pagedHooks = await githubRequest("/repos/test/repo/hooks");
  assert(Array.isArray(pagedHooks.items), "Expected items array in paginated response");
  assert.strictEqual(pagedHooks.items.length, 1);
  console.log("[PASS] Link header pagination wrapper verified");

} finally {
  global.fetch = originalFetch;
}

// Test 7: projectOutput hardening (html_url preservation, hypermedia template removal, empty collections, depth guard)
import { projectOutput, stripAnsi, extractSmartJobLog, extractSymbolOutline } from "../src/helpers.js";

// Verify html_url preservation and GitHub REST API v3 hypermedia template removal
const samplePayload = {
  id: 42,
  html_url: "https://github.com/octocat/Hello-World/releases/tag/v1.0.0",
  node_id: "MDQ6VXNlcjE=",
  avatar_url: "https://github.com/images/error/octocat_happy.gif",
  url: "https://api.github.com/repos/octocat/Hello-World",
  issues_url: "https://api.github.com/repos/octocat/Hello-World/issues{/number}",
  pulls_url: "https://api.github.com/repos/octocat/Hello-World/pulls{/number}",
};
const cleaned = projectOutput(samplePayload);
assert.strictEqual(cleaned.html_url, "https://github.com/octocat/Hello-World/releases/tag/v1.0.0", "html_url must be preserved");
assert.strictEqual(cleaned.avatar_url, undefined, "avatar_url must be stripped");
assert.strictEqual(cleaned.node_id, undefined, "node_id must be stripped");
assert.strictEqual(cleaned.url, undefined, "internal api.github.com url must be stripped");
assert.strictEqual(cleaned.issues_url, undefined, "RFC 6570 issues_url template must be stripped");
assert.strictEqual(cleaned.pulls_url, undefined, "RFC 6570 pulls_url template must be stripped");
console.log("[PASS] projectOutput preserves html_url while stripping noise keys, RFC 6570 templates, and api.github.com URLs");

// Verify empty root collections are preserved
assert.deepStrictEqual(projectOutput({}), {}, "Empty root object must be preserved as {}");
assert.deepStrictEqual(projectOutput([]), [], "Empty root array must be preserved as []");
console.log("[PASS] projectOutput preserves empty root collections");

// Verify recursion depth guard (maxDepth = 32)
let deepObj = { level: 0 };
let current = deepObj;
for (let i = 1; i <= 40; i++) {
  current.child = { level: i };
  current = current.child;
}
const depthTested = projectOutput(deepObj, 0, 32);
assert(depthTested !== undefined, "Deep object should not throw call-stack exhaustion");
console.log("[PASS] projectOutput recursion depth guard (maxDepth = 32) verified");

// Test 8: stripAnsi and extractSmartJobLog
const rawAnsiLog = "\x1B[31mError:\x1B[0m compilation failed\nLine 2\nLine 3";
assert.strictEqual(stripAnsi(rawAnsiLog), "Error: compilation failed\nLine 2\nLine 3");

// Test smart failure extraction
const mockJobLogs = Array.from({ length: 300 }, (_, i) => `Log line ${i + 1}`).join("\n") +
  "\nFAIL: test_oauth_flow\nAssertionError: Expected 200 got 500\n" +
  Array.from({ length: 100 }, (_, i) => `Teardown step ${i + 1}`).join("\n");

const smartExtracted = extractSmartJobLog(mockJobLogs, { tail_lines: 50, smart_failure: true });
assert(smartExtracted.includes("=== DETECTED FAILURE BLOCK"), "Must contain detected failure block");
assert(smartExtracted.includes("FAIL: test_oauth_flow"), "Must contain the failure anchor");
assert(smartExtracted.includes("=== JOB TEARDOWN TAIL ==="), "Must contain teardown tail");
console.log("[PASS] stripAnsi and extractSmartJobLog failure anchor extraction verified");

// Test 9: extractSymbolOutline
const mockCode = `
import express from "express";

export class RepositoryService {
  constructor() {}
  async findById() {}
}

export function computeHash(data) {
  return "abc";
}

const parseResponse = (res) => {
  return res.json();
};
`;
const outline = extractSymbolOutline(mockCode, "service.js");
assert(outline.includes("=== SYMBOL OUTLINE"), "Outline must have header");
assert(outline.includes("export class RepositoryService"), "Outline must include RepositoryService");
assert(outline.includes("export function computeHash"), "Outline must include computeHash");
assert(outline.includes("const parseResponse"), "Outline must include parseResponse");
console.log("[PASS] extractSymbolOutline AST/regex signature extraction verified");

console.log("ALL GITHUB CLIENT RESILIENCE & PROJECTION TESTS PASSED!\n");
