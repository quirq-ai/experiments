"use client";

import Link from "next/link";
import { PriorityIcon } from "@/components/icons/priority-icon";
import { StatusIcon } from "@/components/icons/status-icon";
import { LabelChip } from "@/components/shared/label-chip";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { formatDate } from "@/lib/helpers";
import { useAppStore } from "@/lib/store";
import type { Issue } from "@/lib/types";

/*
  The canonical Linear issue row, shared by issues, sprint, and OKR views.
  Keep the export signature stable; other features import it.
*/
export function IssueRow({ issue }: { issue: Issue }) {
  const labels = useAppStore((s) => s.labels);
  const members = useAppStore((s) => s.members);
  const teamKey = useAppStore((s) => s.workspace.teamKey);

  const issueLabels = labels.filter((l) => issue.labelIds.includes(l.id));
  const assignee = members.find((m) => m.id === issue.assigneeId) ?? null;

  return (
    <Link
      href={`/issue/${teamKey}-${issue.number}`}
      className="flex h-10 items-center gap-2.5 px-4 hover:bg-accent"
    >
      <PriorityIcon priority={issue.priority} />
      <span className="w-14 shrink-0 text-xs text-faint">
        {teamKey}-{issue.number}
      </span>
      <StatusIcon status={issue.status} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {issue.title}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="hidden items-center gap-1.5 lg:flex">
          {issueLabels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </span>
        {issue.dueDate ? (
          <span className="hidden text-xs text-muted-foreground md:block">
            Due {formatDate(issue.dueDate)}
          </span>
        ) : null}
        <span className="hidden w-12 text-right text-xs text-faint sm:block">
          {formatDate(issue.createdAt)}
        </span>
        <MemberAvatar member={assignee} size="sm" />
      </span>
    </Link>
  );
}
