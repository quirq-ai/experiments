import { NextRequest } from "next/server";
import { generateLeads } from "@/lib/server/agent";
import {
  addLeads,
  getCredits,
  getProfile,
  InsufficientCreditsError,
  listCampaigns,
} from "@/lib/server/db";
import { errorResponse, stateResponse } from "@/lib/server/state";

export const runtime = "nodejs";
export const maxDuration = 300;

const MORE_LEADS_COST = 8;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaign = listCampaigns().find((c) => c.id === id);
    if (!campaign) {
      return errorResponse(new Error("Campaign not found"));
    }
    if (getCredits() < MORE_LEADS_COST) {
      throw new InsufficientCreditsError(MORE_LEADS_COST, getCredits());
    }
    const profile = getProfile();
    const { leads, via } = await generateLeads(
      {
        contact: "",
        company: campaign.name,
        signal: campaign.signalType,
        prompt: `More leads matching the campaign: ${campaign.name}`,
      },
      profile,
      1
    );
    addLeads(id, leads, MORE_LEADS_COST);
    return stateResponse({ via });
  } catch (err) {
    return errorResponse(err);
  }
}
