// GET /api/runs            -> list of run summaries
// POST /api/runs           -> create a new run

import { NextResponse } from 'next/server';
import { createRun, listRuns } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const runs = await listRuns();
  return NextResponse.json({ runs });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body?.title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  const run = await createRun({ title: String(body.title) });
  return NextResponse.json({ run }, { status: 201 });
}
