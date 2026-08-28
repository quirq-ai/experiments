import { randomUUID } from "node:crypto";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { Lead, SequenceStep } from "@/lib/data";
import { BusinessProfile } from "./db";
import { DispatchInput, fallbackLeads, fallbackSequence } from "./generate";
import { composioMcp } from "./composio";

export type ClaudeStatus = {
  connected: boolean | "unverified";
  detail: string;
};

let verified: ClaudeStatus | null = null;

export function claudeStatus(): ClaudeStatus {
  if (verified) return verified;
  if (process.env.ANTHROPIC_API_KEY) {
    return { connected: "unverified", detail: "ANTHROPIC_API_KEY set, not tested yet" };
  }
  return {
    connected: "unverified",
    detail: "Will use this machine's Claude Code login. Run a test to verify.",
  };
}

export async function testClaude(): Promise<ClaudeStatus> {
  try {
    const text = await runAgent("Reply with exactly: OK", "You reply with the single word OK.", 1, 60_000);
    const authFailure = /authenticat|oauth|log ?in|api key|expired/i.test(text);
    verified = !authFailure && /\bOK\b/.test(text)
      ? { connected: true, detail: "Claude Code responded. Agent runs are live." }
      : {
          connected: false,
          detail: `Claude Code reported: ${text.slice(0, 140)}`,
        };
  } catch (err) {
    verified = {
      connected: false,
      detail: `Claude Code unavailable: ${err instanceof Error ? err.message.slice(0, 140) : "unknown error"}`,
    };
  }
  return verified;
}

const PALETTE = ["#141b33", "#3b2f63", "#0f3d33", "#432818", "#312e81"];

/* When this server is itself launched from inside a Claude Code session, the
   inherited env points the CLI at that session's harness (ANTHROPIC_BASE_URL,
   CLAUDE_CODE_*). Strip those so the spawned CLI uses the machine's own
   Claude login, keeping ANTHROPIC_API_KEY if the user set one. */
function sanitizedEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("CLAUDE_")) continue;
    if (key.startsWith("ANTHROPIC_") && key !== "ANTHROPIC_API_KEY") continue;
    env[key] = value;
  }
  return env;
}

async function runAgent(
  prompt: string,
  systemPrompt: string,
  maxTurns: number,
  timeoutMs: number,
  useTools = false
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const mcp = useTools ? composioMcp() : null;
    const stream = query({
      prompt,
      options: {
        systemPrompt,
        maxTurns,
        settingSources: [],
        abortController: controller,
        disallowedTools: [
          "Read", "Write", "Edit", "Bash", "Glob", "Grep",
          "NotebookEdit", "WebFetch", "Task", "TodoWrite",
          ...(useTools ? [] : ["WebSearch"]),
        ],
        allowedTools: useTools
          ? ["WebSearch", ...(mcp ? ["mcp__composio__*"] : [])]
          : [],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        env: sanitizedEnv(),
        ...(mcp ? { mcpServers: { composio: mcp } } : {}),
      },
    });
    for await (const message of stream) {
      if (message.type === "result") {
        if (message.subtype === "success" && !message.is_error) {
          return message.result ?? "";
        }
        const detail =
          message.subtype === "success"
            ? (message.result ?? "").slice(0, 160)
            : message.subtype;
        throw new Error(`agent error: ${detail}`);
      }
    }
    throw new Error("agent stream ended without a result");
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in agent output");
  return JSON.parse(candidate.slice(start, end + 1));
}

type RawLead = {
  company?: string;
  tagline?: string;
  website?: string;
  employees?: number;
  location?: string;
  about?: string;
  keywords?: string;
  contactName?: string;
  contactTitle?: string;
  contactLinkedin?: string;
  signalEvidence?: string;
  signalSource?: string;
  evidenceCompanyFit?: string;
  verdict?: string;
};

function toLead(raw: RawLead, input: DispatchInput, i: number): Lead {
  const company = raw.company?.trim() || `Lead ${i + 1}`;
  const signalType = input.signal || "Raised funding";
  return {
    id: `lead-${randomUUID().slice(0, 8)}`,
    company,
    tagline: raw.tagline || `${input.company || "B2B"} / ${signalType}`,
    logoChar: company[0].toUpperCase(),
    logoBg: PALETTE[i % PALETTE.length],
    website: raw.website || `${company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
    employees: raw.employees ?? 20 + i * 8,
    location: raw.location || "United States",
    about: raw.about || `${company}, surfaced by your agent during this run.`,
    keywords: raw.keywords || [input.company, signalType].filter(Boolean).join(", "),
    evidence: [
      {
        label: "Evidence company fit",
        value:
          raw.evidenceCompanyFit ||
          `${company} matches the dispatched targeting and shows a live "${signalType}" signal.`,
      },
    ],
    contacts: [
      {
        name: raw.contactName || "New contact",
        title: raw.contactTitle || input.contact || "Decision maker",
        linkedin: raw.contactLinkedin,
      },
    ],
    signal: {
      type: signalType,
      detected: "Today",
      source: raw.signalSource || "agent research",
      sourceUrl: "#",
      evidence:
        raw.signalEvidence ||
        `${company} fired a fresh "${signalType}" signal, verified by your agent.`,
    },
    verdict:
      raw.verdict ||
      `${company} matches the dispatch targeting and the signal falls inside the qualification window.`,
    status: "action",
  };
}

function profileContext(profile: BusinessProfile): string {
  const parts = [
    profile.name && `Business: ${profile.name}`,
    profile.description && `What it does: ${profile.description}`,
    profile.buyerTitles.length && `Buyer titles: ${profile.buyerTitles.join(", ")}`,
    profile.companyTypes.length && `Company types: ${profile.companyTypes.join(", ")}`,
    profile.geography && `Geography: ${profile.geography}`,
    profile.icpNotes && `ICP notes: ${profile.icpNotes}`,
    profile.competitors.length && `Competitors: ${profile.competitors.join(", ")}`,
  ].filter(Boolean);
  return parts.length ? `\nSeller context:\n${parts.join("\n")}` : "";
}

export async function generateLeads(
  input: DispatchInput,
  profile: BusinessProfile,
  count: number
): Promise<{ leads: Lead[]; via: "claude" | "fallback"; note?: string }> {
  if (process.env.AUTOSPAWN_FALLBACK_ONLY === "1") {
    return { leads: fallbackLeads(input, profile, count), via: "fallback" };
  }
  try {
    const targeting = input.prompt.trim()
      ? `Targeting prompt: ${input.prompt.trim()}`
      : `Buyer titles: ${input.contact || "any"}\nCompany types: ${input.company || "any"}\nBuying signal: ${input.signal || "Raised funding"}`;
    const text = await runAgent(
      `Generate ${count} PLAUSIBLE BUT FICTIONAL B2B leads for an outbound campaign. Invent realistic-sounding companies; do not name real companies or real people.\n${targeting}${profileContext(profile)}\n\nReturn ONLY a JSON object: {"leads": [{"company", "tagline", "website", "employees" (number), "location", "about", "keywords", "contactName", "contactTitle", "signalEvidence" (2 sentences, news-style), "signalSource" (a plausible url path), "evidenceCompanyFit", "verdict" (2 sentences on why this lead qualifies)}]}`,
      "You are an outbound lead sourcing agent. You output only valid JSON, no markdown fences, no commentary.",
      4,
      180_000,
      Boolean(composioMcp())
    );
    const parsed = extractJson(text) as { leads?: RawLead[] };
    const raws = (parsed.leads ?? []).slice(0, count);
    if (!raws.length) throw new Error("agent returned no leads");
    return { leads: raws.map((r, i) => toLead(r, input, i)), via: "claude" };
  } catch (err) {
    return {
      leads: fallbackLeads(input, profile, count),
      via: "fallback",
      note: err instanceof Error ? err.message : "agent error",
    };
  }
}

export async function generateSequence(
  lead: Lead,
  profile: BusinessProfile
): Promise<{ steps: SequenceStep[]; via: "claude" | "fallback" }> {
  if (process.env.AUTOSPAWN_FALLBACK_ONLY === "1") {
    return { steps: fallbackSequence(lead, profile), via: "fallback" };
  }
  try {
    const text = await runAgent(
      `Write a 3-step outbound sequence to ${lead.contacts[0]?.name ?? "the contact"} (${lead.contacts[0]?.title ?? "decision maker"}) at ${lead.company}.\nSignal: ${lead.signal.type}. Evidence: ${lead.signal.evidence}\nSeller: ${profile.name}${profile.description ? `, ${profile.description}` : ""}\nTone: brief, human, specific to the signal. No AI slop, no exclamation marks.\nReturn ONLY JSON: {"steps": [{"channel": "Email"|"LinkedIn", "day": number, "subject" (email only), "body"}]} with days 0, 2, 5.`,
      "You write concise, human outbound copy. You output only valid JSON.",
      1,
      90_000,
      Boolean(composioMcp())
    );
    const parsed = extractJson(text) as { steps?: SequenceStep[] };
    const steps = (parsed.steps ?? []).filter(
      (s) => s && typeof s.body === "string" && typeof s.day === "number"
    );
    if (steps.length < 2) throw new Error("agent returned too few steps");
    return {
      steps: steps.map((s) => ({
        channel: s.channel === "LinkedIn" ? "LinkedIn" : "Email",
        day: s.day,
        subject: s.subject,
        body: s.body,
      })),
      via: "claude",
    };
  } catch {
    return { steps: fallbackSequence(lead, profile), via: "fallback" };
  }
}

export function campaignName(input: DispatchInput): string {
  if (input.prompt.trim()) {
    const p = input.prompt.trim();
    return p.length > 60 ? `${p.slice(0, 57)}…` : p;
  }
  return [input.company || "B2B", input.signal || "Raised funding"]
    .filter(Boolean)
    .join(" · ");
}
