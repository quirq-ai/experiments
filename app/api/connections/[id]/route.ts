import { NextRequest, NextResponse } from "next/server";
import { deleteConnection } from "@/lib/server/composio";
import { errorResponse } from "@/lib/server/state";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteConnection(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
