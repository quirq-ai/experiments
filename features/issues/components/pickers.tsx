"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Gauge, RefreshCcw, Tag, Target, X } from "lucide-react";
import { PriorityIcon } from "@/components/icons/priority-icon";
import { StatusIcon } from "@/components/icons/status-icon";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/helpers";
import { useAppStore } from "@/lib/store";
import {
  ESTIMATES,
  PRIORITIES,
  STATUSES,
  priorityLabel,
  statusLabel,
} from "@/lib/types";
import type { IssueStatus, Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
  Property pickers shared by the new-issue modal, the issue detail sidebar,
  and toolbars. Each renders a property pill (outline xs button) that opens
  a Popover + Command list; the selected item shows a check.
*/

function PickerPopover({
  open,
  onOpenChange,
  trigger,
  placeholder,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {children}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const ITEM = "h-8";
const UNSET = "text-muted-foreground";

export function StatusPicker({
  value,
  onChange,
}: {
  value: IssueStatus;
  onChange: (v: IssueStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <PickerPopover
      open={open}
      onOpenChange={setOpen}
      placeholder="Change status..."
      trigger={
        <Button variant="outline" size="xs">
          <StatusIcon status={value} />
          {statusLabel(value)}
        </Button>
      }
    >
      {STATUSES.map((s) => (
        <CommandItem
          key={s.id}
          value={s.label}
          data-checked={s.id === value}
          className={ITEM}
          onSelect={() => {
            onChange(s.id);
            setOpen(false);
          }}
        >
          <StatusIcon status={s.id} />
          {s.label}
        </CommandItem>
      ))}
    </PickerPopover>
  );
}

export function PriorityPicker({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (v: Priority) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <PickerPopover
      open={open}
      onOpenChange={setOpen}
      placeholder="Change priority..."
      trigger={
        <Button variant="outline" size="xs">
          <PriorityIcon priority={value} className="size-3.5" />
          <span className={cn(value === "none" && UNSET)}>
            {value === "none" ? "Priority" : priorityLabel(value)}
          </span>
        </Button>
      }
    >
      {PRIORITIES.map((p) => (
        <CommandItem
          key={p.id}
          value={p.label}
          data-checked={p.id === value}
          className={ITEM}
          onSelect={() => {
            onChange(p.id);
            setOpen(false);
          }}
        >
          <PriorityIcon priority={p.id} className="size-3.5" />
          {p.label}
        </CommandItem>
      ))}
    </PickerPopover>
  );
}

export function AssigneePicker({
  value,
  onChange,
  placeholder = "Assignee",
}: {
  value?: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const members = useAppStore((s) => s.members);
  const [open, setOpen] = useState(false);
  const member = members.find((m) => m.id === value) ?? null;
  return (
    <PickerPopover
      open={open}
      onOpenChange={setOpen}
      placeholder="Assign to..."
      trigger={
        <Button variant="outline" size="xs">
          <MemberAvatar member={member} size="sm" className="size-3.5 text-[7px]" />
          <span className={cn(!member && UNSET)}>{member ? member.name : placeholder}</span>
        </Button>
      }
    >
      <CommandItem
        value="No assignee"
        data-checked={!member}
        className={ITEM}
        onSelect={() => {
          onChange(null);
          setOpen(false);
        }}
      >
        <MemberAvatar member={null} size="sm" className="size-3.5" />
        No assignee
      </CommandItem>
      {members.map((m) => (
        <CommandItem
          key={m.id}
          value={m.name}
          data-checked={m.id === value}
          className={ITEM}
          onSelect={() => {
            onChange(m.id);
            setOpen(false);
          }}
        >
          <MemberAvatar member={m} size="sm" className="size-3.5 text-[7px]" />
          {m.name}
        </CommandItem>
      ))}
    </PickerPopover>
  );
}

export function LabelPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const labels = useAppStore((s) => s.labels);
  const [open, setOpen] = useState(false);
  const selected = labels.filter((l) => value.includes(l.id));
  const first = selected[0];

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <PickerPopover
      open={open}
      onOpenChange={setOpen}
      placeholder="Change labels..."
      trigger={
        <Button variant="outline" size="xs">
          {first ? (
            <span className="size-2 rounded-full" style={{ backgroundColor: first.color }} />
          ) : (
            <Tag className="text-muted-foreground" strokeWidth={1.8} />
          )}
          <span className={cn(!first && UNSET)}>
            {first ? first.name : "Label"}
            {selected.length > 1 ? ` +${selected.length - 1}` : ""}
          </span>
        </Button>
      }
    >
      {labels.map((l) => (
        <CommandItem
          key={l.id}
          value={l.name}
          data-checked={value.includes(l.id)}
          className={ITEM}
          onSelect={() => toggle(l.id)}
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
          {l.name}
        </CommandItem>
      ))}
    </PickerPopover>
  );
}

export function SprintPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (v: string | null) => void;
}) {
  const sprints = useAppStore((s) => s.sprints);
  const [open, setOpen] = useState(false);
  const sprint = sprints.find((s) => s.id === value) ?? null;
  return (
    <PickerPopover
      open={open}
      onOpenChange={setOpen}
      placeholder="Change sprint..."
      trigger={
        <Button variant="outline" size="xs">
          <RefreshCcw className="text-muted-foreground" strokeWidth={1.8} />
          <span className={cn(!sprint && UNSET)}>{sprint ? sprint.name : "Sprint"}</span>
        </Button>
      }
    >
      <CommandItem
        value="No sprint"
        data-checked={!sprint}
        className={ITEM}
        onSelect={() => {
          onChange(null);
          setOpen(false);
        }}
      >
        <RefreshCcw className="text-muted-foreground" strokeWidth={1.8} />
        No sprint
      </CommandItem>
      {sprints.map((s) => (
        <CommandItem
          key={s.id}
          value={s.name}
          data-checked={s.id === value}
          className={ITEM}
          onSelect={() => {
            onChange(s.id);
            setOpen(false);
          }}
        >
          <RefreshCcw className="text-muted-foreground" strokeWidth={1.8} />
          {s.name}
        </CommandItem>
      ))}
    </PickerPopover>
  );
}

export function ObjectivePicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (v: string | null) => void;
}) {
  const objectives = useAppStore((s) => s.objectives);
  const [open, setOpen] = useState(false);
  const objective = objectives.find((o) => o.id === value) ?? null;
  return (
    <PickerPopover
      open={open}
      onOpenChange={setOpen}
      placeholder="Change objective..."
      trigger={
        <Button variant="outline" size="xs">
          <Target className="text-muted-foreground" strokeWidth={1.8} />
          <span className={cn("max-w-40 truncate", !objective && UNSET)}>
            {objective ? objective.name : "Objective"}
          </span>
        </Button>
      }
    >
      <CommandItem
        value="No objective"
        data-checked={!objective}
        className={ITEM}
        onSelect={() => {
          onChange(null);
          setOpen(false);
        }}
      >
        <Target className="text-muted-foreground" strokeWidth={1.8} />
        No objective
      </CommandItem>
      {objectives.map((o) => (
        <CommandItem
          key={o.id}
          value={o.name}
          data-checked={o.id === value}
          className={ITEM}
          onSelect={() => {
            onChange(o.id);
            setOpen(false);
          }}
        >
          <Target className="text-muted-foreground" strokeWidth={1.8} />
          <span className="truncate">{o.name}</span>
        </CommandItem>
      ))}
    </PickerPopover>
  );
}

export function EstimatePicker({
  value,
  onChange,
}: {
  value?: number | null;
  onChange: (v: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const set = value !== null && value !== undefined;
  return (
    <PickerPopover
      open={open}
      onOpenChange={setOpen}
      placeholder="Change estimate..."
      trigger={
        <Button variant="outline" size="xs">
          <Gauge className="text-muted-foreground" strokeWidth={1.8} />
          <span className={cn(!set && UNSET)}>{set ? value : "Estimate"}</span>
        </Button>
      }
    >
      <CommandItem
        value="No estimate"
        data-checked={!set}
        className={ITEM}
        onSelect={() => {
          onChange(null);
          setOpen(false);
        }}
      >
        <Gauge className="text-muted-foreground" strokeWidth={1.8} />
        No estimate
      </CommandItem>
      {ESTIMATES.map((n) => (
        <CommandItem
          key={n}
          value={`${n} points`}
          data-checked={n === value}
          className={ITEM}
          onSelect={() => {
            onChange(n);
            setOpen(false);
          }}
        >
          <Gauge className="text-muted-foreground" strokeWidth={1.8} />
          {n} {n === 1 ? "point" : "points"}
        </CommandItem>
      ))}
    </PickerPopover>
  );
}

export function DueDatePicker({
  value,
  onChange,
  placeholder = "Due date",
}: {
  value?: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs">
          <CalendarDays className="text-muted-foreground" strokeWidth={1.8} />
          <span className={cn(!value && UNSET)}>{value ? formatDate(value) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? parseISO(value) : undefined}
          defaultMonth={value ? parseISO(value) : undefined}
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : null);
            setOpen(false);
          }}
        />
        <div className="border-t p-1">
          <button
            type="button"
            className="flex h-8 w-full cursor-default items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <X className="size-4 text-muted-foreground" strokeWidth={1.8} />
            Clear
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
