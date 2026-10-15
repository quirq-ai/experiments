"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  AssigneePicker,
  DueDatePicker,
  EstimatePicker,
  LabelPicker,
  ObjectivePicker,
  PriorityPicker,
  SprintPicker,
  StatusPicker,
} from "@/features/issues/components/pickers";
import { useAppStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui-store";
import type { IssueStatus, Priority } from "@/lib/types";

/*
  Global new-issue modal, mounted once in app/(app)/layout.tsx and driven
  through ui-store (openNewIssue accepts prefills like { sprintId }).
*/
export function NewIssueModal() {
  const open = useUiStore((s) => s.newIssueOpen);
  const defaults = useUiStore((s) => s.newIssueDefaults);
  const setOpen = useUiStore((s) => s.setNewIssueOpen);
  const createIssue = useAppStore((s) => s.createIssue);
  const teamName = useAppStore((s) => s.workspace.teamName);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<IssueStatus>("todo");
  const [priority, setPriority] = useState<Priority>("none");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [sprintId, setSprintId] = useState<string | null>(null);
  const [objectiveId, setObjectiveId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [createMore, setCreateMore] = useState(false);

  const resetDraft = useCallback(() => {
    setTitle(defaults.title ?? "");
    setDescription(defaults.description ?? "");
    setStatus(defaults.status ?? "todo");
    setPriority(defaults.priority ?? "none");
    setAssigneeId(defaults.assigneeId ?? null);
    setLabelIds(defaults.labelIds ?? []);
    setProjectId(defaults.projectId ?? null);
    setSprintId(defaults.sprintId ?? null);
    setObjectiveId(defaults.objectiveId ?? null);
    setEstimate(defaults.estimate ?? null);
    setDueDate(defaults.dueDate ?? null);
  }, [defaults]);

  // Re-seed the draft during render when the modal opens or defaults change.
  const [prev, setPrev] = useState({ open, defaults });
  if (prev.open !== open || prev.defaults !== defaults) {
    setPrev({ open, defaults });
    if (open) resetDraft();
  }

  const canCreate = title.trim().length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    createIssue({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      assigneeId,
      labelIds,
      projectId,
      sprintId,
      objectiveId,
      estimate,
      dueDate,
    });
    if (createMore) resetDraft();
    else setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="top-[18%] translate-y-0 gap-0 p-0 sm:max-w-xl"
        showCloseButton={false}
        aria-describedby={undefined}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleCreate();
          }
        }}
      >
        <DialogTitle className="sr-only">New issue</DialogTitle>

        <div className="flex items-center gap-2 px-4 pt-3">
          <span className="flex size-4 shrink-0 items-center justify-center rounded bg-primary text-[8.5px] font-bold text-white">
            {teamName[0]}
          </span>
          <span className="text-xs text-muted-foreground">New issue</span>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Issue title"
          className="w-full bg-transparent px-4 pt-2.5 pb-1 text-base font-medium text-foreground outline-none placeholder:text-muted-foreground"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add description..."
          className="min-h-16 w-full resize-none bg-transparent px-4 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />

        <div className="flex flex-wrap gap-1.5 px-4 pt-1 pb-3">
          <StatusPicker value={status} onChange={setStatus} />
          <PriorityPicker value={priority} onChange={setPriority} />
          <AssigneePicker value={assigneeId} onChange={setAssigneeId} />
          <LabelPicker value={labelIds} onChange={setLabelIds} />
          <SprintPicker value={sprintId} onChange={setSprintId} />
          <ObjectivePicker value={objectiveId} onChange={setObjectiveId} />
          <EstimatePicker value={estimate} onChange={setEstimate} />
          <DueDatePicker value={dueDate} onChange={setDueDate} />
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch size="sm" checked={createMore} onCheckedChange={setCreateMore} />
            Create more
          </label>
          <Button size="xs" onClick={handleCreate} disabled={!canCreate}>
            Create issue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
