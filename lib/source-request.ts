import "server-only";

import { SESSION_RE } from "@/components/activity/shared";
import { DEMO } from "./mode";
import { readCapped, sameOrigin } from "./same-origin";

export const sourceHeaders = { "Cache-Control": "no-store" };
export const sourceError = (status: number, error: string) => Response.json({ error }, { status, headers: sourceHeaders });

export async function readSourceRequest(req: Request): Promise<(Record<string, unknown> & { session: string }) | Response> {
  if (DEMO) return sourceError(404, "Sources are managed in your local Innernet.");
  if (!sameOrigin(req)) return sourceError(403, "Only Innernet's own pages may manage sources.");
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return sourceError(415, "Send JSON.");
  const raw = await readCapped(req, 8192);
  if (raw === null) return sourceError(413, "Too large.");
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return sourceError(400, "Bad JSON.");
    if (typeof body.session !== "string" || !SESSION_RE.test(body.session)) return sourceError(400, "Bad session id.");
    return body;
  } catch {
    return sourceError(400, "Bad JSON.");
  }
}
