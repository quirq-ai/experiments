import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { campaignName, generateLeads } from "@/lib/server/agent";
import {
  createCampaign,
  getCredits,
  getProfile,
  InsufficientCreditsError,
} from "@/lib/server/db";
import { errorResponse, stateResponse } from "@/lib/server/state";

export const runtime = "nodejs";
export const maxDuration = 300;

const DISPATCH_COST = 24;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = {
      contact: String(body.contact ?? ""),
      company: String(body.company ?? ""),
      signal: String(body.signal ?? ""),
      prompt: String(body.prompt ?? ""),
    };
    if (getCredits() < DISPATCH_COST) {
      throw new InsufficientCreditsError(DISPATCH_COST, getCredits());
    }
    const profile = getProfile();
    const { leads, via, note } = await generateLeads(input, profile, 3);
    const campaign = {
      id: `run-${randomUUID().slice(0, 8)}`,
      name: campaignName(input),
      signalType: input.signal || "Raised funding",
      createdAt: new Date().toISOString().slice(0, 10),
      leads,
    };
    createCampaign(campaign, DISPATCH_COST);
    return stateResponse({ campaignId: campaign.id, via, note });
  } catch (err) {
    return errorResponse(err);
  }
}
