import type { Page, Realm } from "./types";

// Projects and agents: the index's top-level classification. Every dot folder in an
// indexed source belongs to an agent or tool (.claude, .codex, .cursor, .xo...), and so
// does everything inside it; all the rest belongs to projects.
//
// Two kinds of dot folder are not agents. Folders a tool generates (build output,
// caches, installed dependencies, version-control internals) are skipped like
// node_modules. Folders that hold credentials (.ssh, .aws...) are never read at all.
// Shared by the indexer, lib/normalize.ts and the pages, so all three agree.

/** Generated, cached or installed: rebuilt by a tool, never anyone's notes. */
const GENERATED = new Set([
  ".git", ".hg", ".svn", ".bzr", ".jj",
  ".next", ".nuxt", ".output", ".svelte-kit", ".astro", ".turbo", ".vercel", ".netlify", ".wrangler",
  ".cache", ".parcel-cache", ".vite", ".vinext", ".expo", ".expo-shared", ".gradle", ".dart_tool",
  ".pub-cache", ".venv", ".tox", ".nox", ".pytest_cache", ".mypy_cache", ".ruff_cache",
  ".ipynb_checkpoints", ".pnpm-store", ".yarn", ".npm", ".temp", ".angular", ".docusaurus",
  ".source", ".contentlayer", ".velite", ".terraform", ".serverless", ".aws-sam", ".build",
  ".swiftpm", ".sass-cache", ".nyc_output", ".history", ".idea", ".eggs", ".bundle",
  ".stack-work", ".ccls-cache", ".clangd", ".metals", ".bloop", ".bsp", ".localbin", ".locks",
  ".worktrees", ".demo-cache", ".github-cache", ".openvscode-server", ".vscode-server",
  ".cursor-server", ".trash", ".trashes", ".spotlight-v100", ".fseventsd", ".temporaryitems",
  ".documentrevisions-v100",
]);

/** Generated families: .git-stuck, .next-old-1234, .tmp-npm-cache, .cache-loader. */
const GENERATED_FAMILY = /^\.(?:git|next|tmp|cache)(?:[-_.].*)?$/;

/** Credential stores. Never crawled, never listed, nothing in them read. */
const CREDENTIALS = new Set([
  ".ssh", ".gnupg", ".gpg", ".aws", ".azure", ".gcloud", ".kube", ".docker", ".clerk", ".mcp-auth",
  ".password-store", ".pki", ".vault", ".config", ".terraform.d", ".keychain",
]);

/** A dot folder the indexer reads as an agent's: not generated, not a credential store. */
export function isAgentFolderName(name: string): boolean {
  if (!name.startsWith(".") || name === "." || name === "..") return false;
  const lower = name.toLowerCase();
  return !GENERATED.has(lower) && !GENERATED_FAMILY.test(lower) && !CREDENTIALS.has(lower);
}

/** What keeps a dot folder, as its makers name it. */
const TOOLS: Record<string, string> = {
  ".claude": "Claude Code",
  ".claude-plugin": "Claude Code plugin",
  ".codex": "Codex",
  ".codex-plugin": "Codex plugin",
  ".cursor": "Cursor",
  ".agents": "Agent Skills",
  ".gemini": "Gemini CLI",
  ".openclaw": "OpenClaw",
  ".openclaude": "OpenClaude",
  ".openhands": "OpenHands",
  ".paperclip": "Paperclip",
  ".xo": "XO",
  ".xo-cowork": "XO Cowork",
  ".xo-coworker": "XO Coworker",
  ".quirq": "quirq",
  ".github": "GitHub",
  ".copilot": "GitHub Copilot",
  ".vscode": "VS Code",
  ".husky": "Husky",
  ".devcontainer": "Dev Containers",
  ".storybook": "Storybook",
  ".openai": "OpenAI",
  ".windsurf": "Windsurf",
  ".kiro": "Kiro",
  ".continue": "Continue",
  ".aider": "Aider",
  ".roo": "Roo Code",
  ".cline": "Cline",
  ".goose": "Goose",
  ".amazonq": "Amazon Q",
  ".junie": "Junie",
  ".zed": "Zed",
  ".augment": "Augment",
  ".grokbot": "Grok",
  ".hermes": "Hermes",
  ".composio": "Composio",
  ".ollama": "Ollama",
  ".hyperframes": "HyperFrames",
  ".mcp": "MCP",
  ".streamlit": "Streamlit",
  ".vale": "Vale",
  ".changeset": "Changesets",
  ".circleci": "CircleCI",
  ".gitlab": "GitLab",
  ".well-known": "Well-known URIs",
};

export function agentTool(name: string): string {
  const lower = name.toLowerCase();
  if (TOOLS[lower]) return TOOLS[lower];
  if (lower.startsWith(".magicpath")) return "MagicPath";
  if (lower.startsWith(".xo-os")) return "XO";
  return name.replace(/^\.+/, "") || name;
}

/** The category every folder of one tool shares: "Claude Code folders". "Folders", not
 * "agents", so a tool never collides with a framework or collection of the same name. */
export const toolCategory = (tool: string) => `${tool} folders`;

/** The category of every agent's own folder. */
export const AGENTS_CATEGORY = "Agents";

/** "agent" for a dot folder and anything inside one, "project" for the rest. Reads only
 * the page's place, so older indexes and merged sources get it too. */
export function realmOf(p: Pick<Page, "relPath" | "root" | "depth" | "name">): Realm {
  const rootName = p.root.split(/[\\/]/).filter(Boolean).pop() ?? "";
  if (isAgentFolderName(rootName)) return "agent";
  if (p.depth === 0) return isAgentFolderName(p.name) ? "agent" : "project";
  return p.relPath.split(/[\\/]/).some(isAgentFolderName) ? "agent" : "project";
}
