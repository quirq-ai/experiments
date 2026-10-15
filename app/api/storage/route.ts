import { APP } from "@/components/activity/shared";
import { appendEvent } from "@/lib/activity";
import { ingestSession } from "@/lib/db/ingest";
import { errorText } from "@/lib/db/log";
import { forgetRemote, reachRemote, remoteStatus, syncRemote } from "@/lib/db/remote-sync";
import { dbStatus } from "@/lib/db/status";
import { readSourceRequest, sourceError, sourceHeaders } from "@/lib/source-request";
import { remoteConnected, remoteDatabase, writeRemoteConnected } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The storage on Sources: this machine's database, always in use, and the remote one you
// can connect beside it. Local only, from this app's own pages (lib/source-request.ts).
//
//   status      both databases, as they stand
//   test        reach the remote database without connecting it
//   connect     connect it and sync at once. Asks for `confirm: true`: from then on this
//               machine's index (folder paths, README text, agent instructions) and its
//               history are copied there, and history from your other machines comes down.
//   sync        sync now
//   disconnect  stop syncing; what the remote holds stays there

async function status() {
  const [local, remote] = await Promise.all([dbStatus(), remoteStatus()]);
  return { local, remote };
}

export async function POST(req: Request) {
  const body = await readSourceRequest(req);
  if (body instanceof Response) return body;

  switch (body.action) {
    case "status":
      return Response.json(await status(), { headers: sourceHeaders });

    case "test":
      try {
        return Response.json({ ms: await reachRemote() }, { headers: sourceHeaders });
      } catch (err) {
        return sourceError(502, err instanceof Error ? err.message : "The remote database did not answer.");
      }

    case "connect": {
      if (!remoteDatabase()) return sourceError(400, "No remote database is set up yet.");
      if (body.confirm !== true) return sourceError(400, "Confirm that this machine's index and history may be copied to the remote database.");
      if (process.env.INNERNET_REMOTE) return sourceError(409, "INNERNET_REMOTE is set for this server, so the connection can only change there.");
      try {
        await reachRemote();
      } catch (err) {
        return sourceError(502, err instanceof Error ? err.message : "The remote database did not answer.");
      }
      writeRemoteConnected(true);
      const sync = await syncRemote();
      appendEvent(body.session, APP, { kind: "storage", title: "Connected the remote database", url: "/sources#storage" });
      await ingestSession(body.session);
      return Response.json({ sync, ...(await status()) }, { status: sync.ok ? 200 : 503, headers: sourceHeaders });
    }

    case "sync": {
      if (!remoteConnected()) return sourceError(400, "Connect the remote database first.");
      const sync = await syncRemote();
      return Response.json({ sync, ...(await status()) }, { status: sync.ok ? 200 : 503, headers: sourceHeaders });
    }

    case "disconnect": {
      if (process.env.INNERNET_REMOTE) return sourceError(409, "INNERNET_REMOTE is set for this server, so the connection can only change there.");
      try {
        writeRemoteConnected(false);
      } catch (err) {
        return sourceError(500, `The setting could not be saved (${errorText(err)}).`);
      }
      forgetRemote();
      appendEvent(body.session, APP, { kind: "storage", title: "Disconnected the remote database", url: "/sources#storage" });
      await ingestSession(body.session);
      return Response.json(await status(), { headers: sourceHeaders });
    }

    default:
      return sourceError(400, "Unknown storage action.");
  }
}
