import { NextRequest } from "next/server";
import { updateProfile } from "@/lib/server/db";
import { errorResponse, stateResponse } from "@/lib/server/state";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  try {
    const patch = await req.json();
    updateProfile(patch);
    return stateResponse();
  } catch (err) {
    return errorResponse(err);
  }
}
