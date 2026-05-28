// GET /api/runs/{id}/events
// Server-Sent Events stream for live rail updates.

import { subscribe } from '@/lib/events';
import type { RunEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: RunEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          // controller closed
        }
      };
      const unsub = subscribe(params.id, send);
      send({ type: 'ping', ts: new Date().toISOString() });

      const ping = setInterval(() => {
        send({ type: 'ping', ts: new Date().toISOString() });
      }, 15_000);

      const onClose = () => {
        clearInterval(ping);
        unsub();
        try { controller.close(); } catch { /* already closed */ }
      };
      // @ts-expect-error: controller exposes a private close path on abort
      controller.signal?.addEventListener?.('abort', onClose);
      // Best-effort cleanup if signal isn't present (Node 20 ReadableStream
      // doesn't expose one); the heartbeat will fail-fast on next enqueue if
      // the client is gone.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
