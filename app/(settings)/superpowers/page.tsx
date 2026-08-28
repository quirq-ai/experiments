"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, Dot, PageHeader, PillButton } from "@/components/ui";
import { CheckIcon, SearchIcon } from "@/components/icons";
import { CONNECTORS, CONNECTOR_CATEGORIES } from "@/lib/data";
import { useWorkspace } from "@/lib/store";

type LiveToolkit = {
  slug: string;
  name: string;
  description: string;
  logo: string;
  categories: string[];
};

type LiveConnection = {
  id: string;
  toolkitSlug: string;
  status: string;
};

type ConnectionsResponse = {
  configured: boolean;
  toolkits: LiveToolkit[];
  connections: LiveConnection[];
};

const PAGE_SIZE = 40;

export default function SuperpowersPage() {
  const { claude, composio, testClaude } = useWorkspace();

  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [connected, setConnected] = useState<Set<string>>(new Set());

  const [live, setLive] = useState<ConnectionsResponse | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [testBusy, setTestBusy] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConnections = useCallback(async () => {
    const res = await fetch("/api/connections");
    const json = (await res.json().catch(() => null)) as
      | (ConnectionsResponse & { error?: string })
      | null;
    if (!res.ok || !json) {
      throw new Error(
        json && typeof json.error === "string"
          ? json.error
          : `Request failed (${res.status})`
      );
    }
    setLive(json);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    let ticks = 0;
    pollRef.current = setInterval(() => {
      ticks += 1;
      if (ticks > 24) {
        stopPolling();
        return;
      }
      fetchConnections().catch(() => {});
    }, 5000);
  }, [fetchConnections, stopPolling]);

  useEffect(() => {
    fetchConnections().catch(() => {});
    return stopPolling;
  }, [fetchConnections, stopPolling]);

  async function handleTest() {
    setTestBusy(true);
    setTestError(null);
    try {
      await testClaude();
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestBusy(false);
    }
  }

  async function handleConnect(slug: string) {
    setConnectError(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        redirectUrl?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : `Request failed (${res.status})`
        );
      }
      if (json.redirectUrl) {
        window.open(json.redirectUrl, "_blank");
      }
      await fetchConnections().catch(() => {});
      startPolling();
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : "Could not start the connection"
      );
    }
  }

  async function handleDisconnect(id: string) {
    setConnectError(null);
    try {
      const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : `Request failed (${res.status})`
        );
      }
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : "Could not disconnect"
      );
    } finally {
      await fetchConnections().catch(() => {});
    }
  }

  const liveMode = live?.configured === true;

  const connBySlug = useMemo(() => {
    const map = new Map<string, LiveConnection>();
    for (const c of live?.connections ?? []) {
      const existing = map.get(c.toolkitSlug);
      if (!existing || c.status === "ACTIVE") map.set(c.toolkitSlug, c);
    }
    return map;
  }, [live]);

  const liveCategories = useMemo(() => {
    if (!liveMode || !live) return [];
    const counts = new Map<string, number>();
    for (const t of live.toolkits) {
      for (const cat of t.categories) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
    return ["All", "Connected", ...top];
  }, [live, liveMode]);

  const q = search.trim().toLowerCase();

  const liveFiltered = useMemo(() => {
    if (!liveMode || !live) return [];
    return live.toolkits.filter((t) => {
      const conn = connBySlug.get(t.slug);
      const inCategory =
        category === "All"
          ? true
          : category === "Connected"
            ? conn?.status === "ACTIVE"
            : t.categories.includes(category);
      const inSearch =
        q.length === 0 ||
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q);
      return inCategory && inSearch;
    });
  }, [live, liveMode, category, q, connBySlug]);

  const liveShown = liveFiltered.slice(0, visibleCount);

  function toggleConnect(name: string) {
    setConnected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  const previewFiltered = CONNECTORS.filter((c) => {
    const inCategory =
      category === "All"
        ? true
        : category === "Connected"
          ? connected.has(c.name)
          : c.category === category;
    const inSearch =
      q.length === 0 ||
      c.name.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q);
    return inCategory && inSearch;
  });

  const claudeStatus =
    claude.connected === true
      ? { color: "#34d399", label: "Connected" }
      : claude.connected === false
        ? { color: "#f4536e", label: "Unavailable" }
        : { color: "#a8a29e", label: "Not verified" };

  const categories = liveMode ? liveCategories : CONNECTOR_CATEGORIES;

  return (
    <div className="mx-auto max-w-[900px] px-8 py-7">
      <PageHeader
        title="Connections"
        subtitle="850+ third-party integrations for your AI agents. Connect once, use everywhere."
      />

      <div className="mb-6">
        <div className="mb-2 text-[12.5px] text-ink-faint">Backend</div>
        <Card className="divide-y divide-hairline-soft">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-medium">Claude Code</span>
                <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
                  <Dot color={claudeStatus.color} size={7} />
                  {claudeStatus.label}
                </span>
              </div>
              <div className="text-[12px] text-ink-faint">{claude.detail}</div>
              {testError && (
                <div className="text-[12px] text-danger">{testError}</div>
              )}
            </div>
            <PillButton
              variant="outline"
              className="shrink-0"
              disabled={testBusy}
              onClick={() => void handleTest()}
            >
              {testBusy ? "Testing…" : "Test connection"}
            </PillButton>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium">Composio</div>
              <div className="text-[12px] text-ink-faint">
                {composio.configured
                  ? "API key configured. Connections below are live."
                  : "Set COMPOSIO_API_KEY in .env.local to enable live connections. Showing a preview catalog."}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-1">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCategory(c);
              setVisibleCount(PAGE_SIZE);
            }}
            className={`rounded-lg px-2.5 py-1 text-[13px] transition-colors ${
              category === c
                ? "bg-chip font-medium text-ink"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {c}
          </button>
        ))}
        <div className="ml-auto flex w-[220px] items-center gap-2 rounded-full border border-hairline bg-card px-3.5 py-[7px]">
          <SearchIcon size={13} className="shrink-0 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder="Search connectors"
            className="w-full bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-faint"
          />
        </div>
      </div>

      {liveMode ? (
        <>
          {connectError && (
            <div className="mb-3 text-[12px] text-danger">{connectError}</div>
          )}
          <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
            {liveShown.map((t) => {
              const conn = connBySlug.get(t.slug);
              return (
                <div key={t.slug} className="flex items-center gap-3 py-3">
                  {t.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.logo}
                      alt=""
                      className="h-[34px] w-[34px] rounded-lg border border-hairline object-contain bg-white p-1"
                    />
                  ) : (
                    <span
                      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold text-white"
                      style={{ background: "#101828" }}
                    >
                      {t.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">
                      {t.name}
                    </div>
                    <div className="truncate text-[12px] text-ink-faint">
                      {t.description}
                    </div>
                  </div>
                  {conn?.status === "ACTIVE" ? (
                    <button
                      type="button"
                      onClick={() => void handleDisconnect(conn.id)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-chip px-4 py-[7px] text-[13px] font-medium text-ink-soft"
                    >
                      <CheckIcon size={12} />
                      Connected
                    </button>
                  ) : conn?.status === "INITIATED" ? (
                    <PillButton variant="outline" className="shrink-0" disabled>
                      Waiting…
                    </PillButton>
                  ) : (
                    <PillButton
                      variant="outline"
                      className="shrink-0"
                      onClick={() => void handleConnect(t.slug)}
                    >
                      Connect
                    </PillButton>
                  )}
                </div>
              );
            })}
          </div>
          {liveFiltered.length > visibleCount && (
            <div className="mt-6 flex justify-center">
              <PillButton
                variant="outline"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              >
                Load more
              </PillButton>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
            {previewFiltered.map((c) => {
              const isConnected = connected.has(c.name);
              return (
                <div key={c.name} className="flex items-center gap-3 py-3">
                  <span
                    className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold ${
                      c.iconBg === "#fff" ? "border border-hairline" : ""
                    }`}
                    style={{ background: c.iconBg, color: c.iconFg }}
                  >
                    {c.iconChar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13px] font-medium">
                      <span className="truncate">{c.name}</span>
                      {c.badge && (
                        <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-[10.5px] font-medium text-ink-soft">
                          {c.badge}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[12px] text-ink-faint">
                      {c.desc}
                    </div>
                  </div>
                  {isConnected ? (
                    <PillButton
                      variant="ghost"
                      className="shrink-0 border border-transparent bg-chip text-ink-soft"
                      onClick={() => toggleConnect(c.name)}
                    >
                      <CheckIcon size={12} />
                      Connected
                    </PillButton>
                  ) : (
                    <PillButton
                      variant="outline"
                      className="shrink-0"
                      onClick={() => toggleConnect(c.name)}
                    >
                      Connect
                    </PillButton>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-center">
            <PillButton variant="outline">Load more</PillButton>
          </div>
        </>
      )}
    </div>
  );
}
