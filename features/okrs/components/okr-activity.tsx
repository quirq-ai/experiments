"use client";

import { MemberAvatar } from "@/components/shared/member-avatar";
import { timeAgo } from "@/lib/helpers";
import { useAppStore } from "@/lib/store";
import type { Objective } from "@/lib/types";

/** Objective history feed for the detail sidebar, newest first. */
export function OkrActivity({ objective }: { objective: Objective }) {
  const members = useAppStore((s) => s.members);
  const history = objective.history ?? [];

  if (history.length === 0) {
    return <div className="mt-2 text-xs text-faint">Updates will show up here.</div>;
  }

  return (
    <div className="mt-2 flex flex-col gap-3">
      {history.map((event) => {
        const member = members.find((m) => m.id === event.memberId) ?? null;
        return (
          <div key={event.id} className="flex gap-2">
            <MemberAvatar member={member} size="sm" className="mt-px" />
            <div className="min-w-0">
              <div className="text-xs leading-relaxed text-foreground/90">{event.summary}</div>
              <div className="mt-0.5 text-2xs text-faint">{timeAgo(event.at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
