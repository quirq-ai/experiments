import { SESSION_RE } from "@/components/activity/shared";
import { DEMO } from "@/lib/mode";
import { readCapped, sameOrigin } from "@/lib/same-origin";
import { syncSources } from "@/lib/sync-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const refuse = (status: number, error: string) => Response.json({ error }, { status, headers });

export async function POST(req: Request) {
  if (DEMO) return refuse(404, "Sources can only be synced in your local Innernet.");
  if (!sameOrigin(req)) return refuse(403, "Only Innernet's own pages may sync sources.");
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return refuse(415, "Send JSON.");
  const raw = await readCapped(req, 1024);
  if (raw === null) return refuse(413, "Too large.");
  let session: unknown;
  try {
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return refuse(400, "Bad JSON.");
    session = (body as Record<string, unknown>).session;
  } catch {
    return refuse(400, "Bad JSON.");
  }
  if (typeof session !== "string" || !SESSION_RE.test(session)) return refuse(400, "Bad session id.");

  const result = await syncSources(session);
  return result.ok ? Response.json(result, { headers }) : refuse(result.status, result.error);
}
