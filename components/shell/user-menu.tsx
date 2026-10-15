"use client";

import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { LogIn } from "lucide-react";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { authEnabled } from "@/lib/auth";
import { useCurrentMember } from "@/lib/store";

/*
  Bottom-left user affordance. With Clerk keys configured this is the real
  UserButton; in open demo mode it shows the seeded demo user.
*/
export function UserMenu() {
  const member = useCurrentMember();

  if (!authEnabled) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5">
        <MemberAvatar member={member} size="md" />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-medium text-foreground">{member?.name}</div>
          <div className="truncate text-2xs text-faint">Demo mode, Clerk keys not set</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <Show when="signed-in">
        <UserButton appearance={{ elements: { userButtonAvatarBox: "size-6" } }} />
      </Show>
      <Show when="signed-out">
        <Link
          href="/sign-in"
          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <LogIn className="size-4" strokeWidth={1.8} />
          Sign in
        </Link>
      </Show>
    </div>
  );
}
