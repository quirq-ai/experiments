"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { PanelHeader } from "@/components/shell/panel-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InviteDialog } from "@/features/members/components/invite-dialog";
import { MemberList } from "@/features/members/components/member-list";
import { useAppStore } from "@/lib/store";

export default function Page() {
  const members = useAppStore((s) => s.members);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [query, setQuery] = useState("");

  return (
    <>
      <PanelHeader
        left={
          <>
            <span>Members</span>
            <span className="text-muted-foreground">{members.length}</span>
          </>
        }
        right={
          <Button size="xs" onClick={() => setInviteOpen(true)}>
            Invite people
          </Button>
        }
      />
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-4">
        <Search className="size-4 shrink-0 text-faint" strokeWidth={1.8} />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name or email..."
          className="h-7 w-64 border-none bg-transparent px-1 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        <MemberList query={query} />
      </div>
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}
