import assert from "node:assert";
import { spawn } from "node:child_process";

console.log("--- Testing @sumirati/mcp-github Protocol JSON-RPC ListTools & CallTool ---");

const proc = spawn("/opt/local/bin/node", ["index.js"], {
  cwd: "/Users/sumirati/src/antigravity/MCP-github",
  env: {
    ...process.env,
    GITHUB_PERSONAL_ACCESS_TOKEN: "dummy-token",
  },
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";

function send(req) {
  proc.stdin.write(JSON.stringify(req) + "\n");
}

proc.stdout.on("data", (data) => {
  buffer += data.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop();

  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);

    if (msg.id === 1) {
      console.log("[PASS] Received initialize response");
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    } else if (msg.id === 2) {
      const toolCount = msg.result.tools.length;
      console.log(`[PASS] Received tools/list response with ${toolCount} tools`);
      assert.strictEqual(toolCount, 5, `Expected exactly 5 tools, got ${toolCount}`);

      const names = msg.result.tools.map((t) => t.name);
      console.log("       Exposed tools:", names.join(", "));
      assert(names.includes("github_find_actions"), "Missing github_find_actions");
      assert(names.includes("github_execute_action"), "Missing github_execute_action");
      assert(names.includes("get_file_contents"), "Missing get_file_contents");
      assert(names.includes("get_repository"), "Missing get_repository");
      assert(names.includes("get_commit"), "Missing get_commit");

      // Test calling github_find_actions (default format: markdown)
      send({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "github_find_actions",
          arguments: { query: "pull request" },
        },
      });
    } else if (msg.id === 3) {
      console.log("[PASS] Received tools/call response for github_find_actions (default format: markdown)");
      const text = msg.result.content[0].text;
      assert(typeof text === "string", "Expected string markdown output");
      assert(text.includes("| Action | Domain | Mutating | Description |"), "Expected markdown table header");
      assert(text.includes("`create_pull_request`"), "Expected create_pull_request in markdown table");
      console.log("       Verified default markdown response format");

      // Test explicit format: 'json'
      send({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "github_find_actions",
          arguments: { query: "pull request", format: "json" },
        },
      });
    } else if (msg.id === 4) {
      console.log("[PASS] Received tools/call response for github_find_actions (format: json)");
      const content = JSON.parse(msg.result.content[0].text);
      console.log(`       Found ${content.total_matches} PR actions`);
      assert(content.total_matches >= 3, "Expected PR actions in search results");
      console.log("\nALL PROTOCOL CHECKS PASSED PERFECTLY!");
      proc.kill();
      process.exit(0);
    }
  }
});

proc.on("error", (err) => {
  console.error("Process error:", err);
  process.exit(1);
});

// Start initialization
send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  },
});
