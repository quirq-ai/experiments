// POST /api/runs/{id}/head
// body: { artifact_id: string }
// Moves HEAD (rollback or fast-forward). Emits head_moved event.

import { NextResponse } from 'next/server';
import { moveHead } from '@/lib/storage';
import { publish } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  if (!body?.artifact_id) {
    return NextResponse.json({ error: 'artifact_id is required' }, { status: 400 });
  }
  try {
    const run = await moveHead(params.id, String(body.artifact_id));
    publish(run.id, { type: 'head_moved', run_id: run.id, head: run.head });
    return NextResponse.json({ run });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 });
  }
}
