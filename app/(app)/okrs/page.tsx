"use client";

import { useState } from "react";
import { PanelHeader } from "@/components/shell/panel-header";
import { Button } from "@/components/ui/button";
import { NewObjectiveDialog } from "@/features/okrs/components/new-objective-dialog";
import { OkrList } from "@/features/okrs/components/okr-list";

export default function Page() {
  const [newOpen, setNewOpen] = useState(false);

  return (
    <>
      <PanelHeader
        left={<span>OKRs</span>}
        right={
          <Button size="xs" onClick={() => setNewOpen(true)}>
            New objective
          </Button>
        }
      />
      <OkrList onNewObjective={() => setNewOpen(true)} />
      <NewObjectiveDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}
