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

  // Test 6: 201 Ghost write guard (id is null)
  global.fetch = async () => ({
    ok: true,
    status: 201,
    statusText: "Created",
    headers: new Headers(),
    json: async () => ({ id: null, title: "Ghost Issue" }),
  });
  await assert.rejects(
    () => githubRequest("/repos/test/repo/issues", { method: "POST" }),
    /GitHub API mutation anomaly.*entity 'id' is null/
  );
  console.log("[PASS] 201 ghost write (null id) detected and blocked");

} finally {
  global.fetch = originalFetch;
}

console.log("ALL GITHUB CLIENT RESILIENCE TESTS PASSED!\n");
