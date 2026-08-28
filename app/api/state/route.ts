import { errorResponse, stateResponse } from "@/lib/server/state";

export const runtime = "nodejs";

export async function GET() {
  try {
    return stateResponse();
  } catch (err) {
    return errorResponse(err);
  }
}
