"use client";

import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PanelHeader } from "@/components/shell/panel-header";

export default function Page() {
  return (
    <>
      <PanelHeader left={<span>Inbox</span>} />
      <div className="flex-1 overflow-y-auto">
        <EmptyState
          icon={Inbox}
          title="Inbox zero"
          description="Updates about issues you are subscribed to will land here."
        />
      </div>
    </>
  );
}
