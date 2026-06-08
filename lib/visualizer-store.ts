import { create } from "zustand";
import { sampleDetail } from "@/lib/sampleData";
import {
  Branch,
  BranchPayload,
  Commit,
  CommitDetail,
  CommitDetailPayload,
  CommitPayload,
  RepoState,
  RepoStatePayload,
} from "@/lib/types";

// Fibonacci batch sizes for lazy, HEAD-anchored history loading: start at HEAD
// (1), then pull 1, 2, 3, 5, 8, 13 … older commits per "load older" request.
const FIB = [
  1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584,
] as const;

/**
 * Single client store for the visualizer, mirroring xo-swarm's `lib/*-store.ts`
 * zustand pattern so the sidebar, header, and stage can all read/drive the same
 * state without prop drilling (the shape xo-swarm uses for its own surfaces).
 */
interface VisualizerState {
  path: string;
  repoLabel: string;
  isGit: boolean;
  branches: Branch[];
  branch: string;
  commits: Commit[];
  hasMoreHistory: boolean; // older commits remain to lazy-load
  loadingMore: boolean; // a "load older" fetch is in flight
  fibStep: number; // index into FIB for the next batch
  nextBatch: number; // size of the next older batch (0 when fully loaded)
  loading: boolean;
  error: string;
  replaySignal: number;
  selected: number | null;

  // expanded detail modal
  detail: CommitDetail | null;
  detailOpen: boolean;
  detailLoading: boolean;
  detailError: string;

  // current working state of the repo (HEAD + uncommitted changes)
  state: RepoState | null;
  runOpen: boolean;
  experimentBusy: boolean;

  loadRepo: (path: string) => Promise<void>;
  loadCommits: (branch: string) => Promise<void>;
  loadOlder: () => Promise<void>;
  loadState: () => Promise<void>;
  selectBranch: (name: string) => Promise<void>;
  pickFolder: () => Promise<void>;
  replay: () => void;
  selectCommit: (i: number) => void;
  clearSelected: () => void;
  openDetail: () => Promise<void>;
  closeDetail: () => void;
  openRun: () => void;
  closeRun: () => void;
  createExperiment: () => Promise<void>;
}

export const useVisualizer = create<VisualizerState>((set, get) => ({
  path: "",
  repoLabel: "sample data",
  isGit: false,
  branches: [],
  branch: "main",
  commits: [],
  hasMoreHistory: false,
  loadingMore: false,
  fibStep: 0,
  nextBatch: 0,
  loading: false,
  error: "",
  replaySignal: 0,
  selected: null,

  detail: null,
  detailOpen: false,
  detailLoading: false,
  detailError: "",

  state: null,
  runOpen: false,
  experimentBusy: false,

  loadState: async () => {
    try {
      const repoPath = get().path.trim();
      const qs = repoPath ? `?repo=${encodeURIComponent(repoPath)}` : "";
      const res = await fetch(`/api/state${qs}`);
      const data = (await res.json()) as RepoStatePayload & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "state failed");
      set({ state: data.state });
    } catch {
      set({ state: null });
    }
  },

  // Lightweight first paint: load only HEAD (the first Fibonacci batch). Older
  // history is pulled on demand by loadOlder.
  loadCommits: async (branch) => {
    set({ loading: true, error: "" });
    try {
      const repoPath = get().path.trim();
      const qs = new URLSearchParams({
        branch,
        skip: "0",
        limit: String(FIB[0]),
      });
      if (repoPath) qs.set("repo", repoPath);
      const res = await fetch(`/api/commits?${qs}`);
      const data = (await res.json()) as CommitPayload & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "load failed");
      const hasMore = data.hasMore ?? false;
      set({
        commits: data.commits,
        branch: data.branch,
        selected: null,
        hasMoreHistory: hasMore,
        fibStep: 1,
        nextBatch: hasMore ? FIB[1] : 0,
      });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  // Fetch the next Fibonacci-sized batch of older commits and prepend it (older
  // commits sit to the left). Selection is an index into the array, so shift it
  // by however many we prepended to keep the same commit pinned.
  loadOlder: async () => {
    const { loadingMore, hasMoreHistory, commits, fibStep, path, branch } =
      get();
    if (loadingMore || !hasMoreHistory) return;
    set({ loadingMore: true, error: "" });
    try {
      const size = FIB[Math.min(fibStep, FIB.length - 1)];
      const qs = new URLSearchParams({
        branch,
        skip: String(commits.length),
        limit: String(size),
      });
      const repoPath = path.trim();
      if (repoPath) qs.set("repo", repoPath);
      const res = await fetch(`/api/commits?${qs}`);
      const data = (await res.json()) as CommitPayload & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "load failed");
      const older = data.commits; // ascending, all older than what we hold
      const hasMore = (data.hasMore ?? false) && older.length > 0;
      set((s) => {
        const step = s.fibStep + 1;
        return {
          commits: [...older, ...s.commits],
          selected: s.selected === null ? null : s.selected + older.length,
          hasMoreHistory: hasMore,
          fibStep: step,
          nextBatch: hasMore ? FIB[Math.min(step, FIB.length - 1)] : 0,
        };
      });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loadingMore: false });
    }
  },

  loadRepo: async (path) => {
    set({ path, error: "", selected: null, detailOpen: false });
    try {
      const qs = path ? `?repo=${encodeURIComponent(path)}` : "";
      const res = await fetch(`/api/branches${qs}`);
      const data = (await res.json()) as BranchPayload & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "load failed");
      const isGit = data.source === "git";
      set({
        branches: data.branches,
        isGit,
        repoLabel: isGit ? data.repo : "sample data",
      });
      const first =
        data.branches.find((b) => b.current)?.name ||
        data.branches[0]?.name ||
        "main";
      await get().loadCommits(first);
      get().loadState();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  selectBranch: async (name) => {
    await get().loadCommits(name);
  },

  pickFolder: async () => {
    set({ loading: true, error: "" });
    try {
      const res = await fetch("/api/pick-folder");
      const data = (await res.json()) as {
        path?: string;
        canceled?: boolean;
        error?: string;
      };
      if (!res.ok || data.error) throw new Error(data.error || "picker failed");
      if (data.canceled || !data.path) return;
      await get().loadRepo(data.path);
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  replay: () => set((s) => ({ replaySignal: s.replaySignal + 1 })),

  selectCommit: (i) =>
    set((s) => ({ selected: s.selected === i ? null : i })),

  clearSelected: () => set({ selected: null }),

  openDetail: async () => {
    const { selected, commits, isGit, path } = get();
    if (selected === null || !commits[selected]) return;
    const commit = commits[selected];
    set({ detailOpen: true, detailError: "" });
    if (!isGit) {
      set({ detail: sampleDetail(commit) });
      return;
    }
    set({ detail: null, detailLoading: true });
    try {
      const qs = new URLSearchParams({ repo: path.trim(), hash: commit.hash });
      const res = await fetch(`/api/commit?${qs}`);
      const data = (await res.json()) as CommitDetailPayload & {
        error?: string;
      };
      if (!res.ok || data.error) throw new Error(data.error || "load failed");
      set({ detail: data.detail });
    } catch (e) {
      set({ detailError: (e as Error).message });
    } finally {
      set({ detailLoading: false });
    }
  },

  closeDetail: () => set({ detailOpen: false }),

  openRun: () => set({ runOpen: true }),
  closeRun: () => set({ runOpen: false }),

  // Spin off a new worktree + branch (committed so it shows in the branch list),
  // launch a Claude session in it, then refresh branches and jump to the new one
  // so it appears immediately in the right "Analyze" sidebar.
  createExperiment: async () => {
    const repo = get().path.trim();
    if (!repo || !get().isGit) return;
    set({ experimentBusy: true, error: "" });
    try {
      const res = await fetch("/api/experiment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo }),
      });
      const data = (await res.json()) as { branch?: string; error?: string };
      if (!res.ok || data.error || !data.branch) {
        throw new Error(data.error || "experiment failed");
      }
      const br = await fetch(`/api/branches?repo=${encodeURIComponent(repo)}`);
      const bd = (await br.json()) as BranchPayload & { error?: string };
      if (br.ok && !bd.error) set({ branches: bd.branches });
      await get().selectBranch(data.branch);
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ experimentBusy: false });
    }
  },
}));
