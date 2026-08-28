import fs from "node:fs";
import path from "node:path";
import {
  Campaign,
  CAMPAIGNS,
  Lead,
  SequenceStep,
  USER,
  WatchedAccount,
} from "@/lib/data";

export type BusinessProfile = {
  name: string;
  website: string;
  location: string;
  description: string;
  categories: string[];
  businessModel: string[];
  stage: string;
  localServices: string;
  proofPoints: string[];
  channel: string;
  email: string;
  phone: string;
  buyerTitles: string[];
  companyTypes: string[];
  companySize: string;
  geography: string;
  icpNotes: string;
  competitors: string[];
};

export const DEFAULT_PROFILE: BusinessProfile = {
  name: "Quirq",
  website: "",
  location: "",
  description: "",
  categories: [],
  businessModel: [],
  stage: "",
  localServices: "",
  proofPoints: [],
  channel: "Email",
  email: "suraj@example.com",
  phone: "",
  buyerTitles: [],
  companyTypes: [],
  companySize: "",
  geography: "",
  icpNotes: "",
  competitors: [],
};

type LedgerEntry = { delta: number; reason: string; created_at: string };

type Store = {
  credits: number;
  plan: string;
  profile: BusinessProfile;
  campaigns: Campaign[];
  watched: WatchedAccount[];
  ledger: LedgerEntry[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "autospawn.json");

/* Cached on globalThis so Next dev HMR re-evaluation reuses one store. */
const g = globalThis as unknown as { __autospawnStore?: Store };

function now(): string {
  return new Date().toISOString();
}

function seedStore(): Store {
  return {
    credits: USER.credits,
    plan: USER.plan,
    profile: { ...DEFAULT_PROFILE },
    campaigns: JSON.parse(JSON.stringify(CAMPAIGNS)) as Campaign[],
    watched: [],
    ledger: [
      { delta: USER.credits, reason: "Free plan starting credits", created_at: now() },
    ],
  };
}

function getStore(): Store {
  if (g.__autospawnStore) return g.__autospawnStore;
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Store;
    g.__autospawnStore = {
      ...seedStore(),
      ...parsed,
      profile: { ...DEFAULT_PROFILE, ...parsed.profile },
    };
  } catch {
    g.__autospawnStore = seedStore();
    persist();
  }
  return g.__autospawnStore!;
}

function persist() {
  const store = g.__autospawnStore;
  if (!store) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

export class InsufficientCreditsError extends Error {
  constructor(needed: number, available: number) {
    super(`Not enough credits: need ${needed}, have ${available}`);
    this.name = "InsufficientCreditsError";
  }
}

function debitNoPersist(store: Store, amount: number, reason: string) {
  if (store.credits < amount) {
    throw new InsufficientCreditsError(amount, store.credits);
  }
  store.credits -= amount;
  store.ledger.push({ delta: -amount, reason, created_at: now() });
}

export function listCampaigns(): Campaign[] {
  return getStore().campaigns;
}

export function getCredits(): number {
  return getStore().credits;
}

export function debitCredits(amount: number, reason: string) {
  const store = getStore();
  debitNoPersist(store, amount, reason);
  persist();
}

export function createCampaign(campaign: Campaign, cost: number) {
  const store = getStore();
  debitNoPersist(store, cost, `Dispatch run: ${campaign.name}`);
  store.campaigns.push(campaign);
  persist();
}

export function addLeads(campaignId: string, leads: Lead[], cost: number) {
  const store = getStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error("Campaign not found");
  debitNoPersist(store, cost, `More leads for ${campaign.name}`);
  campaign.leads.push(...leads);
  persist();
}

export function getLead(
  leadId: string
): { lead: Lead; campaignId: string } | null {
  for (const c of getStore().campaigns) {
    const lead = c.leads.find((l) => l.id === leadId);
    if (lead) return { lead, campaignId: c.id };
  }
  return null;
}

export function applySequence(leadId: string, steps: SequenceStep[]) {
  const found = getLead(leadId);
  if (!found) throw new Error("Lead not found");
  found.lead.status = "sequenced";
  found.lead.sequence = steps;
  persist();
}

export function listWatched(): WatchedAccount[] {
  return getStore().watched;
}

export function addWatchedAccount(account: WatchedAccount) {
  getStore().watched.push(account);
  persist();
}

export function removeWatchedAccount(id: string) {
  const store = getStore();
  store.watched = store.watched.filter((w) => w.id !== id);
  persist();
}

export function getProfile(): BusinessProfile {
  return getStore().profile;
}

export function updateProfile(patch: Partial<BusinessProfile>) {
  const store = getStore();
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([key]) => key in DEFAULT_PROFILE)
  );
  store.profile = { ...store.profile, ...clean };
  persist();
  return store.profile;
}

export function getLedger(limit = 50): LedgerEntry[] {
  return getStore().ledger.slice(-limit).reverse();
}
