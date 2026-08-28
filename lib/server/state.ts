import { NextResponse } from "next/server";
import { claudeStatus } from "./agent";
import { composioStatus } from "./composio";
import {
  getCredits,
  getProfile,
  InsufficientCreditsError,
  listCampaigns,
  listWatched,
} from "./db";

export function buildState(extra: Record<string, unknown> = {}) {
  const claude = claudeStatus();
  return {
    credits: getCredits(),
    plan: "Free",
    campaigns: listCampaigns(),
    watched: listWatched(),
    profile: getProfile(),
    claude,
    composio: composioStatus(),
    ...extra,
  };
}

export function stateResponse(extra: Record<string, unknown> = {}) {
  return NextResponse.json(buildState(extra));
}

export function errorResponse(err: unknown) {
  if (err instanceof InsufficientCreditsError) {
    return NextResponse.json({ error: err.message }, { status: 402 });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}
