"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KR_STATUSES, krStatusLabel } from "@/lib/types";
import type { KrStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const KR_STATUS_DOT: Record<KrStatus, string> = {
  on_track: "bg-health-on-track",
  at_risk: "bg-health-at-risk",
  off_track: "bg-health-off-track",
  done: "bg-status-done",
};

export const KR_STATUS_BAR = KR_STATUS_DOT;

/**
 * Compact status control for one key result: a colored dot that opens the
 * usual picker popover. Dot only, so it fits the dense KR row.
 */
export function KrStatusPicker({
  value,
  onChange,
}: {
  value: KrStatus;
  onChange: (v: KrStatus) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={`Status: ${krStatusLabel(value)}`}>
              <span className={cn("size-2.5 rounded-full", KR_STATUS_DOT[value])} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{krStatusLabel(value)}</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-44 p-0">
        <Command>
          <CommandList>
            <CommandGroup>
              {KR_STATUSES.map((status) => (
                <CommandItem
                  key={status.id}
                  value={status.label}
                  data-checked={status.id === value}
                  onSelect={() => {
                    onChange(status.id);
                    setOpen(false);
                  }}
                >
                  <span className={cn("size-2.5 rounded-full", KR_STATUS_DOT[status.id])} />
                  <span>{status.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
