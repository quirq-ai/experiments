import type { Label, Member, Workspace } from "./types";

/*
  Fallback data and color palettes. Since the XO integration landed, the
  app no longer ships demo content: issues, members and labels come from
  the .xo files on disk via /api/xo/snapshot. This file keeps the two
  things that must exist before (or without) a snapshot: a workspace
  identity and the operator member. It is also one of the three files
  allowed to contain raw hex colors (with app/globals.css and
  components/icons/), so every palette lives here.
*/

export const AVATAR_COLORS = [
  "#5e6ad2",
  "#4cb782",
  "#f2c94c",
  "#eb5757",
  "#4ea7fc",
  "#b59aff",
  "#f2994a",
] as const;

export const LABEL_COLORS = [
  "#b59aff",
  "#4ea7fc",
  "#4cb782",
  "#f2c94c",
  "#f2994a",
  "#eb5757",
  "#5e6ad2",
] as const;

/** Kind labels every mirrored issue gets tagged with. */
export const XO_LABELS: Label[] = [
  { id: "l-xo-todo", name: "Agent todo", color: "#b59aff" },
  { id: "l-xo-work", name: "Work item", color: "#4ea7fc" },
];

export const fallbackWorkspace: Workspace = {
  name: "XO Workspace",
  teamKey: "XO",
  teamName: "Projects",
  color: "#83d63a",
};

/*
  Stands in for the signed-in user until the snapshot loads. The id must
  match what lib/xo-reader.ts derives for "Workspace operator"
  (m-${slug(name)}), so history events logged before a successful sync
  still resolve to the same member afterwards.
*/
export const fallbackMembers: Member[] = [
  {
    id: "m-workspace-operator",
    name: "Workspace operator",
    email: "workspace-operator@local",
    role: "Admin",
    color: "#83d63a",
    joinedAt: "2026-01-01",
  },
];

export const fallbackCurrentMemberId = "m-workspace-operator";
