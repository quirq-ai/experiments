"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AssigneePicker, DueDatePicker } from "@/features/issues/components/pickers";
import { HealthPicker } from "@/features/okrs/components/health-picker";
import { useAppStore } from "@/lib/store";
import type { OkrHealth } from "@/lib/types";

/** Top-aligned Linear-style dialog for creating an objective. */
export function NewObjectiveDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const currentMemberId = useAppStore((s) => s.currentMemberId);
  const createObjective = useAppStore((s) => s.createObjective);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(currentMemberId);
  const [health, setHealth] = useState<OkrHealth>("on_track");
  const [targetDate, setTargetDate] = useState<string | null>(null);

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setName("");
      setDescription("");
      setOwnerId(currentMemberId);
      setHealth("on_track");
      setTargetDate(null);
    }
  };

  const handleCreate = () => {
    if (!name.trim() || !targetDate) return;
    const objective = createObjective({
      name: name.trim(),
      description: description.trim() || undefined,
      ownerId: ownerId ?? currentMemberId,
      health,
      targetDate,
    });
    handleOpenChange(false);
    router.push(`/okrs/${objective.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="top-[18%] translate-y-0 gap-0 p-0 sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogTitle className="px-4 pt-4 text-sm">New objective</DialogTitle>
        <div className="flex flex-col px-4 pt-3">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Objective name"
            className="h-8 rounded-none border-none bg-transparent px-0 text-base font-medium shadow-none focus-visible:ring-0 dark:bg-transparent md:text-base"
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does success look like?"
            className="min-h-14 resize-none rounded-none border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-1 pb-3">
          <AssigneePicker value={ownerId} onChange={setOwnerId} placeholder="Owner" />
          <HealthPicker value={health} onChange={setHealth} />
          <DueDatePicker value={targetDate} onChange={setTargetDate} placeholder="Target date" />
        </div>
        <div className="flex items-center justify-end border-t px-4 py-3">
          <Button size="xs" disabled={!name.trim() || !targetDate} onClick={handleCreate}>
            Create objective
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
