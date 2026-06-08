"use client";

import { GitBranch } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useVisualizer } from "@/lib/visualizer-store";

/**
 * Right "Analyze" sidebar: the repo's branch list. Mirror of xo-swarm's
 * right-side AppSidebar (Sidebar side="right" with grouped SidebarMenu + rail).
 */
export function AnalyzeSidebar() {
  const branches = useVisualizer((s) => s.branches);
  const branch = useVisualizer((s) => s.branch);
  const selectBranch = useVisualizer((s) => s.selectBranch);
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Branches</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {branches.map((b) => (
                <SidebarMenuItem key={b.name}>
                  <SidebarMenuButton
                    tooltip={b.name}
                    isActive={b.name === branch}
                    onClick={() => {
                      setOpenMobile(false);
                      selectBranch(b.name);
                    }}
                  >
                    <GitBranch />
                    <span className="truncate">{b.name}</span>
                    {b.current && (
                      <span className="ml-auto text-[9px] uppercase text-muted-foreground">
                        HEAD
                      </span>
                    )}
                    <span className="ml-auto text-[11px] tabular-nums text-muted-foreground group-data-[collapsible=icon]:hidden">
                      {b.count}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {branches.length === 0 && (
                <SidebarMenuItem>
                  <span className="px-2 py-1.5 text-[12px] text-muted-foreground">
                    No branches
                  </span>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
