import { testClaude } from "@/lib/server/agent";
import { errorResponse, stateResponse } from "@/lib/server/state";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  try {
    const claude = await testClaude();
    return stateResponse({ claude });
  } catch (err) {
    return errorResponse(err);
  }
}
