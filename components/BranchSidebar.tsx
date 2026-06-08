"use client";

import { ReactNode } from "react";
import { XoLogo } from "@/components/XoLogo";
import { Branch } from "@/lib/types";

interface BranchSidebarProps {
  title: string;
  side: "left" | "right";
  branches: Branch[];
  activeBranch: string;
  onSelect: (name: string) => void;
  topSlot?: ReactNode;
}

/**
 * One repo's branch list. Rendered identically on both sides for now: the left
 * instance is the "Visualize" panel, the right instance is "Analyze". Only one
 * is ever open at a time (mutually exclusive, handled in the page).
 */
export function BranchSidebar({
  title,
  side,
  branches,
  activeBranch,
  onSelect,
  topSlot,
}: BranchSidebarProps) {
  return (
    <aside
      className={`flex w-60 shrink-0 flex-col bg-card border-border ${
        side === "left" ? "border-r" : "border-l"
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-4">
        <XoLogo size={20} />
        <span className="text-[13px] font-medium tracking-tight text-foreground">
          {title}
        </span>
      </div>

      {topSlot}

      <div className="px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Branches
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {branches.map((b) => {
          const active = b.name === activeBranch;
          return (
            <button
              key={b.name}
              onClick={() => onSelect(b.name)}
              className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                active
                  ? "bg-primary/10 text-[#9be35a]"
                  : "text-[#c7ccc8] hover:bg-accent"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  active ? "bg-primary" : "bg-[#3a3f3b]"
                }`}
              />
              <span className="flex-1 truncate">{b.name}</span>
              {b.current && (
                <span className="text-[9px] uppercase text-muted-foreground">
                  HEAD
                </span>
              )}
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {b.count}
              </span>
            </button>
          );
        })}
        {branches.length === 0 && (
          <div className="px-2.5 py-2 text-[12px] text-muted-foreground">
            No branches
          </div>
        )}
      </div>
    </aside>
  );
}
