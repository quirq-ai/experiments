"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PanelHeader } from "@/components/shell/panel-header";
import { Button } from "@/components/ui/button";
import { SprintDialog } from "@/features/sprints/components/sprint-dialog";
import {
  formatDateRange,
  sprintCompletion,
  sprintDaysLeft,
  sprintState,
} from "@/lib/helpers";
import { useAppStore } from "@/lib/store";
import type { Issue, Sprint } from "@/lib/types";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { state: "active", label: "Active" },
  { state: "upcoming", label: "Upcoming" },
  { state: "completed", label: "Completed" },
] as const;

function SprintRow({ sprint, issues }: { sprint: Sprint; issues: Issue[] }) {
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

export function SprintList() {
  const sprints = useAppStore((s) => s.sprints);
  const issues = useAppStore((s) => s.issues);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <PanelHeader
        left={<span>Sprints</span>}
        right={
          <Button size="xs" onClick={() => setCreateOpen(true)}>
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
              <Button variant="outline" size="xs" onClick={() => setCreateOpen(true)}>
                New sprint
              </Button>
            }
          />
        ) : (
          SECTIONS.map(({ state, label }) => {
            let group = sprints.filter((sp) => sprintState(sp) === state);
            if (state === "completed") group = group.slice().reverse();
            if (group.length === 0) return null;
            return (
              <section key={state}>
                <div className="flex h-9 items-center gap-2 bg-white/[0.03] px-4">
                  <RefreshCcw strokeWidth={1.8} className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <span className="text-sm text-muted-foreground">{group.length}</span>
                </div>
                {group.map((sprint) => (
                  <SprintRow
                    key={sprint.id}
                    sprint={sprint}
                    issues={issues.filter((i) => i.sprintId === sprint.id)}
                  />
                ))}
              </section>
            );
          })
        )}
      </div>

      <SprintDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
