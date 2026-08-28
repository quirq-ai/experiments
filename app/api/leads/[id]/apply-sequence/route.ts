import { NextRequest } from "next/server";
import { generateSequence } from "@/lib/server/agent";
import { applySequence, getLead, getProfile } from "@/lib/server/db";
import { errorResponse, stateResponse } from "@/lib/server/state";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const found = getLead(id);
    if (!found) {
      return errorResponse(new Error("Lead not found"));
    }
    const { steps, via } = await generateSequence(found.lead, getProfile());
    applySequence(id, steps);
    return stateResponse({ via });
  } catch (err) {
    return errorResponse(err);
  }
}
