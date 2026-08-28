import { NextRequest } from "next/server";
import { removeWatchedAccount } from "@/lib/server/db";
import { errorResponse, stateResponse } from "@/lib/server/state";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    removeWatchedAccount(id);
    return stateResponse();
  } catch (err) {
    return errorResponse(err);
  }
}
