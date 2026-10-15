import { openStorageLocation } from "@/lib/source-storage";
import { readSourceRequest, sourceError, sourceHeaders } from "@/lib/source-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readSourceRequest(req);
  if (body instanceof Response) return body;
  if (typeof body.target !== "string" || (body.action !== "reveal" && body.action !== "edit")) return sourceError(400, "Choose a storage location to open.");
  try {
    await openStorageLocation(body.session, body.target, body.action);
    return Response.json({ ok: true }, { headers: sourceHeaders });
  } catch (error) {
    return sourceError(400, error instanceof Error && !("code" in error) ? error.message : "The file browser or text editor could not be opened. Copy the path to open it manually.");
  }
}
