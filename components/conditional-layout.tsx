"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  GitBranch,
  Loader2,
  PanelRight,
  Play,
  Plus,
} from "lucide-react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { AnalyzeSidebar } from "@/components/analyze-sidebar";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import { CommitDetailModal } from "@/components/CommitDetailModal";
import { useVisualizer } from "@/lib/visualizer-store";

/**
 * App shell, mirroring xo-swarm/components/conditional-layout.tsx: a left
 * SidebarProvider + AppSidebar + SidebarInset (with the 64px header), plus a
 * second SidebarProvider for the right "Analyze" sidebar. Left and right are
 * mutually exclusive, exactly as in xo-swarm.
 */
export function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const handleLeftOpen = (open: boolean) => {
    setLeftOpen(open);
    if (open) setRightOpen(false);
  };
  const handleRightOpen = (open: boolean) => {
    setRightOpen(open);
    if (open) setLeftOpen(false);
  };

  const repoLabel = useVisualizer((s) => s.repoLabel);
  const commitCount = useVisualizer((s) => s.commits.length);
  const branches = useVisualizer((s) => s.branches);
  const branchName = useVisualizer((s) => s.branch);
  const loading = useVisualizer((s) => s.loading);
  const pickFolder = useVisualizer((s) => s.pickFolder);
  const replay = useVisualizer((s) => s.replay);

  const detail = useVisualizer((s) => s.detail);
  const detailOpen = useVisualizer((s) => s.detailOpen);
  const detailLoading = useVisualizer((s) => s.detailLoading);
  const detailError = useVisualizer((s) => s.detailError);
  const closeDetail = useVisualizer((s) => s.closeDetail);
  const path = useVisualizer((s) => s.path);
  const isGit = useVisualizer((s) => s.isGit);
  const createExperiment = useVisualizer((s) => s.createExperiment);
  const experimentBusy = useVisualizer((s) => s.experimentBusy);
  const totalCommits =
    branches.find((b) => b.name === branchName)?.count ?? 0;

  return (
    <SidebarProvider open={leftOpen} onOpenChange={handleLeftOpen}>
      <AppSidebar />
      <SidebarInset>
        <header className="relative flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
          {/* Branch name centered (DynamicBreadcrumb) */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="pointer-events-auto">
              <DynamicBreadcrumb />
            </div>
          </div>

          {/* Left: sidebar toggle + Visualize crumb + commit count */}
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleLeftOpen(!leftOpen)}
              className="gap-1 px-2 text-foreground"
            >
              Visualize
              <ChevronRight className="size-4 text-muted-foreground" />
            </Button>
            <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
              {commitCount.toLocaleString()}
              {totalCommits > commitCount
                ? ` / ${totalCommits.toLocaleString()}`
                : ""}{" "}
              commits
            </span>
          </div>

          {/* Right: repo + Create new + Replay + Analyze toggle */}
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[200px] items-center gap-1.5 text-xs text-muted-foreground md:flex">
              <GitBranch className="size-3.5 shrink-0" />
              <span className="truncate">{repoLabel}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={pickFolder}
              disabled={loading}
              className="flex-row-reverse"
            >
              <Plus className="size-4" />
              {loading ? "Loading" : "Create new"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleRightOpen(true); // reveal the branch list so the new
                createExperiment(); //    experiment branch is visible there
              }}
              disabled={!isGit || experimentBusy}
              title={
                isGit
                  ? "New worktree + branch, with a Claude session opened in it"
                  : "Load a real git repo first"
              }
              className="gap-1.5"
            >
              {experimentBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FlaskConical className="size-4" />
              )}
              {experimentBusy ? "Starting" : "Experiment"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={replay}
              className="gap-1.5"
            >
              <Play className="size-4" />
              Replay
            </Button>
            <Button
              variant={rightOpen ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleRightOpen(!rightOpen)}
              className="gap-1 px-2 text-foreground"
            >
              <ChevronLeft className="size-4 text-muted-foreground" />
              Analyze
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 -mr-1"
              onClick={() => handleRightOpen(!rightOpen)}
              aria-label="Toggle Analyze sidebar"
            >
              <PanelRight />
            </Button>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </SidebarInset>

      {/* Right "Analyze" sidebar in its own provider (mirror of the left), with
          display:contents so the wrapper stays out of the flex layout. */}
      <SidebarProvider
        open={rightOpen}
        onOpenChange={handleRightOpen}
        style={{ display: "contents" }}
      >
        <AnalyzeSidebar />
      </SidebarProvider>

      {detailOpen && (
        <CommitDetailModal
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
          repoPath={path.trim()}
          canPreview={isGit}
        />
      )}
    </SidebarProvider>
  );
}
