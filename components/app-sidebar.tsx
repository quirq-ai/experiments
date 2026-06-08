"use client";

import Link from "next/link";
import { BookOpen, ExternalLink, FolderGit2, Plus } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarModeToggle } from "@/components/sidebar-mode-toggle";
import { CommitStats } from "@/components/CommitStats";
import { CurrentState } from "@/components/current-state";
import { XoLogo } from "@/components/XoLogo";
import { useVisualizer } from "@/lib/visualizer-store";

const RESOURCES = [
  {
    title: "GitHub",
    url: "https://github.com/sharmasuraj0123",
    icon: ExternalLink,
  },
  { title: "Docs", url: "https://docs.xo.builders", icon: BookOpen },
];

/**
 * Left sidebar: repository actions plus the selected commit's detail. Modeled on
 * xo-swarm's AppSidebar (collapsible-icon Sidebar, grouped SidebarMenu, footer
 * with theme toggle + account row, SidebarRail).
 */
export function AppSidebar() {
  const repoLabel = useVisualizer((s) => s.repoLabel);
  const pickFolder = useVisualizer((s) => s.pickFolder);
  const commits = useVisualizer((s) => s.commits);
  const selected = useVisualizer((s) => s.selected);
  const clearSelected = useVisualizer((s) => s.clearSelected);
  const openDetail = useVisualizer((s) => s.openDetail);
  const { setOpenMobile } = useSidebar();

  const commit = selected !== null ? commits[selected] : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Repository</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Open a local git repo"
                  onClick={() => {
                    setOpenMobile(false);
                    pickFolder();
                  }}
                >
                  <Plus />
                  <span>Create new</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={repoLabel} className="opacity-80">
                  <FolderGit2 />
                  <span className="truncate">{repoLabel}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupContent>
            <CurrentState />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Selected commit</SidebarGroupLabel>
          <SidebarGroupContent>
            {commit && selected !== null ? (
              <CommitStats
                commit={commit}
                index={selected}
                total={commits.length}
                onClear={clearSelected}
                onExpand={openDetail}
              />
            ) : (
              <p className="px-3 py-2 text-[12px] leading-relaxed text-muted-foreground group-data-[collapsible=icon]:hidden">
                Click a commit on the wave to pin it and see its additions,
                deletions, and metadata here.
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {RESOURCES.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link href={item.url} target="_blank" rel="noreferrer">
                      <item.icon />
                      <span>{item.title}</span>
                      <ExternalLink className="ml-auto" />
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarModeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default">
              <XoLogo size={20} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">XO Visualizer</span>
                <span className="truncate text-xs text-muted-foreground">
                  git history
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
