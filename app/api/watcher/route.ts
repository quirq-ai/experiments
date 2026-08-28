import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { addWatchedAccount } from "@/lib/server/db";
import { errorResponse, stateResponse } from "@/lib/server/state";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const domain = String(body.domain ?? "").trim();
    if (!name) return errorResponse(new Error("Account name is required"));
    addWatchedAccount({
      id: `acct-${randomUUID().slice(0, 8)}`,
      name,
      domain: domain || `${name.toLowerCase().replace(/\s+/g, "")}.com`,
      signals: Array.isArray(body.signals) ? body.signals.map(String) : [],
    });
    return stateResponse();
  } catch (err) {
    return errorResponse(err);
  }
}
