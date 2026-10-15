"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PanelHeader } from "@/components/shell/panel-header";
import { DisplayMenu, type IssueGrouping } from "@/features/issues/components/display-menu";
import { IssueList } from "@/features/issues/components/issue-list";
import { useAppStore } from "@/lib/store";

export default function Page() {
  const issues = useAppStore((s) => s.issues);
  const currentMemberId = useAppStore((s) => s.currentMemberId);
  const [grouping, setGrouping] = useState<IssueGrouping>("status");

  const mine = issues.filter((i) => i.assigneeId === currentMemberId);

  return (
    <>
      <PanelHeader
        left={<span>My Issues</span>}
        right={<DisplayMenu grouping={grouping} onGroupingChange={setGrouping} />}
      />
      <div className="flex-1 overflow-y-auto">
        {mine.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            title="No issues assigned"
            description="Issues assigned to you will appear here."
          />
        ) : (
          <IssueList issues={mine} grouping={grouping} />
        )}
      </div>
    </>
  );
}
