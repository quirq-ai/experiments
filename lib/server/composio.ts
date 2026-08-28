import { Composio } from "@composio/core";

export type ComposioStatus = { configured: boolean };

export type ComposioToolkit = {
  slug: string;
  name: string;
  description: string;
  logo: string;
  categories: string[];
};

export type ComposioConnection = {
  id: string;
  toolkitSlug: string;
  status: string;
};

export const COMPOSIO_USER_ID = "default";

let client: Composio | null = null;

function getComposio(): Composio {
  if (!process.env.COMPOSIO_API_KEY) {
    throw new Error("COMPOSIO_API_KEY is not set");
  }
  if (!client) {
    client = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
  }
  return client;
}

export function composioStatus(): ComposioStatus {
  return { configured: Boolean(process.env.COMPOSIO_API_KEY) };
}

export async function listToolkits(): Promise<ComposioToolkit[]> {
  const composio = getComposio();
  const res = await composio.toolkits.get({});
  return res.map((item) => ({
    slug: item.slug,
    name: item.name || item.slug,
    description: item.meta?.description ?? "",
    logo: item.meta?.logo ?? "",
    categories: (item.meta?.categories ?? []).map((c) => c.name),
  }));
}

export async function listConnections(): Promise<ComposioConnection[]> {
  const composio = getComposio();
  const res = (await composio.connectedAccounts.list({
    userIds: [COMPOSIO_USER_ID],
  })) as unknown as { items?: Record<string, unknown>[] };
  return (res.items ?? []).map((item) => {
    const toolkit = (item.toolkit ?? {}) as Record<string, unknown>;
    return {
      id: String(item.id ?? ""),
      toolkitSlug: String(toolkit.slug ?? item.toolkit_slug ?? ""),
      status: String(item.status ?? "UNKNOWN"),
    };
  });
}

export async function connectToolkit(
  slug: string
): Promise<{ redirectUrl: string; connectionId: string }> {
  const composio = getComposio();
  const req = await composio.toolkits.authorize(COMPOSIO_USER_ID, slug);
  if (!req.redirectUrl) {
    throw new Error(
      `Composio did not return a redirect URL for ${slug}. It may need a custom auth config.`
    );
  }
  return { redirectUrl: req.redirectUrl, connectionId: String(req.id ?? "") };
}

export async function deleteConnection(id: string): Promise<void> {
  await getComposio().connectedAccounts.delete(id);
}

export function composioMcp(): {
  type: "http";
  url: string;
  headers: Record<string, string>;
} | null {
  const url = process.env.COMPOSIO_MCP_URL;
  if (!url) return null;
  return {
    type: "http",
    url,
    headers: process.env.COMPOSIO_API_KEY
      ? { "x-api-key": process.env.COMPOSIO_API_KEY }
      : {},
  };
}
