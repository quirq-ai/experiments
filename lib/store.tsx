"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Campaign, CAMPAIGNS, USER, WatchedAccount } from "./data";

export type { WatchedAccount } from "./data";

export type ClaudeInfo = {
  connected: boolean | "unverified";
  detail: string;
};

export type ComposioInfo = { configured: boolean };

export type BusinessProfileClient = Record<string, unknown> & {
  name?: string;
};

type ServerState = {
  credits: number;
  plan: string;
  campaigns: Campaign[];
  watched: WatchedAccount[];
  profile: BusinessProfileClient;
  claude: ClaudeInfo;
  composio: ComposioInfo;
};

export type DispatchPayload = {
  contact: string;
  company: string;
  signal: string;
  prompt: string;
};

type WorkspaceState = {
  loaded: boolean;
  credits: number;
  plan: string;
  campaigns: Campaign[];
  watched: WatchedAccount[];
  profile: BusinessProfileClient;
  claude: ClaudeInfo;
  composio: ComposioInfo;
  sequencedLeadIds: Set<string>;
  dispatch: (
    payload: DispatchPayload
  ) => Promise<{ campaignId: string; via: string }>;
  getMoreLeads: (campaignId: string) => Promise<void>;
  markSequenced: (leadId: string) => Promise<void>;
  addWatched: (a: Omit<WatchedAccount, "id"> & { id?: string }) => Promise<void>;
  removeWatched: (id: string) => Promise<void>;
  saveProfile: (patch: Record<string, unknown>) => Promise<void>;
  testClaude: () => Promise<void>;
  refresh: () => Promise<void>;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
};

const WorkspaceContext = createContext<WorkspaceState | null>(null);

async function api<T = ServerState>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof json.error === "string" ? json.error : `Request failed (${res.status})`
    );
  }
  return json as T;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ServerState>({
    credits: USER.credits,
    plan: USER.plan,
    campaigns: CAMPAIGNS,
    watched: [],
    profile: {},
    claude: { connected: "unverified", detail: "Loading…" },
    composio: { configured: false },
  });
  const [loaded, setLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const ticketRef = useRef(0);
  const appliedRef = useRef(0);

  const applyState = useCallback((s: ServerState, ticket: number) => {
    if (ticket < appliedRef.current) return;
    appliedRef.current = ticket;
    setState({
      credits: s.credits,
      plan: s.plan,
      campaigns: s.campaigns,
      watched: s.watched,
      profile: s.profile,
      claude: s.claude,
      composio: s.composio,
    });
    setLoaded(true);
  }, []);

  const call = useCallback(
    async <T extends ServerState>(url: string, init?: RequestInit) => {
      const ticket = ++ticketRef.current;
      const json = await api<T>(url, init);
      applyState(json, ticket);
      return json;
    },
    [applyState]
  );

  const refresh = useCallback(async () => {
    await call("/api/state");
  }, [call]);

  useEffect(() => {
    refresh().catch(() => {
      /* server not reachable; keep seed data visible */
    });
  }, [refresh]);

  const dispatch = useCallback(
    async (payload: DispatchPayload) => {
      const s = await call<ServerState & { campaignId: string; via: string }>(
        "/api/dispatch",
        { method: "POST", body: JSON.stringify(payload) }
      );
      return { campaignId: s.campaignId, via: s.via };
    },
    [call]
  );

  const getMoreLeads = useCallback(
    async (campaignId: string) => {
      await call(`/api/campaigns/${campaignId}/more-leads`, { method: "POST" });
    },
    [call]
  );

  const markSequenced = useCallback(
    async (leadId: string) => {
      await call(`/api/leads/${leadId}/apply-sequence`, { method: "POST" });
    },
    [call]
  );

  const addWatched = useCallback(
    async (a: Omit<WatchedAccount, "id"> & { id?: string }) => {
      await call("/api/watcher", {
        method: "POST",
        body: JSON.stringify({
          name: a.name,
          domain: a.domain,
          signals: a.signals,
        }),
      });
    },
    [call]
  );

  const removeWatched = useCallback(
    async (id: string) => {
      await call(`/api/watcher/${id}`, { method: "DELETE" });
    },
    [call]
  );

  const saveProfile = useCallback(
    async (patch: Record<string, unknown>) => {
      await call("/api/profile", {
        method: "PUT",
        body: JSON.stringify(patch),
      });
    },
    [call]
  );

  const testClaude = useCallback(async () => {
    await call("/api/claude/test", { method: "POST" });
  }, [call]);

  const sequencedLeadIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of state.campaigns) {
      for (const l of c.leads) {
        if (l.status === "sequenced" || l.sequence) ids.add(l.id);
      }
    }
    return ids;
  }, [state.campaigns]);

  const value = useMemo<WorkspaceState>(
    () => ({
      loaded,
      ...state,
      sequencedLeadIds,
      dispatch,
      getMoreLeads,
      markSequenced,
      addWatched,
      removeWatched,
      saveProfile,
      testClaude,
      refresh,
      sidebarOpen,
      setSidebarOpen,
    }),
    [
      loaded,
      state,
      sequencedLeadIds,
      dispatch,
      getMoreLeads,
      markSequenced,
      addWatched,
      removeWatched,
      saveProfile,
      testClaude,
      refresh,
      sidebarOpen,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
