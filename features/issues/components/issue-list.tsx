"use client";

import type { ReactNode } from "react";
import { Plus, RefreshCcw } from "lucide-react";
import { PriorityIcon } from "@/components/icons/priority-icon";
import { StatusIcon } from "@/components/icons/status-icon";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Button } from "@/components/ui/button";
import { IssueRow } from "@/features/issues/components/issue-row";
import { useAppStore } from "@/lib/store";
import { PRIORITIES, STATUSES } from "@/lib/types";
import type { Issue } from "@/lib/types";
import { useUiStore } from "@/lib/ui-store";

/*
  Grouped issue list shared by the issues, my-issues, and sprint views.
  Groups follow the canonical order of the grouping dimension; empty
  groups are skipped. The plus button on a group header opens the
  new-issue modal prefilled for that group.
*/

interface IssueGroup {
  key: string;
  glyph: ReactNode;
  name: string;
  issues: Issue[];
  defaults: Partial<Issue>;
}

export function IssueList({
  issues,
  grouping = "status",
}: {
  issues: Issue[];
  grouping?: "status" | "priority" | "assignee" | "sprint";
}) {
  const members = useAppStore((s) => s.members);
  const sprints = useAppStore((s) => s.sprints);
  const openNewIssue = useUiStore((s) => s.openNewIssue);

  let groups: IssueGroup[];
  switch (grouping) {
    case "priority":
      groups = PRIORITIES.map((p) => ({
        key: p.id,
        glyph: <PriorityIcon priority={p.id} />,
        name: p.label,
        issues: issues.filter((i) => i.priority === p.id),
        defaults: { priority: p.id },
      }));
      break;
    case "assignee":
      groups = [
        ...members.map((m) => ({
          key: m.id,
          glyph: <MemberAvatar member={m} size="sm" />,
          name: m.name,
          issues: issues.filter((i) => i.assigneeId === m.id),
          defaults: { assigneeId: m.id },
        })),
        {
          key: "unassigned",
          glyph: <MemberAvatar member={null} size="sm" />,
          name: "Unassigned",
          issues: issues.filter((i) => !i.assigneeId),
          defaults: { assigneeId: null },
        },
      ];
      break;
    case "sprint":
      groups = [
        ...[...sprints]
          .sort((a, b) => a.number - b.number)
          .map((sp) => ({
            key: sp.id,
            glyph: (
              <RefreshCcw className="size-4 text-muted-foreground" strokeWidth={1.8} />
            ),
            name: sp.name,
            issues: issues.filter((i) => i.sprintId === sp.id),
            defaults: { sprintId: sp.id },
          })),
        {
          key: "no-sprint",
          glyph: <RefreshCcw className="size-4 text-faint" strokeWidth={1.8} />,
          name: "No sprint",
          issues: issues.filter((i) => !i.sprintId),
          defaults: { sprintId: null },
        },
      ];
      break;
    default:
      groups = STATUSES.map((s) => ({
        key: s.id,
        glyph: <StatusIcon status={s.id} />,
        name: s.label,
        issues: issues.filter((i) => i.status === s.id),
        defaults: { status: s.id },
      }));
  }

  return (
    <div>
      {groups
        .filter((group) => group.issues.length > 0)
        .map((group) => (
          <section key={group.key}>
            <div className="flex h-9 items-center gap-2 bg-white/[0.03] px-4">
              {group.glyph}
              <span className="text-sm font-medium text-foreground">{group.name}</span>
              <span className="text-sm text-muted-foreground">{group.issues.length}</span>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`New issue in ${group.name}`}
                onClick={() => openNewIssue(group.defaults)}
              >
                <Plus className="size-4 text-muted-foreground" strokeWidth={1.8} />
              </Button>
            </div>
            {group.issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </section>
        ))}
    </div>
  );
}
