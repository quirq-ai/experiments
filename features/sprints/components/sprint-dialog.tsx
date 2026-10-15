"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DueDatePicker } from "@/features/issues/components/pickers";
import { useAppStore } from "@/lib/store";
import type { Sprint } from "@/lib/types";

/*
  Create and edit dialog for sprints. Pass `sprint` to edit; omit to create.
  Sprint names are auto-assigned by the store (Sprint N), so the form only
  asks for a goal and the date range.
*/
export function SprintDialog({
  open,
  onOpenChange,
  sprint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint?: Sprint;
}) {
  const createSprint = useAppStore((s) => s.createSprint);
  const updateSprint = useAppStore((s) => s.updateSprint);

  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Re-seed the form during render each time the dialog opens
  // (create: blank, edit: sprint).
  const [prev, setPrev] = useState({ open, sprint });
  if (prev.open !== open || prev.sprint !== sprint) {
    setPrev({ open, sprint });
    if (open) {
      setGoal(sprint?.goal ?? "");
      setStartDate(sprint?.startDate ?? null);
      setEndDate(sprint?.endDate ?? null);
    }
  }

  const valid = Boolean(startDate && endDate && startDate < endDate);

  const submit = () => {
    if (!startDate || !endDate) return;
    const trimmedGoal = goal.trim();
    if (sprint) {
      updateSprint(sprint.id, { goal: trimmedGoal || undefined, startDate, endDate });
    } else {
      createSprint({ startDate, endDate, goal: trimmedGoal || undefined });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[18%] translate-y-0 gap-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            {sprint ? "Edit sprint" : "New sprint"}
          </DialogTitle>
        </DialogHeader>
        <Input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Sprint goal (optional)"
        />
        <div className="flex items-center gap-2">
          <DueDatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
          <DueDatePicker value={endDate} onChange={setEndDate} placeholder="End date" />
        </div>
        <DialogFooter>
          <Button size="xs" disabled={!valid} onClick={submit}>
            {sprint ? "Save" : "Create sprint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
