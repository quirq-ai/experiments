"use client";

import { useState } from "react";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  CircleUser,
  Inbox,
  Search,
  Settings2,
  SquarePen,
  Target,
  UserPlus,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { NavItem } from "@/components/shell/nav-item";
import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 mb-1 px-2 text-2xs font-medium text-faint">{children}</div>
  );
}

export function Sidebar() {
  const workspace = useAppStore((s) => s.workspace);
  const projects = useAppStore((s) => s.projects);
  const pathname = usePathname();
  const refreshFromXo = useAppStore((s) => s.refreshFromXo);
  const openNewIssue = useUiStore((s) => s.openNewIssue);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setSetupOpen = useUiStore((s) => s.setSetupOpen);
  const [teamOpen, setTeamOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState<Record<string, boolean>>({});

  return (
    <aside className="flex w-60 shrink-0 flex-col px-3 pt-3 pb-2">
      {/* Workspace row */}
      <div className="flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-sidebar-accent">
              <span
                className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] text-[9px] font-bold text-black"
                style={{ backgroundColor: workspace.color }}
              >
                {workspace.teamKey}
              </span>
              <span className="truncate text-sm font-medium text-foreground">
                {workspace.name}
              </span>
              <ChevronDown className="size-3 shrink-0 text-faint" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onSelect={() => setSetupOpen(true)}>
              Setup
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void refreshFromXo()}>
              Refresh from XO
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Switch workspace</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Search"
                onClick={() => setCommandOpen(true)}
              >
                <Search className="size-4 text-muted-foreground" strokeWidth={1.8} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Search <span className="kbd ml-1">⌘K</span>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="New issue"
                onClick={() => openNewIssue()}
              >
                <SquarePen className="size-4 text-muted-foreground" strokeWidth={1.8} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              New issue <span className="kbd ml-1">C</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Nav */}
      <nav className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col gap-px">
          <NavItem href="/inbox" icon={Inbox} label="Inbox" />
          <NavItem href="/my-issues" icon={CircleUser} label="My Issues" />
        </div>

        <SectionLabel>Workspace</SectionLabel>
        <div className="flex flex-col gap-px">
          <NavItem href="/okrs" icon={Target} label="OKRs" />
          <NavItem href="/wiki" icon={BookOpen} label="Wiki" />
          <NavItem href="/members" icon={Users} label="Members" />
          <NavItem href="/calendar" icon={Calendar} label="Calendar" />
        </div>

        <SectionLabel>Projects</SectionLabel>
        <div className="flex flex-col gap-px">
          {projects.length === 0 ? (
            <button
              onClick={() => setSetupOpen(true)}
              className="flex h-[30px] items-center gap-2.5 rounded-md px-2 text-sm text-faint hover:bg-sidebar-accent"
            >
              Pick folders in Setup
            </button>
          ) : (
            projects.map((project) => {
              const base = `/project/${project.id}`;
              const open = projectsOpen[project.id] ?? pathname.startsWith(`${base}/`);
              return (
                <div key={project.id} className="flex flex-col gap-px">
                  <button
                    onClick={() =>
                      setProjectsOpen((prev) => ({ ...prev, [project.id]: !open }))
                    }
                    className="flex h-[30px] items-center gap-2.5 rounded-md px-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate">{project.name}</span>
                    <ChevronRight
                      className={cn(
                        "size-3 shrink-0 text-faint transition-transform",
                        open && "rotate-90"
                      )}
                    />
                  </button>
                  {open ? (
                    <div className="flex flex-col gap-px">
                      <NavItem href={`${base}/work-items`} indent label="Work items" />
                      <NavItem href={`${base}/sprints`} indent label="Sprints" />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <SectionLabel>Your teams</SectionLabel>
        <button
          onClick={() => setTeamOpen((o) => !o)}
          className="flex h-[30px] items-center gap-2 rounded-md px-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <span className="flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-primary text-[8.5px] font-bold text-white">
            {workspace.teamName[0]}
          </span>
          <span className="truncate">{workspace.teamName}</span>
          <ChevronRight
            className={cn("size-3 text-faint transition-transform", teamOpen && "rotate-90")}
          />
        </button>
        {teamOpen ? (
          <div className="flex flex-col gap-px">
            <NavItem href="/issues" indent label="Issues" />
            <NavItem href="/sprints" indent label="Sprints" />
          </div>
        ) : null}
      </nav>

      {/* Footer */}
      <div className="mt-2 flex flex-col gap-1">
        <button
          onClick={() => setSetupOpen(true)}
          className="flex h-[30px] items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Settings2 className="size-4 text-muted-foreground" strokeWidth={1.8} />
          <span>Setup</span>
        </button>
        <NavItem href="/members" icon={UserPlus} label="Invite people" />
        <UserMenu />
      </div>
    </aside>
  );
}
