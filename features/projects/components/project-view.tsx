"use client";

import { useState } from "react";
import Link from "next/link";
import { Box, CircleDashed, RefreshCcw } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PanelHeader } from "@/components/shell/panel-header";
import { Button } from "@/components/ui/button";
import { IssueList } from "@/features/issues/components/issue-list";
import { SprintDialog } from "@/features/sprints/components/sprint-dialog";
import { formatDateRange, sprintCompletion, sprintDaysLeft, sprintState } from "@/lib/helpers";
import { useAppStore } from "@/lib/store";
import type { Issue, Sprint } from "@/lib/types";
import { useUiStore } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

/*
  One project (a folder selected in Setup), split into two surfaces the
  sidebar links to directly: /project/[id]/work-items (the project's
  mirrored issues) and /project/[id]/sprints (every sprint, scoped to
  this project's issues and completion). Sprints are workspace wide;
  only the scoping is per project.
*/

export type ProjectViewKind = "work-items" | "sprints";

function ProjectSprintRow({ sprint, issues }: { sprint: Sprint; issues: Issue[] }) {
  const active = sprintState(sprint) === "active";
  const completion = sprintCompletion(issues);
  const daysLeft = sprintDaysLeft(sprint);

  return (
    <Link
      href={`/sprints/${sprint.id}`}
      className="flex h-12 items-center gap-3 px-4 hover:bg-accent"
    >
      <RefreshCcw
        strokeWidth={1.8}
        className={cn(
          "size-4 shrink-0",
          active ? "text-status-progress" : "text-muted-foreground"
        )}
      />
      <span className="shrink-0 text-sm font-medium text-foreground">{sprint.name}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {sprint.goal}
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <span className="hidden text-xs text-faint md:block">
          {formatDateRange(sprint.startDate, sprint.endDate)}
        </span>
        <span className="hidden text-xs text-faint sm:block">
          {issues.length} {issues.length === 1 ? "issue" : "issues"}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${completion}%` }}
            />
          </span>
          <span className="w-8 text-right text-xs text-muted-foreground">{completion}%</span>
        </span>
        {active ? (
          <span className="flex h-[22px] items-center rounded-full border border-input px-2 text-2xs text-muted-foreground">
            {daysLeft} {daysLeft === 1 ? "day" : "days"} left
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function ProjectView({
  projectId,
  view,
}: {
  projectId: string;
  view: ProjectViewKind;
}) {
  const projects = useAppStore((s) => s.projects);
  const issues = useAppStore((s) => s.issues);
  const sprints = useAppStore((s) => s.sprints);
  const openNewIssue = useUiStore((s) => s.openNewIssue);
  const [createSprintOpen, setCreateSprintOpen] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const projectIssues = issues.filter((i) => i.projectId === projectId);

  if (!project) {
    return (
      <>
        <PanelHeader left={<span>Project</span>} />
        <EmptyState
          icon={Box}
          title="Project not found"
          description="Pick a project in Setup, then sync to load its data."
        />
      </>
    );
  }

  const header = (
    <span className="flex items-center gap-2">
      <span
        className="size-2.5 shrink-0 rounded-[3px]"
        style={{ backgroundColor: project.color }}
      />
      <span>{project.name}</span>
      <span className="text-faint">/</span>
      <span className="text-muted-foreground">
        {view === "work-items" ? "Work items" : "Sprints"}
      </span>
      {view === "work-items" ? (
        <span className="text-xs text-faint">
          {projectIssues.length} {projectIssues.length === 1 ? "item" : "items"}
        </span>
      ) : null}
    </span>
  );

  if (view === "sprints") {
    return (
      <>
        <PanelHeader
          left={header}
          right={
            <Button size="xs" onClick={() => setCreateSprintOpen(true)}>
              New sprint
            </Button>
          }
        />
        <div className="flex-1 overflow-y-auto">
          {sprints.length === 0 ? (
            <EmptyState
              icon={RefreshCcw}
              title="No sprints"
              description="Create a sprint to plan a timeboxed batch of work."
              action={
                <Button variant="outline" size="xs" onClick={() => setCreateSprintOpen(true)}>
                  New sprint
                </Button>
              }
            />
          ) : (
            [...sprints]
              .sort((a, b) => a.number - b.number)
              .map((sprint) => (
                <ProjectSprintRow
                  key={sprint.id}
                  sprint={sprint}
                  issues={projectIssues.filter((i) => i.sprintId === sprint.id)}
                />
              ))
          )}
        </div>
        <SprintDialog open={createSprintOpen} onOpenChange={setCreateSprintOpen} />
      </>
    );
  }

  return (
    <>
      <PanelHeader
        left={header}
        right={
          <Button size="xs" onClick={() => openNewIssue({ projectId })}>
            New issue
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {projectIssues.length === 0 ? (
          <EmptyState
            icon={CircleDashed}
            title="No work items in this project"
            description="Work items load from this folder's .xo files on sync."
          />
        ) : (
          <IssueList issues={projectIssues} />
        )}
      </div>
    </>
  );
}
