"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { formatDate, nextId } from "./helpers";
import {
  AVATAR_COLORS,
  XO_LABELS,
  fallbackCurrentMemberId,
  fallbackMembers,
  fallbackWorkspace,
} from "./seed";
import { SYSTEM_DOCS_VERSION, SYSTEM_WIKI_DOCS } from "./system-docs";
import { healthLabel, krStatusLabel } from "./types";
import type {
  ID,
  Issue,
  KeyResult,
  KrStatus,
  Label,
  Member,
  Objective,
  ObjectiveEvent,
  Project,
  Role,
  Sprint,
  WikiDoc,
  Workspace,
  XoConfig,
  XoSnapshot,
  XoSourceSummary,
} from "./types";

/*
  Single app store. All domain mutations go through these actions so the
  data layer can later be swapped for an API without touching feature UI.

  Two kinds of state live here:
  - Mirror slices (workspace, members, labels, projects, issues): loaded
    from /api/xo/snapshot on every page load via loadSnapshot. Read only
    at the source; local edits to them are ephemeral and disappear on the
    next sync. Not persisted.
  - Local slices (sprints, objectives, wikiDocs, xoConfig): owned by the
    browser, persisted to localStorage with skipHydration; components
    must render behind <StoreHydrated> (app/(app)/layout.tsx does this).
*/

const now = () => new Date().toISOString().slice(0, 10);

/* Objective history: every mutation appends a human-readable event. */

const OKR_HISTORY_CAP = 50;

const okrEvent = (
  s: Pick<AppState, "members" | "currentMemberId">,
  summary: string
): ObjectiveEvent => ({
  id: nextId("ev"),
  at: new Date().toISOString(),
  // Null over a guess: attributing to members[0] would pin someone
  // else's avatar on the edit forever (history persists, members do not)
  memberId: s.members.find((m) => m.id === s.currentMemberId)?.id ?? null,
  summary,
});

/** Progress direction is fixed at creation; see krProgress in helpers. */
const krDirection = (kr: Pick<KeyResult, "current" | "target">): "increase" | "decrease" =>
  kr.target < kr.current ? "decrease" : "increase";

const logged = (o: Objective, ev: ObjectiveEvent): Objective => ({
  ...o,
  history: [ev, ...(o.history ?? [])].slice(0, OKR_HISTORY_CAP),
});

export interface AppState {
  workspace: Workspace;
  members: Member[];
  labels: Label[];
  projects: Project[];
  sprints: Sprint[];
  objectives: Objective[];
  issues: Issue[];
  wikiDocs: WikiDoc[];
  currentMemberId: ID;

  // XO mirror
  xoConfig: XoConfig;
  xoSources: XoSourceSummary[];
  xoRoot: string | null;
  syncedAt: string | null;
  syncError: string | null;
  systemDocsVersion: number;
  setXoConfig: (config: XoConfig) => Promise<boolean>;
  refreshFromXo: () => Promise<boolean>;
  loadSnapshot: (snapshot: XoSnapshot) => void;

  // Issues
  createIssue: (input: Partial<Issue> & { title: string }) => Issue;
  updateIssue: (id: ID, patch: Partial<Issue>) => void;
  deleteIssue: (id: ID) => void;

  // Sprints
  createSprint: (input: { startDate: string; endDate: string; goal?: string }) => Sprint;
  updateSprint: (id: ID, patch: Partial<Sprint>) => void;
  deleteSprint: (id: ID) => void;

  // Objectives (OKRs). Every mutation logs into objective.history.
  createObjective: (
    input: Omit<Objective, "id" | "createdAt" | "keyResults" | "history"> & {
      keyResults?: (Omit<KeyResult, "status"> & { status?: KrStatus })[];
    }
  ) => Objective;
  updateObjective: (id: ID, patch: Partial<Omit<Objective, "keyResults" | "history">>) => void;
  deleteObjective: (id: ID) => void;
  addKeyResult: (
    objectiveId: ID,
    input: Omit<KeyResult, "id" | "status"> & { status?: KrStatus }
  ) => void;
  updateKeyResult: (objectiveId: ID, krId: ID, patch: Partial<Omit<KeyResult, "id">>) => void;
  removeKeyResult: (objectiveId: ID, krId: ID) => void;

  // Members
  addMember: (input: { name: string; email: string; role?: Role }) => Member;
  removeMember: (id: ID) => void;

  // Wiki
  createWikiDoc: (input?: Partial<Pick<WikiDoc, "title" | "content">>) => WikiDoc;
  updateWikiDoc: (id: ID, patch: Partial<Pick<WikiDoc, "title" | "content">>) => void;
  deleteWikiDoc: (id: ID) => void;

}

const emptyState = () => ({
  workspace: fallbackWorkspace,
  members: fallbackMembers,
  labels: XO_LABELS,
  projects: [] as Project[],
  sprints: [] as Sprint[],
  objectives: [] as Objective[],
  issues: [] as Issue[],
  wikiDocs: [] as WikiDoc[],
  currentMemberId: fallbackCurrentMemberId,
  xoConfig: { root: null, projects: [] } as XoConfig,
  xoSources: [] as XoSourceSummary[],
  xoRoot: null as string | null,
  syncedAt: null as string | null,
  syncError: null as string | null,
  systemDocsVersion: 0,
});

/** Upsert the wiki doc mirroring PRD.md; edit the file, not the doc. */
const withPrdDoc = (docs: WikiDoc[], snapshot: XoSnapshot): WikiDoc[] => {
  if (!snapshot.prd) return docs;
  const date = snapshot.generatedAt.slice(0, 10);
  const doc: WikiDoc = {
    id: "w-prd",
    title: "PRD",
    content: snapshot.prd,
    authorId: null,
    createdAt: docs.find((d) => d.id === "w-prd")?.createdAt ?? date,
    updatedAt: date,
  };
  return [doc, ...docs.filter((d) => d.id !== "w-prd")];
};

const snapshotUrl = (config: XoConfig) => {
  const params = new URLSearchParams();
  if (config.root) params.set("root", config.root);
  if (config.projects.length > 0) params.set("projects", config.projects.join(","));
  const query = params.toString();
  return query ? `/api/xo/snapshot?${query}` : "/api/xo/snapshot";
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...emptyState(),

      loadSnapshot: (snapshot) =>
        set((s) => ({
          workspace: snapshot.workspace,
          members: snapshot.members,
          labels: snapshot.labels,
          projects: snapshot.projects,
          issues: snapshot.issues,
          currentMemberId: snapshot.currentMemberId,
          xoSources: snapshot.sources,
          xoRoot: snapshot.root,
          syncedAt: snapshot.generatedAt,
          syncError: null,
          // Keep the system wiki docs current: replace them by id when
          // their version bumps, leave user docs untouched. The PRD doc
          // mirrors PRD.md from disk on every sync (read only there).
          systemDocsVersion: SYSTEM_DOCS_VERSION,
          wikiDocs: withPrdDoc(
            s.systemDocsVersion >= SYSTEM_DOCS_VERSION
              ? s.wikiDocs
              : [
                  ...SYSTEM_WIKI_DOCS,
                  ...s.wikiDocs.filter((d) => !SYSTEM_WIKI_DOCS.some((sd) => sd.id === d.id)),
                ],
            snapshot
          ),
        })),

      refreshFromXo: async () => {
        try {
          const res = await fetch(snapshotUrl(get().xoConfig));
          const data: unknown = await res.json();
          if (!res.ok) {
            const message =
              typeof data === "object" && data !== null && "error" in data
                ? String((data as { error: unknown }).error)
                : `Sync failed (${res.status})`;
            set({ syncError: message });
            return false;
          }
          get().loadSnapshot(data as XoSnapshot);
          return true;
        } catch {
          set({ syncError: "Could not reach /api/xo/snapshot" });
          return false;
        }
      },

      setXoConfig: async (config) => {
        set({ xoConfig: config });
        return get().refreshFromXo();
      },

      createIssue: (input) => {
        const issue: Issue = {
          id: nextId("i"),
          number: Math.max(0, ...get().issues.map((i) => i.number)) + 1,
          status: "todo",
          priority: "none",
          labelIds: [],
          assigneeId: null,
          projectId: null,
          sprintId: null,
          objectiveId: null,
          estimate: null,
          dueDate: null,
          description: "",
          createdAt: now(),
          updatedAt: now(),
          ...input,
        };
        set((s) => ({ issues: [issue, ...s.issues] }));
        return issue;
      },

      updateIssue: (id, patch) =>
        set((s) => ({
          issues: s.issues.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: now() } : i)),
        })),

      deleteIssue: (id) => set((s) => ({ issues: s.issues.filter((i) => i.id !== id) })),

      createSprint: (input) => {
        const number = Math.max(0, ...get().sprints.map((s) => s.number)) + 1;
        const sprint: Sprint = { id: nextId("s"), number, name: `Sprint ${number}`, ...input };
        set((s) => ({
          sprints: [...s.sprints, sprint].sort((a, b) => a.startDate.localeCompare(b.startDate)),
        }));
        return sprint;
      },

      updateSprint: (id, patch) =>
        set((s) => ({ sprints: s.sprints.map((sp) => (sp.id === id ? { ...sp, ...patch } : sp)) })),

      deleteSprint: (id) =>
        set((s) => ({
          sprints: s.sprints.filter((sp) => sp.id !== id),
          issues: s.issues.map((i) => (i.sprintId === id ? { ...i, sprintId: null } : i)),
        })),

      createObjective: ({ keyResults = [], ...input }) => {
        const objective: Objective = {
          id: nextId("o"),
          createdAt: now(),
          keyResults: keyResults.map((kr) => ({
            ...kr,
            status: kr.status ?? "on_track",
            direction: kr.direction ?? krDirection(kr),
          })),
          history: [okrEvent(get(), "Created this objective")],
          ...input,
        };
        set((s) => ({ objectives: [...s.objectives, objective] }));
        return objective;
      },

      updateObjective: (id, patch) =>
        set((s) => ({
          objectives: s.objectives.map((o) => {
            if (o.id !== id) return o;
            const summaries: string[] = [];
            if (patch.name !== undefined && patch.name !== o.name)
              summaries.push(`Renamed to "${patch.name}"`);
            if (
              "description" in patch &&
              (patch.description ?? "") !== (o.description ?? "")
            )
              summaries.push("Updated the description");
            if (patch.health !== undefined && patch.health !== o.health)
              summaries.push(`Changed health to ${healthLabel(patch.health).toLowerCase()}`);
            if (patch.targetDate !== undefined && patch.targetDate !== o.targetDate)
              summaries.push(`Set target date to ${formatDate(patch.targetDate)}`);
            if (patch.ownerId !== undefined && patch.ownerId !== o.ownerId) {
              const owner = s.members.find((m) => m.id === patch.ownerId);
              summaries.push(`Changed owner to ${owner?.name ?? "Unknown"}`);
            }
            let next = { ...o, ...patch };
            for (const summary of summaries) next = logged(next, okrEvent(s, summary));
            return next;
          }),
        })),

      deleteObjective: (id) =>
        set((s) => ({
          objectives: s.objectives.filter((o) => o.id !== id),
          issues: s.issues.map((i) => (i.objectiveId === id ? { ...i, objectiveId: null } : i)),
        })),

      addKeyResult: (objectiveId, input) =>
        set((s) => ({
          objectives: s.objectives.map((o) => {
            if (o.id !== objectiveId) return o;
            const kr: KeyResult = {
              id: nextId("kr"),
              status: "on_track",
              direction: input.direction ?? krDirection(input),
              ...input,
            };
            return logged(
              { ...o, keyResults: [...o.keyResults, kr] },
              okrEvent(s, `Added key result "${kr.name}"`)
            );
          }),
        })),

      updateKeyResult: (objectiveId, krId, patch) =>
        set((s) => ({
          objectives: s.objectives.map((o) => {
            if (o.id !== objectiveId) return o;
            const kr = o.keyResults.find((k) => k.id === krId);
            if (!kr) return o;
            const unit = kr.unit ? ` ${kr.unit}` : "";
            const summaries: string[] = [];
            if (patch.current !== undefined && patch.current !== kr.current)
              summaries.push(`Updated "${kr.name}": ${kr.current} to ${patch.current}${unit}`);
            if (patch.target !== undefined && patch.target !== kr.target)
              summaries.push(`Changed target of "${kr.name}" to ${patch.target}${unit}`);
            if (patch.status !== undefined && patch.status !== kr.status)
              summaries.push(
                patch.status === "done"
                  ? `Completed "${kr.name}"`
                  : `Marked "${kr.name}" as ${krStatusLabel(patch.status).toLowerCase()}`
              );
            if (patch.name !== undefined && patch.name !== kr.name)
              summaries.push(`Renamed key result "${kr.name}" to "${patch.name}"`);
            let next = {
              ...o,
              keyResults: o.keyResults.map((k) => (k.id === krId ? { ...k, ...patch } : k)),
            };
            for (const summary of summaries) next = logged(next, okrEvent(s, summary));
            return next;
          }),
        })),

      removeKeyResult: (objectiveId, krId) =>
        set((s) => ({
          objectives: s.objectives.map((o) => {
            if (o.id !== objectiveId) return o;
            const kr = o.keyResults.find((k) => k.id === krId);
            if (!kr) return o;
            return logged(
              { ...o, keyResults: o.keyResults.filter((k) => k.id !== krId) },
              okrEvent(s, `Removed key result "${kr.name}"`)
            );
          }),
        })),

      addMember: ({ name, email, role = "Member" }) => {
        const member: Member = {
          id: nextId("m"),
          name,
          email,
          role,
          color: AVATAR_COLORS[get().members.length % AVATAR_COLORS.length],
          joinedAt: now(),
        };
        set((s) => ({ members: [...s.members, member] }));
        return member;
      },

      removeMember: (id) =>
        set((s) => ({
          members: s.members.filter((m) => m.id !== id),
          issues: s.issues.map((i) => (i.assigneeId === id ? { ...i, assigneeId: null } : i)),
          wikiDocs: s.wikiDocs.map((d) => (d.authorId === id ? { ...d, authorId: null } : d)),
        })),

      createWikiDoc: (input = {}) => {
        // currentMemberId can dangle after removeMember; fall back like useCurrentMember
        const { members, currentMemberId } = get();
        const author = members.find((m) => m.id === currentMemberId) ?? members[0];
        const doc: WikiDoc = {
          id: nextId("w"),
          title: input.title ?? "Untitled",
          content: input.content ?? "",
          authorId: author?.id ?? null,
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ wikiDocs: [doc, ...s.wikiDocs] }));
        return doc;
      },

      updateWikiDoc: (id, patch) =>
        set((s) => ({
          wikiDocs: s.wikiDocs.map((d) =>
            d.id === id ? { ...d, ...patch, updatedAt: now() } : d
          ),
        })),

      deleteWikiDoc: (id) =>
        set((s) => ({ wikiDocs: s.wikiDocs.filter((d) => d.id !== id) })),
    }),
    {
      name: "linear-clone-store",
      skipHydration: true,
      version: 5,
      // Only local slices persist; mirror slices reload from .xo each
      // visit. v1 snapshots persisted everything; v2 tracked a boolean
      // systemDocsSeeded, folded into systemDocsVersion in v3; v4 added
      // objective.history and keyResult.status; v5 added
      // keyResult.direction.
      partialize: (s) => ({
        sprints: s.sprints,
        objectives: s.objectives,
        wikiDocs: s.wikiDocs,
        xoConfig: s.xoConfig,
        systemDocsVersion: s.systemDocsVersion,
      }),
      migrate: (persisted) => {
        const state = persisted as Partial<AppState> & { systemDocsSeeded?: boolean };
        return {
          sprints: state.sprints ?? [],
          objectives: (state.objectives ?? []).map((o) => ({
            ...o,
            history: o.history ?? [],
            keyResults: (o.keyResults ?? []).map((kr) => ({
              ...kr,
              status: kr.status ?? ("on_track" as KrStatus),
              direction: kr.direction ?? krDirection(kr),
            })),
          })),
          wikiDocs: state.wikiDocs ?? [],
          xoConfig: state.xoConfig ?? { root: null, projects: [] },
          systemDocsVersion: state.systemDocsVersion ?? (state.systemDocsSeeded ? 1 : 0),
        } as AppState;
      },
    }
  )
);

/* Common selectors */

export const useCurrentMember = () =>
  useAppStore((s) => s.members.find((m) => m.id === s.currentMemberId) ?? s.members[0]);

export const useIssueByKey = (key: string) =>
  useAppStore((s) => {
    const num = Number(key.split("-")[1]);
    return s.issues.find((i) => i.number === num);
  });
