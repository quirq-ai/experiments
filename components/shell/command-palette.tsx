"use client";

import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Calendar,
  CircleUser,
  FileText,
  Inbox,
  List,
  RefreshCcw,
  RotateCcw,
  Settings2,
  SquarePen,
  Target,
  Users,
} from "lucide-react";
import { StatusIcon } from "@/components/icons/status-icon";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { formatDateRange } from "@/lib/helpers";
import { useAppStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui-store";

/*
  Global Cmd+K palette, mounted once in app/(app)/layout.tsx and driven by
  ui-store (the Cmd+K binding lives in global-hotkeys.tsx). cmdk handles
  fuzzy filtering across every group; CommandList scrolls past 72 * 4px.
*/

const NAV_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Go to Inbox", href: "/inbox", icon: Inbox },
  { label: "Go to My Issues", href: "/my-issues", icon: CircleUser },
  { label: "Go to All issues", href: "/issues", icon: List },
  { label: "Go to OKRs", href: "/okrs", icon: Target },
  { label: "Go to Wiki", href: "/wiki", icon: BookOpen },
  { label: "Go to Sprints", href: "/sprints", icon: RefreshCcw },
  { label: "Go to Calendar", href: "/calendar", icon: Calendar },
  { label: "Go to Members", href: "/members", icon: Users },
];

export function CommandPalette() {
  const router = useRouter();
  const commandOpen = useUiStore((s) => s.commandOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const openNewIssue = useUiStore((s) => s.openNewIssue);
  const setSetupOpen = useUiStore((s) => s.setSetupOpen);

  const issues = useAppStore((s) => s.issues);
  const objectives = useAppStore((s) => s.objectives);
  const sprints = useAppStore((s) => s.sprints);
  const wikiDocs = useAppStore((s) => s.wikiDocs);
  const teamKey = useAppStore((s) => s.workspace.teamKey);
  const refreshFromXo = useAppStore((s) => s.refreshFromXo);

  const go = (path: string) => {
    setCommandOpen(false);
    router.push(path);
  };

  return (
    <CommandDialog
      open={commandOpen}
      onOpenChange={setCommandOpen}
      className="sm:max-w-xl"
    >
      {/* This CommandDialog variant does not render a Command root itself */}
      <Command>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Issues">
          {issues.map((issue) => {
            const key = `${teamKey}-${issue.number}`;
            return (
              <CommandItem
                key={issue.id}
                value={`${key} ${issue.title}`}
                onSelect={() => go(`/issue/${key}`)}
              >
                <StatusIcon status={issue.status} />
                <span className="w-14 shrink-0 text-xs text-faint">{key}</span>
                <span className="truncate">{issue.title}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandGroup heading="OKRs">
          {objectives.map((objective) => (
            <CommandItem
              key={objective.id}
              value={`okr ${objective.name} ${objective.id}`}
              onSelect={() => go(`/okrs/${objective.id}`)}
            >
              <Target strokeWidth={1.8} className="size-4 text-muted-foreground" />
              <span className="truncate">{objective.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Sprints">
          {sprints.map((sprint) => (
            <CommandItem
              key={sprint.id}
              value={`${sprint.name} ${formatDateRange(sprint.startDate, sprint.endDate)}`}
              onSelect={() => go(`/sprints/${sprint.id}`)}
            >
              <RefreshCcw strokeWidth={1.8} className="size-4 text-muted-foreground" />
              <span>{sprint.name}</span>
              <span className="text-xs text-faint">
                {formatDateRange(sprint.startDate, sprint.endDate)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Wiki">
          {wikiDocs.map((doc) => (
            <CommandItem
              key={doc.id}
              value={`wiki ${doc.title} ${doc.id}`}
              onSelect={() => go(`/wiki/${doc.id}`)}
            >
              <FileText strokeWidth={1.8} className="size-4 text-muted-foreground" />
              <span className="truncate">{doc.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Navigation">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.href}
              value={item.label}
              onSelect={() => go(item.href)}
            >
              <item.icon strokeWidth={1.8} className="size-4 text-muted-foreground" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Actions">
          <CommandItem
            value="New issue"
            onSelect={() => {
              setCommandOpen(false);
              openNewIssue();
            }}
          >
            <SquarePen strokeWidth={1.8} className="size-4 text-muted-foreground" />
            <span>New issue</span>
            <CommandShortcut className="kbd tracking-normal">C</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="Refresh from XO"
            onSelect={() => {
              setCommandOpen(false);
              void refreshFromXo();
            }}
          >
            <RotateCcw strokeWidth={1.8} className="size-4 text-muted-foreground" />
            <span>Refresh from XO</span>
          </CommandItem>
          <CommandItem
            value="Setup"
            onSelect={() => {
              setCommandOpen(false);
              setSetupOpen(true);
            }}
          >
            <Settings2 strokeWidth={1.8} className="size-4 text-muted-foreground" />
            <span>Setup</span>
          </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
