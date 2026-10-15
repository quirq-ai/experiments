"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { button, errorOf, fine, post } from "./request";

// Sources, part III: the remote database's own controls. Connect asks once, in place (a
// popup is never the place for it), naming what leaves the machine; connected, Sync now
// and Disconnect. The server words the status line, so this only asks and refreshes.

export function RemoteControls({ connected, label }: { connected: boolean; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  async function act(action: "connect" | "sync" | "disconnect" | "test", done: (r: Record<string, unknown>) => string) {
    setBusy(action);
    setMessage(action === "connect" ? { error: false, text: "Connecting and syncing. The first sync copies everything, so it can take a minute." } : null);
    try {
      const r = await post<Record<string, unknown>>("/api/storage", { action, ...(action === "connect" ? { confirm: true } : {}) });
      setAsking(false);
      setMessage({ error: false, text: done(r) });
      router.refresh();
    } catch (err) {
      setMessage({ error: true, text: errorOf(err) });
    } finally {
      setBusy(null);
    }
  }

  const synced = (r: Record<string, unknown>) => {
    const s = r.sync as { up?: number; down?: number } | undefined;
    return s ? `Synced: ${s.up ?? 0} up, ${s.down ?? 0} down.` : "Synced.";
  };

  return (
    <div className="mt-4">
      {connected ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" onClick={() => void act("sync", synced)} disabled={!!busy} className={button}>
            {busy === "sync" ? "Syncing" : "Sync now"}
          </button>
          <button type="button" onClick={() => void act("disconnect", () => "Disconnected. What it holds stays there.")} disabled={!!busy} className="link text-[13px] disabled:opacity-50">
            Disconnect
          </button>
        </div>
      ) : asking ? (
        <div role="group" aria-label="Connect the remote database" className="rounded-xl border border-notice-line bg-notice px-4 py-3.5">
          <p className="font-serif text-[15.5px] leading-[1.55] text-ink">
            Connecting copies your index, with its folder paths, README text and agent instructions, and your history to <span className="whitespace-nowrap">{label}</span>, and
            keeps them in step until you disconnect. History from your other machines comes down here.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" onClick={() => void act("connect", synced)} disabled={!!busy} className={`${button} border-ink text-ink`}>
              {busy === "connect" ? "Connecting" : "Connect and sync"}
            </button>
            <button type="button" onClick={() => setAsking(false)} disabled={!!busy} className="link text-[13px] disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" onClick={() => setAsking(true)} disabled={!!busy} className={`${button} border-ink text-ink`}>
            Connect
          </button>
          <button type="button" onClick={() => void act("test", (r) => `It answered in ${r.ms} ms.`)} disabled={!!busy} className="link text-[13px] disabled:opacity-50">
            {busy === "test" ? "Testing" : "Test"}
          </button>
        </div>
      )}
      {message && (
        <p role={message.error ? "alert" : "status"} className={`mt-2.5 ${message.error ? "text-[13px] text-ink" : fine}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
