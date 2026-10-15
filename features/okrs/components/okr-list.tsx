"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import { HealthIcon } from "@/components/icons/health-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Button } from "@/components/ui/button";
import { formatDate, objectiveProgress } from "@/lib/helpers";
import { useAppStore } from "@/lib/store";
import { healthLabel } from "@/lib/types";
import type { OkrHealth } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEALTH_BAR: Record<OkrHealth, string> = {
  on_track: "bg-health-on-track",
  at_risk: "bg-health-at-risk",
  off_track: "bg-health-off-track",
};

/** One row per objective, linking to its detail page. */
export function OkrList({ onNewObjective }: { onNewObjective: () => void }) {
  const objectives = useAppStore((s) => s.objectives);
  const members = useAppStore((s) => s.members);

  if (objectives.length === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={Target}
        title="No objectives yet"
        description="Objectives track the outcomes your team is working toward."
        action={
          <Button size="xs" onClick={onNewObjective}>
            New objective
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {objectives.map((objective) => {
        const owner = members.find((m) => m.id === objective.ownerId) ?? null;
        const progress = objectiveProgress(objective);
        const krCount = objective.keyResults.length;
        return (
          <Link
            key={objective.id}
            href={`/okrs/${objective.id}`}
            className="flex h-12 items-center gap-3 px-4 hover:bg-accent"
          >
            <Target className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {objective.name}
            </span>
            <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <HealthIcon health={objective.health} />
              {healthLabel(objective.health)}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
                <span
                  className={cn("block h-full rounded-full", HEALTH_BAR[objective.health])}
                  style={{ width: `${progress}%` }}
                />
              </span>
              <span className="w-8 text-right text-xs text-muted-foreground">{progress}%</span>
            </span>
            <span className="hidden shrink-0 text-xs text-faint md:block">
              {krCount} {krCount === 1 ? "KR" : "KRs"}
            </span>
            <span className="hidden shrink-0 text-xs text-faint md:block">
              {formatDate(objective.targetDate)}
            </span>
            <MemberAvatar member={owner} size="sm" />
          </Link>
        );
      })}
    </div>
  );
}
