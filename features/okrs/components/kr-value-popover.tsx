"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { krProgress } from "@/lib/helpers";
import type { KeyResult } from "@/lib/types";

/*
  Friendly score editor for one key result: the value chip opens a popover
  with a numeric input and a slider bound to the same draft. Commit on
  Update or Enter; nothing is written while dragging.
*/

function sliderScale(kr: KeyResult): { min: number; max: number; step: number } {
  // Include 0 and both values so negative-range KRs stay editable
  const min = Math.min(0, kr.target, kr.current);
  const max = Math.max(kr.target, kr.current, min + 1);
  const span = max - min;
  const step = span <= 10 ? 0.1 : span <= 100 ? 1 : Math.ceil(span / 200);
  return { min, max, step };
}

export function KrValuePopover({
  kr,
  onCommit,
}: {
  kr: KeyResult;
  onCommit: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(kr.current));
  const { min, max, step } = sliderScale(kr);

  const parsed = Number(draft);
  const valid = draft.trim() !== "" && !Number.isNaN(parsed);
  const preview = valid ? krProgress({ ...kr, current: parsed }) : null;
  const unit = kr.unit ? ` ${kr.unit}` : "";

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) setDraft(String(kr.current));
  };

  const commit = () => {
    if (!valid) return;
    if (parsed !== kr.current) onCommit(parsed);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs tabular-nums text-foreground hover:bg-accent"
          aria-label={`Update value for ${kr.name}`}
        >
          {kr.current}
          <span className="text-faint">
            / {kr.target}
            {unit}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-3">
        <div className="text-2xs font-medium text-faint">Update value</div>
        <div className="mt-2 flex items-center gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
            inputMode="decimal"
            className="h-7 w-24 text-sm tabular-nums md:text-sm"
            aria-label="New value"
          />
          <span className="text-xs text-faint">
            of {kr.target}
            {unit}
          </span>
        </div>
        <Slider
          value={[valid ? Math.min(Math.max(parsed, min), max) : min]}
          onValueChange={([v]) => setDraft(String(v))}
          min={min}
          max={max}
          step={step}
          className="mt-3"
          aria-label="New value slider"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {!valid
              ? "Enter a number"
              : kr.status === "done"
                ? "Scores 100% while done"
                : `${preview}% of target`}
          </span>
          <Button size="xs" disabled={!valid} onClick={commit}>
            Update
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
