// GET /api/runs/{id}/artifacts/{aid}
// Returns the raw artifact content with the right content-type. Used by
// renderers that mount via iframe (deck, nextjs) or fetch text (md, terminal,
// notebook).

import { NextResponse } from 'next/server';
import { readArtifactContent } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string; aid: string } },
) {
  const result = await readArtifactContent(params.id, params.aid);
  if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return new Response(result.content, {
    headers: { 'Content-Type': result.mime, 'Cache-Control': 'no-store' },
  });
}
