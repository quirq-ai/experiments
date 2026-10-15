"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { StatusIcon } from "@/components/icons/status-icon";
import { PanelHeader } from "@/components/shell/panel-header";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { sprintState } from "@/lib/helpers";
import { useAppStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui-store";
import type { OkrHealth } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
  Month calendar: sprint spans as continuous strips, OKR target dates and
  issue due dates as chips. Clicking an empty area of a day opens the
  new-issue modal prefilled with that due date.
*/

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const HEALTH_TEXT: Record<OkrHealth, string> = {
  on_track: "text-health-on-track",
  at_risk: "text-health-at-risk",
  off_track: "text-health-off-track",
};

const MAX_ITEMS = 3;

export function CalendarView() {
  const sprints = useAppStore((s) => s.sprints);
  const objectives = useAppStore((s) => s.objectives);
  const issues = useAppStore((s) => s.issues);
  const teamKey = useAppStore((s) => s.workspace.teamKey);
  const openNewIssue = useUiStore((s) => s.openNewIssue);

  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const monthKey = format(month, "yyyy-MM");
  const todayIso = format(new Date(), "yyyy-MM-dd");

  return (
    <>
      <PanelHeader
        left="Calendar"
        right={
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Previous month"
              onClick={() => setMonth((m) => addMonths(m, -1))}
            >
              <ChevronLeft className="size-4 text-muted-foreground" strokeWidth={1.8} />
            </Button>
            <span className="min-w-28 text-center text-sm font-medium">
              {format(month, "MMMM yyyy")}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Next month"
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.8} />
            </Button>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Button
              variant="outline"
              size="xs"
              onClick={() => setMonth(startOfMonth(new Date()))}
            >
              Today
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Weekday header */}
        <div className="grid shrink-0 grid-cols-7 border-b">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-1.5 text-right text-2xs text-faint">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="grid flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
          {days.map((day, idx) => {
            const iso = format(day, "yyyy-MM-dd");
            const inMonth = format(day, "yyyy-MM") === monthKey;
            const isToday = iso === todayIso;
            const col = idx % 7;

            const daySprints = sprints.filter(
              (sp) => sp.startDate <= iso && iso <= sp.endDate
            );
            const dayObjectives = objectives.filter((o) => o.targetDate === iso);
            const dayIssues = issues.filter((i) => i.dueDate === iso);

            const items: ReactNode[] = [
              ...daySprints.map((sp) => {
                const isStart = sp.startDate === iso;
                const isEnd = sp.endDate === iso;
                const showName = isStart || col === 0;
                const active = sprintState(sp) === "active";
                return (
                  <Link
                    key={`sprint-${sp.id}`}
                    href={`/sprints/${sp.id}`}
                    title={sp.name}
                    className={cn(
                      "flex h-[18px] shrink-0 items-center truncate px-1.5 text-2xs text-primary",
                      active ? "bg-primary/25" : "bg-primary/15",
                      isStart ? "rounded-l" : "-ml-1.5",
                      isEnd ? "rounded-r" : "-mr-1.5"
                    )}
                  >
                    {showName ? sp.name : null}
                  </Link>
                );
              }),
              ...dayObjectives.map((o) => (
                <Link
                  key={`okr-${o.id}`}
                  href={`/okrs/${o.id}`}
                  title={o.name}
                  className="flex h-[18px] shrink-0 items-center gap-1 truncate rounded px-1 text-2xs hover:bg-accent"
                >
                  <Target
                    className={cn("size-3 shrink-0", HEALTH_TEXT[o.health])}
                    strokeWidth={1.8}
                  />
                  <span className="truncate">{o.name}</span>
                </Link>
              )),
              ...dayIssues.map((i) => (
                <Link
                  key={`issue-${i.id}`}
                  href={`/issue/${teamKey}-${i.number}`}
                  title={i.title}
                  className="flex h-[18px] shrink-0 items-center gap-1 truncate rounded px-1 text-2xs hover:bg-accent"
                >
                  <StatusIcon status={i.status} className="size-3" />
                  <span className="shrink-0 text-faint">
                    {teamKey}-{i.number}
                  </span>
                  <span className="truncate">{i.title}</span>
                </Link>
              )),
            ];

            const visible = items.slice(0, MAX_ITEMS);
            const overflow = items.length - visible.length;

            return (
              <div
                key={iso}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a")) return;
                  openNewIssue({ dueDate: iso });
                }}
                className={cn(
                  "flex min-h-24 cursor-default flex-col gap-1 overflow-hidden border-b border-r p-1.5",
                  col === 6 && "border-r-0"
                )}
              >
                <span
                  className={cn(
                    "self-end text-xs",
                    isToday
                      ? "flex size-5 items-center justify-center rounded-full bg-primary text-white"
                      : inMonth
                        ? "text-faint"
                        : "text-faint/50"
                  )}
                >
                  {format(day, "d")}
                </span>
                {visible}
                {overflow > 0 ? (
                  <span className="text-2xs text-faint">+{overflow} more</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
