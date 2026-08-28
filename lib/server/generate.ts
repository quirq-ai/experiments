import { randomUUID } from "node:crypto";
import { Lead, SequenceStep } from "@/lib/data";
import { BusinessProfile } from "./db";

const PALETTE = ["#141b33", "#3b2f63", "#0f3d33", "#432818", "#312e81"];
const SUFFIXES = ["labs", "works", "pilot", "grid", "loop", "forge"];
const CONTACTS = [
  { name: "Rowan Estes", title: "Head of Growth" },
  { name: "Imogen Clarke", title: "VP Sales" },
  { name: "Felix Duran", title: "Founder" },
  { name: "Nadia Sorel", title: "COO" },
  { name: "Theo Marsh", title: "CMO" },
];

export type DispatchInput = {
  contact: string;
  company: string;
  signal: string;
  prompt: string;
};

export function fallbackLeads(
  input: DispatchInput,
  profile: BusinessProfile,
  count: number
): Lead[] {
  const stemRaw =
    (input.company || input.prompt || "Signal")
      .replace(/[^A-Za-z ]/g, " ")
      .trim()
      .split(/\s+/)[0] || "Signal";
  const stem = stemRaw.charAt(0).toUpperCase() + stemRaw.slice(1).toLowerCase();
  const signalType = input.signal || "Raised funding";
  const buyer = input.contact || profile.buyerTitles[0] || "Decision maker";

  return Array.from({ length: count }, (_, i) => {
    const company = `${stem}${SUFFIXES[i % SUFFIXES.length]}`;
    const contact = CONTACTS[i % CONTACTS.length];
    return {
      id: `lead-${randomUUID().slice(0, 8)}`,
      company,
      tagline: `${input.company || "B2B"} / ${signalType}`,
      logoChar: company[0].toUpperCase(),
      logoBg: PALETTE[i % PALETTE.length],
      website: `${company.toLowerCase()}.com`,
      employees: 12 + i * 9,
      location: profile.geography || "United States",
      about: `${company} was surfaced by your agent for this dispatch run.`,
      keywords: [input.company, signalType, "dispatch"]
        .filter(Boolean)
        .join(", "),
      evidence: [
        {
          label: "Evidence company fit",
          value: `${company} matches the targeting you dispatched (${
            input.company || input.prompt || "your ICP"
          }) and shows a live "${signalType}" signal.`,
        },
      ],
      contacts: [{ ...contact, title: buyer === "Decision maker" ? contact.title : buyer }],
      signal: {
        type: signalType,
        detected: "Today",
        source: `${company.toLowerCase()}.com/…news`,
        sourceUrl: "#",
        evidence: `${company} fired a fresh "${signalType}" signal. Your agent verified it against the source before adding it here.`,
      },
      verdict: `${company} matches the dispatch targeting and the signal falls inside the qualification window. ${contact.name} owns the buying decision.`,
      status: "action" as const,
    };
  });
}

export function fallbackSequence(
  lead: Lead,
  profile: BusinessProfile
): SequenceStep[] {
  const first = lead.contacts[0]?.name.split(" ")[0] ?? "there";
  const signal = lead.signal.type.toLowerCase();
  const pitch = profile.description
    ? profile.description
    : "the problem we solve";
  return [
    {
      channel: "Email",
      day: 0,
      subject: `noticed the ${signal} news at ${lead.company}`,
      body: `Hi ${first}, saw that ${lead.company} just showed a "${signal}" signal. Teams at this stage usually run into ${pitch}. Worth a quick look?`,
    },
    {
      channel: "LinkedIn",
      day: 2,
      body: `Hey ${first}, sent you a note over email about what usually follows a ${signal} moment. Would love your take.`,
    },
    {
      channel: "Email",
      day: 5,
      subject: "one quick idea",
      body: `One idea for ${lead.company}: we could sketch what this would look like for your team in under a week. Happy to share a short walkthrough.`,
    },
  ];
}
