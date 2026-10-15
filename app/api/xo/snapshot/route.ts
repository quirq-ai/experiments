import type { NextRequest } from "next/server";
import { readSnapshot } from "@/lib/xo-reader";

/*
  GET /api/xo/snapshot?root=<abs path>&projects=a,b,c
  Reads .xo todos and work items from disk and returns them mapped to the
  app domain (workspace, members, labels, projects, issues). Read only:
  the store mirrors this on every load. See docs/ARCHITECTURE.md.
*/

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const root = params.get("root");
  const projects = (params.get("projects") ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  try {
    const snapshot = await readSnapshot(root, projects);
    return Response.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read .xo data";
    return Response.json({ error: message }, { status: 400 });
  }
}
