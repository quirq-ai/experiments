"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Ellipsis, Plus, Target, X } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PanelHeader } from "@/components/shell/panel-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { IssueRow } from "@/features/issues/components/issue-row";
import { AssigneePicker, DueDatePicker } from "@/features/issues/components/pickers";
import { HealthPicker } from "@/features/okrs/components/health-picker";
import { KR_STATUS_BAR, KrStatusPicker } from "@/features/okrs/components/kr-status-picker";
import { KrValuePopover } from "@/features/okrs/components/kr-value-popover";
import { OkrActivity } from "@/features/okrs/components/okr-activity";
import { formatDate, krProgress, objectiveProgress } from "@/lib/helpers";
import { useAppStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui-store";
import type { KeyResult, OkrHealth } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEALTH_BAR: Record<OkrHealth, string> = {
  on_track: "bg-health-on-track",
  at_risk: "bg-health-at-risk",
  off_track: "bg-health-off-track",
};

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Full objective detail: editable header, key results, linked issues. */
export function OkrDetail({ id }: { id: string }) {
  const router = useRouter();
  const objectives = useAppStore((s) => s.objectives);
  const issues = useAppStore((s) => s.issues);
  const updateObjective = useAppStore((s) => s.updateObjective);
  const deleteObjective = useAppStore((s) => s.deleteObjective);
  const addKeyResult = useAppStore((s) => s.addKeyResult);
  const updateKeyResult = useAppStore((s) => s.updateKeyResult);
  const removeKeyResult = useAppStore((s) => s.removeKeyResult);
  const openNewIssue = useUiStore((s) => s.openNewIssue);

  const [adding, setAdding] = useState(false);
  const [krName, setKrName] = useState("");
  const [krCurrent, setKrCurrent] = useState("");
  const [krTarget, setKrTarget] = useState("");
  const [krUnit, setKrUnit] = useState("");

  const objective = objectives.find((o) => o.id === id);

  if (!objective) {
    return (
      <>
        <PanelHeader left={<span>OKRs</span>} />
        <EmptyState
          className="flex-1"
          icon={Target}
          title="Objective not found"
          description="It may have been deleted."
          action={
            <Button asChild variant="outline" size="xs">
              <Link href="/okrs">Back to OKRs</Link>
            </Button>
          }
        />
      </>
    );
  }

  const linkedIssues = issues.filter((i) => i.objectiveId === objective.id);
  const progress = objectiveProgress(objective);

  const commitTitle = (el: HTMLInputElement) => {
    const next = el.value.trim();
    if (!next) {
      el.value = objective.name;
      return;
    }
    if (next !== objective.name) updateObjective(objective.id, { name: next });
  };

  const commitDescription = (el: HTMLTextAreaElement) => {
    const next = el.value.trim();
    if (next !== (objective.description ?? "")) {
      updateObjective(objective.id, { description: next || undefined });
    }
  };

  const commitKrName = (kr: KeyResult, el: HTMLInputElement) => {
    const next = el.value.trim();
    if (!next) {
      el.value = kr.name;
      return;
    }
    if (next !== kr.name) updateKeyResult(objective.id, kr.id, { name: next });
  };

  const canAddKr = krName.trim() !== "" && krTarget.trim() !== "" && !Number.isNaN(Number(krTarget));

  const handleAddKr = () => {
    if (!canAddKr) return;
    addKeyResult(objective.id, {
      name: krName.trim(),
      current: Number(krCurrent) || 0,
      target: Number(krTarget),
      unit: krUnit.trim() || undefined,
    });
    setKrName("");
    setKrCurrent("");
    setKrTarget("");
    setKrUnit("");
    setAdding(false);
  };

  return (
    <>
      <PanelHeader
        left={
          <>
            <Link href="/okrs" className="shrink-0 text-muted-foreground hover:text-foreground">
              OKRs
            </Link>
            <ChevronRight className="size-3 shrink-0 text-faint" strokeWidth={1.8} />
            <span className="truncate">{objective.name}</span>
          </>
        }
        right={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Objective options">
                <Ellipsis className="size-4 text-muted-foreground" strokeWidth={1.8} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  deleteObjective(objective.id);
                  router.push("/okrs");
                }}
              >
                Delete objective
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* Main column */}
        <div className="min-w-0 max-w-3xl flex-1 overflow-y-auto px-8 py-6">
          <input
            key={objective.id}
            defaultValue={objective.name}
            onBlur={(e) => commitTitle(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className="w-full border-none bg-transparent text-lg font-semibold text-foreground outline-none placeholder:text-faint"
            placeholder="Objective name"
            aria-label="Objective name"
          />
          <textarea
            key={`${objective.id}-description`}
            defaultValue={objective.description ?? ""}
            onBlur={(e) => commitDescription(e.currentTarget)}
            className="mt-1 w-full field-sizing-content resize-none border-none bg-transparent text-sm text-muted-foreground outline-none placeholder:text-faint"
            placeholder="What does success look like?"
            aria-label="Objective description"
          />

          {/* Score */}
          <div className="mt-5 flex items-center gap-3">
            <span className="shrink-0 text-base font-semibold tabular-nums text-foreground">
              {progress}%
            </span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <span
                className={cn("block h-full rounded-full", HEALTH_BAR[objective.health])}
                style={{ width: `${progress}%` }}
              />
            </span>
            <span className="shrink-0 text-xs text-faint">
              average of {objective.keyResults.length}{" "}
              {objective.keyResults.length === 1 ? "key result" : "key results"}
            </span>
          </div>

          {/* Key results */}
          <div className="mt-8">
            <div className="text-sm font-medium text-foreground">Key results</div>
            <div className="mt-1">
              {objective.keyResults.map((kr) => (
                <div key={kr.id} className="group flex h-10 items-center gap-2">
                  <KrStatusPicker
                    value={kr.status}
                    onChange={(status) => updateKeyResult(objective.id, kr.id, { status })}
                  />
                  <input
                    defaultValue={kr.name}
                    onBlur={(e) => commitKrName(kr, e.currentTarget)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    className={cn(
                      "min-w-0 flex-1 border-none bg-transparent text-sm outline-none placeholder:text-faint",
                      kr.status === "done"
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    )}
                    aria-label={`Name of ${kr.name}`}
                  />
                  <span className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-white/10">
                    <span
                      className={cn("block h-full rounded-full", KR_STATUS_BAR[kr.status])}
                      style={{ width: `${krProgress(kr)}%` }}
                    />
                  </span>
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {krProgress(kr)}%
                  </span>
                  <KrValuePopover
                    kr={kr}
                    onCommit={(value) => updateKeyResult(objective.id, kr.id, { current: value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${kr.name}`}
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => removeKeyResult(objective.id, kr.id)}
                  >
                    <X className="size-3.5 text-muted-foreground" strokeWidth={1.8} />
                  </Button>
                </div>
              ))}

              {adding ? (
                <div className="flex h-10 items-center gap-2">
                  <Input
                    autoFocus
                    value={krName}
                    onChange={(e) => setKrName(e.target.value)}
                    placeholder="Key result name"
                    aria-label="Key result name"
                    className="h-7 flex-1 text-xs md:text-xs"
                  />
                  <Input
                    value={krCurrent}
                    onChange={(e) => setKrCurrent(e.target.value)}
                    placeholder="Current"
                    aria-label="Current value"
                    className="h-7 w-14 px-1.5 text-xs md:text-xs"
                  />
                  <Input
                    value={krTarget}
                    onChange={(e) => setKrTarget(e.target.value)}
                    placeholder="Target"
                    aria-label="Target value"
                    className="h-7 w-14 px-1.5 text-xs md:text-xs"
                  />
                  <Input
                    value={krUnit}
                    onChange={(e) => setKrUnit(e.target.value)}
                    placeholder="Unit"
                    aria-label="Unit"
                    className="h-7 w-12 px-1.5 text-xs md:text-xs"
                  />
                  <Button size="xs" disabled={!canAddKr} onClick={handleAddKr}>
                    Add
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="flex h-8 items-center text-sm text-faint hover:text-foreground"
                >
                  + Add key result
                </button>
              )}
            </div>
          </div>

          {/* Linked issues */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-foreground">Issues</div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="New issue for this objective"
                onClick={() => openNewIssue({ objectiveId: objective.id })}
              >
                <Plus className="size-4 text-muted-foreground" strokeWidth={1.8} />
              </Button>
            </div>
            {linkedIssues.length === 0 ? (
              <div className="mt-1 text-xs text-faint">No issues linked yet.</div>
            ) : (
              <div className="-mx-4 mt-1">
                {linkedIssues.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Properties sidebar */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l px-4 py-4">
          <div className="text-2xs font-medium text-faint">Properties</div>
          <div className="mt-3 flex flex-col gap-2.5">
            <PropertyRow label="Owner">
              <AssigneePicker
                value={objective.ownerId}
                onChange={(v: string | null) => {
                  if (v) updateObjective(objective.id, { ownerId: v });
                }}
                placeholder="Owner"
              />
            </PropertyRow>
            <PropertyRow label="Health">
              <HealthPicker
                value={objective.health}
                onChange={(v) => updateObjective(objective.id, { health: v })}
              />
            </PropertyRow>
            <PropertyRow label="Target date">
              <DueDatePicker
                value={objective.targetDate}
                onChange={(v: string | null) => {
                  if (v) updateObjective(objective.id, { targetDate: v });
                }}
                placeholder="Target date"
              />
            </PropertyRow>
          </div>
          <div className="mt-4 text-xs text-faint">
            Created {formatDate(objective.createdAt)}
          </div>

          <div className="mt-6 border-t pt-4">
            <div className="text-2xs font-medium text-faint">Activity</div>
            <OkrActivity objective={objective} />
          </div>
        </aside>
      </div>
    </>
  );
}
