"use client";

import { Ellipsis, Users } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/helpers";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const GRID =
  "grid grid-cols-[minmax(0,2fr)_100px_120px_100px_32px] items-center gap-3 px-4";

/*
  Workspace member table: column headers plus one 48px row per member.
  Filtering is client-side via the `query` prop from the members page.
*/
export function MemberList({ query }: { query: string }) {
  const members = useAppStore((s) => s.members);
  const issues = useAppStore((s) => s.issues);
  const currentMemberId = useAppStore((s) => s.currentMemberId);
  const removeMember = useAppStore((s) => s.removeMember);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? members.filter(
        (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      )
    : members;

  return (
    <div className="flex h-full flex-col">
      <div className={cn("h-8 shrink-0 border-b text-2xs text-faint", GRID)}>
        <span>Name</span>
        <span>Role</span>
        <span>Joined</span>
        <span>Issues</span>
        <span />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members found"
          description="Try a different name or email."
          className="flex-1"
        />
      ) : (
        filtered.map((member) => {
          const openCount = issues.filter(
            (i) =>
              i.assigneeId === member.id &&
              i.status !== "done" &&
              i.status !== "canceled"
          ).length;
          const isCurrent = member.id === currentMemberId;

          return (
            <div key={member.id} className={cn("h-12 shrink-0 hover:bg-accent", GRID)}>
              <div className="flex min-w-0 items-center gap-3">
                <MemberAvatar member={member} size="lg" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {member.name}
                    </span>
                    {isCurrent ? (
                      <span className="shrink-0 text-2xs text-faint">(you)</span>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-faint">{member.email}</div>
                </div>
              </div>

              <div>
                <span className="inline-flex h-[22px] items-center rounded-full border border-input px-2 text-2xs text-muted-foreground">
                  {member.role}
                </span>
              </div>

              <span className="text-xs text-muted-foreground">
                {formatDate(member.joinedAt)}
              </span>

              <span className="text-xs text-muted-foreground">{openCount} open</span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Actions for ${member.name}`}
                  >
                    <Ellipsis className="size-4 text-muted-foreground" strokeWidth={1.8} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={member.role === "Admin" || isCurrent}
                    onSelect={() => removeMember(member.id)}
                  >
                    Remove member
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })
      )}
    </div>
  );
}
