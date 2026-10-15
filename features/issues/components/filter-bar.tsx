"use client";

import { ListFilter, X } from "lucide-react";
import { PriorityIcon } from "@/components/icons/priority-icon";
import { StatusIcon } from "@/components/icons/status-icon";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { IssueFilters } from "@/features/issues/hooks/use-issue-filters";
import { useAppStore } from "@/lib/store";
import {
  PRIORITIES,
  STATUSES,
  priorityLabel,
  statusLabel,
} from "@/lib/types";

/*
  Toolbar under the panel header: a Filter menu with one submenu per
  dimension, plus removable chips for every active filter value.
  Controlled: state lives in useIssueFilters on the page.
*/

const toggled = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

function FilterChip({
  glyph,
  name,
  onClear,
}: {
  glyph: React.ReactNode;
  name: string;
  onClear: () => void;
}) {
  return (
    <span className="flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-input px-2 text-xs text-muted-foreground">
      {glyph}
      {name}
      <button
        type="button"
        aria-label={`Clear ${name} filter`}
        onClick={onClear}
        className="text-faint hover:text-foreground"
      >
        <X className="size-3" strokeWidth={1.8} />
      </button>
    </span>
  );
}

export function FilterBar({
  filters,
  setFilters,
}: {
  filters: IssueFilters;
  setFilters: React.Dispatch<React.SetStateAction<IssueFilters>>;
}) {
  const members = useAppStore((s) => s.members);
  const labels = useAppStore((s) => s.labels);

  const memberName = (id: string | null) =>
    id === null ? "Unassigned" : members.find((m) => m.id === id)?.name ?? "Unknown";

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="xs">
            <ListFilter className="size-4 text-muted-foreground" strokeWidth={1.8} />
            Filter
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              {STATUSES.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s.id}
                  checked={filters.status.includes(s.id)}
                  onCheckedChange={() =>
                    setFilters((f) => ({ ...f, status: toggled(f.status, s.id) }))
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  <StatusIcon status={s.id} />
                  {s.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Priority</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              {PRIORITIES.map((p) => (
                <DropdownMenuCheckboxItem
                  key={p.id}
                  checked={filters.priority.includes(p.id)}
                  onCheckedChange={() =>
                    setFilters((f) => ({ ...f, priority: toggled(f.priority, p.id) }))
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  <PriorityIcon priority={p.id} />
                  {p.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Assignee</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              {members.map((m) => (
                <DropdownMenuCheckboxItem
                  key={m.id}
                  checked={filters.assigneeIds.includes(m.id)}
                  onCheckedChange={() =>
                    setFilters((f) => ({ ...f, assigneeIds: toggled(f.assigneeIds, m.id) }))
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  <MemberAvatar member={m} size="sm" />
                  {m.name}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuCheckboxItem
                checked={filters.assigneeIds.includes(null)}
                onCheckedChange={() =>
                  setFilters((f) => ({ ...f, assigneeIds: toggled(f.assigneeIds, null) }))
                }
                onSelect={(e) => e.preventDefault()}
              >
                <MemberAvatar member={null} size="sm" />
                Unassigned
              </DropdownMenuCheckboxItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Label</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              {labels.map((l) => (
                <DropdownMenuCheckboxItem
                  key={l.id}
                  checked={filters.labelIds.includes(l.id)}
                  onCheckedChange={() =>
                    setFilters((f) => ({ ...f, labelIds: toggled(f.labelIds, l.id) }))
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      {filters.status.map((s) => (
        <FilterChip
          key={s}
          glyph={<StatusIcon status={s} />}
          name={statusLabel(s)}
          onClear={() => setFilters((f) => ({ ...f, status: f.status.filter((v) => v !== s) }))}
        />
      ))}
      {filters.priority.map((p) => (
        <FilterChip
          key={p}
          glyph={<PriorityIcon priority={p} className="size-3.5" />}
          name={priorityLabel(p)}
          onClear={() =>
            setFilters((f) => ({ ...f, priority: f.priority.filter((v) => v !== p) }))
          }
        />
      ))}
      {filters.assigneeIds.map((id) => (
        <FilterChip
          key={id ?? "unassigned"}
          glyph={
            <MemberAvatar
              member={id === null ? null : members.find((m) => m.id === id) ?? null}
              size="sm"
              className="size-3.5 text-[8px]"
            />
          }
          name={memberName(id)}
          onClear={() =>
            setFilters((f) => ({ ...f, assigneeIds: f.assigneeIds.filter((v) => v !== id) }))
          }
        />
      ))}
      {filters.labelIds.map((id) => {
        const label = labels.find((l) => l.id === id);
        if (!label) return null;
        return (
          <FilterChip
            key={id}
            glyph={
              <span className="size-2 rounded-full" style={{ backgroundColor: label.color }} />
            }
            name={label.name}
            onClear={() =>
              setFilters((f) => ({ ...f, labelIds: f.labelIds.filter((v) => v !== id) }))
            }
          />
        );
      })}
    </div>
  );
}
