"use client";

import { useState } from "react";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PanelHeader } from "@/components/shell/panel-header";
import { DisplayMenu, type IssueGrouping } from "@/features/issues/components/display-menu";
import { FilterBar } from "@/features/issues/components/filter-bar";
import { IssueList } from "@/features/issues/components/issue-list";
import { useIssueFilters } from "@/features/issues/hooks/use-issue-filters";
import { useAppStore } from "@/lib/store";

export default function Page() {
  const issues = useAppStore((s) => s.issues);
  const { filters, setFilters, apply } = useIssueFilters();
  const [grouping, setGrouping] = useState<IssueGrouping>("status");

  const filtered = apply(issues);

  return (
    <>
      <PanelHeader
        left={<span>All issues</span>}
        right={<DisplayMenu grouping={grouping} onGroupingChange={setGrouping} />}
      />
      <FilterBar filters={filters} setFilters={setFilters} />
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No issues match"
            description="Adjust or clear the filters above."
          />
        ) : (
          <IssueList issues={filtered} grouping={grouping} />
        )}
      </div>
    </>
  );
}
