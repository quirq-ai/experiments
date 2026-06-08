"use client";

import {
  ChevronLeft,
  ChevronRight,
  GitBranch,
  PanelLeft,
  PanelRight,
  Play,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface NavbarProps {
  repoLabel: string;
  branch: string;
  commitCount: number;
  totalAdd: number;
  totalDel: number;
  loading?: boolean;
  onReplay: () => void;
  onCreate: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  leftOpen: boolean;
  rightOpen: boolean;
}

/**
 * Mirrors the xo-swarm app header (components/conditional-layout.tsx). The left
 * cluster toggles the left "Visualize" sidebar; the right cluster toggles the
 * right "Analyze" sidebar. The two are mutually exclusive (handled in the page).
 */
export function Navbar({
  repoLabel,
  branch,
  commitCount,
  totalAdd,
  totalDel,
  loading = false,
  onReplay,
  onCreate,
  onToggleLeft,
  onToggleRight,
  leftOpen,
  rightOpen,
}: NavbarProps) {
  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
      {/* Branch name centered in the header (DynamicBreadcrumb analog) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="pointer-events-auto">
          <span className="flex items-baseline gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {branch}
            </span>
            <span className="ml-1 flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
              <span className="text-[#5ef38b]">+{totalAdd.toLocaleString()}</span>
              <span className="text-[#ff5d6c]">-{totalDel.toLocaleString()}</span>
            </span>
          </span>
        </div>
      </div>

      {/* Left: toggle + Visualize crumb + commit count */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleLeft}
          className="size-7 -ml-1"
          aria-label="Toggle Visualize sidebar"
        >
          <PanelLeft />
        </Button>
        <Button
          variant={leftOpen ? "secondary" : "ghost"}
          size="sm"
          onClick={onToggleLeft}
          className="gap-1 px-2 text-foreground"
        >
          Visualize
          <ChevronRight className="size-4 text-muted-foreground" />
        </Button>
        <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
          {commitCount.toLocaleString()} commits
        </span>
      </div>

      {/* Right: repo + Create new + Replay + Analyze crumb + toggle */}
      <div className="flex items-center gap-2">
        <span className="hidden max-w-[200px] items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <GitBranch className="size-3.5 shrink-0" />
          <span className="truncate">{repoLabel}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onCreate}
          disabled={loading}
          className="flex-row-reverse"
        >
          <Plus className="size-4" />
          {loading ? "Loading" : "Create new"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onReplay} className="gap-1.5">
          <Play className="size-4" />
          Replay
        </Button>
        <Button
          variant={rightOpen ? "secondary" : "ghost"}
          size="sm"
          onClick={onToggleRight}
          className="gap-1 px-2 text-foreground"
        >
          <ChevronLeft className="size-4 text-muted-foreground" />
          Analyze
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleRight}
          className="size-7 -mr-1"
          aria-label="Toggle Analyze sidebar"
        >
          <PanelRight />
        </Button>
      </div>
    </header>
  );
}
