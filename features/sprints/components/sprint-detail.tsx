"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Ellipsis, Plus, RefreshCcw } from "lucide-react";
import { StatusIcon } from "@/components/icons/status-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { PanelHeader } from "@/components/shell/panel-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IssueList } from "@/features/issues/components/issue-list";
import { SprintDialog } from "@/features/sprints/components/sprint-dialog";
import {
  formatDateRange,
  sprintCompletion,
  sprintDaysLeft,
  sprintState,
} from "@/lib/helpers";
import { useAppStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui-store";

export function SprintDetail({ id }: { id: string }) {
  const router = useRouter();
  const sprints = useAppStore((s) => s.sprints);
  const issues = useAppStore((s) => s.issues);
  const deleteSprint = useAppStore((s) => s.deleteSprint);
  const openNewIssue = useUiStore((s) => s.openNewIssue);
  const [editOpen, setEditOpen] = useState(false);

  const sprint = sprints.find((sp) => sp.id === id);

  if (!sprint) {
    return (
      <>
        <PanelHeader left={<span>Sprints</span>} />
        <EmptyState
          icon={RefreshCcw}
          title="Sprint not found"
          description="It may have been deleted."
          action={
            <Button variant="outline" size="xs" asChild>
              <Link href="/sprints">Back to sprints</Link>
            </Button>
          }
        />
      </>
    );
  }

  const sprintIssues = issues.filter((i) => i.sprintId === sprint.id);
  const active = sprintState(sprint) === "active";
  const total = sprintIssues.length;
  const started = sprintIssues.filter(
    (i) => i.status === "in_progress" || i.status === "in_review"
  ).length;
  const completed = sprintIssues.filter((i) => i.status === "done").length;
  const completion = sprintCompletion(sprintIssues);
  const daysLeft = sprintDaysLeft(sprint);

  return (
    <>
      <PanelHeader
        left={
          <>
            <Link
              href="/sprints"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              Sprints
            </Link>
            <ChevronRight className="size-3 shrink-0 text-faint" strokeWidth={1.8} />
            <span className="truncate">{sprint.name}</span>
            {active ? (
              <span className="flex h-[22px] shrink-0 items-center rounded-full border border-input px-2 text-2xs text-muted-foreground">
                Active
              </span>
            ) : null}
          </>
        }
        right={
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Add issue"
              onClick={() => openNewIssue({ sprintId: sprint.id })}
            >
              <Plus className="size-4 text-muted-foreground" strokeWidth={1.8} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label="Sprint options">
                  <Ellipsis className="size-4 text-muted-foreground" strokeWidth={1.8} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  Edit sprint
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    deleteSprint(sprint.id);
                    router.push("/sprints");
                  }}
                >
                  Delete sprint
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Summary strip */}
      <div className="flex items-center gap-6 border-b px-4 py-3">
        {sprint.goal ? (
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {sprint.goal}
          </span>
        ) : null}
        <div className="flex shrink-0 items-center gap-4 text-xs text-faint">
          <span className="whitespace-nowrap">
            {formatDateRange(sprint.startDate, sprint.endDate)}
          </span>
          {active ? (
            <span className="whitespace-nowrap">
              {daysLeft} {daysLeft === 1 ? "day" : "days"} left
            </span>
          ) : null}
          <span className="whitespace-nowrap">
            {total} {total === 1 ? "issue" : "issues"}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <StatusIcon status="in_progress" className="size-3" />
            {started} started
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <StatusIcon status="done" className="size-3" />
            {completed} completed
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${completion}%` }}
              />
            </span>
            <span className="text-muted-foreground">{completion}%</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sprintIssues.length === 0 ? (
          <EmptyState
            icon={RefreshCcw}
            title="No issues in this sprint"
            description="Add issues to plan this sprint's scope."
            action={
              <Button size="xs" onClick={() => openNewIssue({ sprintId: sprint.id })}>
                Add issue
              </Button>
            }
          />
        ) : (
          <IssueList issues={sprintIssues} grouping="status" />
        )}
      </div>

      <SprintDialog open={editOpen} onOpenChange={setEditOpen} sprint={sprint} />
    </>
  );
}
