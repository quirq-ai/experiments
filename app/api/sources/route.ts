import { APP } from "@/components/activity/shared";
import { appendEvent } from "@/lib/activity";
import { ingestSession } from "@/lib/db/ingest";
import { remoteSummary, sourceInfo } from "@/lib/source-storage";
import { readSourceRequest, sourceError, sourceHeaders } from "@/lib/source-request";
import { readRemoteConfig, validSourceSelection, writeSourceSelection } from "@/lib/sources";
import { normalizeRemoteConfig, type RemoteConfig } from "@/lib/remote-config";
import { sourceSyncRunning } from "@/lib/sync-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Sources page's input: inspect it, or save which sources to use and the GitHub
// repositories Remote collects. Local only, from this app's own pages (lib/source-request.ts).

export async function POST(req: Request) {
  const body = await readSourceRequest(req);
  if (body instanceof Response) return body;
  if (body.action !== "inspect" && body.action !== "save") return sourceError(400, "Unknown source action.");
  if (body.action === "save" && !validSourceSelection(body.selection)) return sourceError(400, "Choose Local, Remote, or both.");
  if (body.action === "save" && sourceSyncRunning()) return sourceError(409, "Wait for the current sync to finish before changing sources.");
  try {
    if (body.action === "save") {
      let remote: RemoteConfig;
      try {
        remote = body.remote === undefined ? readRemoteConfig() : normalizeRemoteConfig(body.remote);
      } catch (error) {
        return sourceError(400, error instanceof Error ? error.message : "Check the repository links.");
      }
      const selection = body.selection as { local: boolean; remote: boolean };
      if (selection.remote && !remote.repositories.length) return sourceError(400, "Add at least one GitHub repository to use Remote.");
      writeSourceSelection(selection, remote);
      const logged = appendEvent(body.session, APP, { kind: "sources", title: "Sources updated", local: selection.local, remote: selection.remote, ...remoteSummary(remote) });
      if (!logged.ok) return sourceError(500, "Sources were saved, but the change could not be recorded in activity.");
      await ingestSession(body.session);
    }
    return Response.json(sourceInfo(body.session), { headers: sourceHeaders });
  } catch {
    return sourceError(500, "Sources could not be read or saved. Check the source settings and file permissions.");
  }
}
