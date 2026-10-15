import type { NextRequest } from "next/server";
import { listFolders, resolveRoot } from "@/lib/xo-reader";

/*
  GET /api/xo/folders?root=<abs path>
  Lists the top level folders under the XO root for the Setup dialog.
  Without ?root= the server default is resolved and echoed back, so the
  dialog can show where data would load from.
*/

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("root");
  try {
    const root = await resolveRoot(requested);
    const folders = await listFolders(root);
    return Response.json({ root, folders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list folders";
    return Response.json({ error: message }, { status: 400 });
  }
}
