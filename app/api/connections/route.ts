import { NextRequest, NextResponse } from "next/server";
import {
  composioStatus,
  connectToolkit,
  listConnections,
  listToolkits,
} from "@/lib/server/composio";
import { errorResponse } from "@/lib/server/state";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    if (!composioStatus().configured) {
      return NextResponse.json({ configured: false, toolkits: [], connections: [] });
    }
    const [toolkits, connections] = await Promise.all([
      listToolkits(),
      listConnections(),
    ]);
    return NextResponse.json({ configured: true, toolkits, connections });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug = String(body.slug ?? "").trim();
    if (!slug) return errorResponse(new Error("Toolkit slug is required"));
    const result = await connectToolkit(slug);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
