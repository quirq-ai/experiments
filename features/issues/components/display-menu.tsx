"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* View display options: which dimension the issue list groups by. */

export type IssueGrouping = "status" | "priority" | "assignee" | "sprint";

const GROUPINGS: { id: IssueGrouping; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "priority", label: "Priority" },
  { id: "assignee", label: "Assignee" },
  { id: "sprint", label: "Sprint" },
];

export function DisplayMenu({
  grouping,
  onGroupingChange,
}: {
  grouping: IssueGrouping;
  onGroupingChange: (grouping: IssueGrouping) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs">
          <SlidersHorizontal className="size-4 text-muted-foreground" strokeWidth={1.8} />
          Display
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Grouping</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={grouping}
          onValueChange={(value) => onGroupingChange(value as IssueGrouping)}
        >
          {GROUPINGS.map((g) => (
            <DropdownMenuRadioItem key={g.id} value={g.id}>
              {g.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
