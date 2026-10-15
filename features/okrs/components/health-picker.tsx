"use client";

import { useState } from "react";
import { HealthIcon } from "@/components/icons/health-icon";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HEALTH, healthLabel } from "@/lib/types";
import type { OkrHealth } from "@/lib/types";

/** Property pill for OKR health, same recipe as the issue pickers. */
export function HealthPicker({
  value,
  onChange,
}: {
  value: OkrHealth;
  onChange: (v: OkrHealth) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs">
          <HealthIcon health={value} />
          {healthLabel(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {HEALTH.map((h) => (
                <CommandItem
                  key={h.id}
                  data-checked={value === h.id}
                  onSelect={() => {
                    onChange(h.id);
                    setOpen(false);
                  }}
                >
                  <HealthIcon health={h.id} />
                  {h.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
