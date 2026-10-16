import fs from "node:fs";

// Pre-set dummy token so importing catalog/client doesn't throw if run standalone
if (!process.env.GITHUB_PERSONAL_ACCESS_TOKEN && !process.env.GITHUB_TOKEN) {
  process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "docgen-dummy-token";
}

const { ACTION_CATALOG } = await import("../src/catalog.js");

export const DOMAIN_METADATA = {
  repositories: { title: "Repositories & Branches" },
  commits: { title: "Git Commits & Statuses" },
  "pull-requests": { title: "Pull Requests & Code Reviews" },
  issues: { title: "Issues & Labels" },
  milestones: { title: "Project Milestones" },
  collaborators: { title: "Collaborators & Roles" },
  variables: { title: "Actions Variables & Secrets" },
  gists: { title: "Gists & Code Snippets" },
  actions: { title: "GitHub Actions & CI/CD Observability" },
  releases: { title: "Releases & Git Tags" },
  user: { title: "User, Organizations & Teams" },
  webhooks: { title: "Webhooks & Topics" },
  security: { title: "Security & Dependabot" },
};

export function generateCatalogMarkdown() {
  const domainActions = new Map();
  for (const [actionName, action] of ACTION_CATALOG.entries()) {
    const d = action.domain;
    if (!domainActions.has(d)) domainActions.set(d, []);
    domainActions.get(d).push(action);
  }

  let md = "";
  let sectionIndex = 2;

  for (const [domainKey, meta] of Object.entries(DOMAIN_METADATA)) {
    const actions = domainActions.get(domainKey) || [];
    const count = actions.length;

    md += `### ${sectionIndex}. ${meta.title} (\`${domainKey}\` — ${count} action${count === 1 ? "" : "s"})\n`;
    md += `| Action | Description | Mutating? |\n`;
    md += `| :--- | :--- | :---: |\n`;

    for (const a of actions) {
      const mut = a.mutating ? "**Yes**" : "No";
      const desc = (a.description || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      md += `| \`${a.name}\` | ${desc} | ${mut} |\n`;
    }
    md += "\n";
    sectionIndex++;
  }

  return md.trim();
}

export function syncReadme(checkOnly = false) {
  const readmePath = new URL("../README.md", import.meta.url);
  const content = fs.readFileSync(readmePath, "utf8");

  const startMarker = "<!-- START_CATALOG_REFERENCE -->";
  const endMarker = "<!-- END_CATALOG_REFERENCE -->";

  if (!content.includes(startMarker) || !content.includes(endMarker)) {
    throw new Error(`README.md is missing '${startMarker}' or '${endMarker}' delimiters`);
  }

  const generated = generateCatalogMarkdown();
  const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
  const updated = content.replace(pattern, `${startMarker}\n\n${generated}\n\n${endMarker}`);

  if (checkOnly) {
    if (content !== updated) {
      console.error("[FAIL] README.md catalog reference is out of sync with code.");
      console.error("       Run 'npm run gen-docs' to regenerate documentation from ACTION_CATALOG.");
      process.exit(1);
    }
    console.log("[PASS] README.md is in perfect sync with ACTION_CATALOG.");
    return;
  }

  fs.writeFileSync(readmePath, updated, "utf8");
  console.log(`[PASS] Successfully generated and synchronized ${ACTION_CATALOG.size} actions across ${Object.keys(DOMAIN_METADATA).length} domains into README.md.`);
}

// Direct execution
if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replace(/.*\//, ""))) {
  const isCheck = process.argv.includes("--check");
  syncReadme(isCheck);
}
