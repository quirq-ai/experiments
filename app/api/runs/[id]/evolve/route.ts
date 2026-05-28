// POST /api/runs/{id}/evolve
// body: { target_form: Form; prompt?: string }
//
// Streams the promotion: emits promotion_started, then promotion_chunk for each
// payload token as the promoter produces it, then promotion_finalized with the
// committed artifact. The new artifact is also fired on the run's SSE channel
// as artifact_created + head_moved so any connected client (Stage, Rail) sees
// it.

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import {
  appendArtifact,
  getRun,
  readArtifactContent,
} from '@/lib/storage';
import { getDefaultPromoter } from '@/lib/promote';
import { publish } from '@/lib/events';
import { FORMS, type EvolveRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as Partial<EvolveRequest>;
  if (!body?.target_form || !FORMS.includes(body.target_form)) {
    return NextResponse.json(
      { error: `target_form must be one of: ${FORMS.join(', ')}` },
      { status: 400 },
    );
  }
  const run = await getRun(params.id);
  if (!run) return NextResponse.json({ error: 'run not found' }, { status: 404 });
  if (run.artifacts.length === 0) {
    return NextResponse.json(
      { error: 'run has no artifacts yet; seed v01 before evolving' },
      { status: 400 },
    );
  }

  const head = run.artifacts.find((a) => a.id === run.head);
  if (!head) {
    return NextResponse.json({ error: 'head artifact missing' }, { status: 500 });
  }
  const parentRead = await readArtifactContent(run.id, head.id);
  if (!parentRead) {
    return NextResponse.json({ error: 'head content unreadable' }, { status: 500 });
  }

  const promotionId = `p_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  publish(run.id, {
    type: 'promotion_started',
    run_id: run.id,
    promotion_id: promotionId,
    target_form: body.target_form,
    parent_id: head.id,
  });

  // Fire the promotion. Do NOT block the HTTP response on the full promotion;
  // return 202 immediately and let the SSE channel deliver progress + result.
  // This way the browser can mount the streaming pane the instant Evolve is
  // clicked and watch tokens land.
  void (async () => {
    try {
      const promoter = getDefaultPromoter();
      const out = await promoter.promote({
        parent: head,
        parentContent: parentRead.content,
        targetForm: body.target_form!,
        prompt: body.prompt,
        onChunk: (delta) => {
          publish(run.id, {
            type: 'promotion_chunk',
            run_id: run.id,
            promotion_id: promotionId,
            delta,
          });
        },
      });

      const artifact = await appendArtifact({
        run_id: run.id,
        parent_id: head.id,
        form: body.target_form!,
        prompt: out.prompt,
        summary: out.summary,
        payload: out.payload,
        diff: out.diff,
        source: out.source,
      });

      publish(run.id, {
        type: 'promotion_finalized',
        run_id: run.id,
        promotion_id: promotionId,
        artifact,
      });
      publish(run.id, { type: 'artifact_created', run_id: run.id, artifact });
      publish(run.id, { type: 'head_moved', run_id: run.id, head: artifact.id });
    } catch (e: any) {
      publish(run.id, {
        type: 'promotion_failed',
        run_id: run.id,
        promotion_id: promotionId,
        error: String(e?.message ?? e),
      });
    }
  })();

  return NextResponse.json(
    { promotion_id: promotionId, target_form: body.target_form, parent_id: head.id },
    { status: 202 },
  );
}
