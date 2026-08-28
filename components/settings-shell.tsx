"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BackIcon } from "./icons";
import { Avatar } from "./ui";
import { USER } from "@/lib/data";
import { useWorkspace } from "@/lib/store";

const SETTINGS_NAV = [
  { label: "Profile", href: "/profile" },
  { label: "Payments", href: "/payments" },
  { label: "Permissions", href: "/permissions" },
  { label: "Billing", href: "/billing" },
  { label: "Superpowers", href: "/superpowers" },
  { label: "Email accounts", href: "/email-accounts" },
  { label: "Leads", href: "/leads" },
];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { credits } = useWorkspace();

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <aside className="flex w-[228px] shrink-0 flex-col border-r border-hairline bg-sidebar">
        <div className="px-2.5 pt-4">
          <Link
            href="/workspace"
            className="flex items-center gap-2 rounded-lg px-2.5 py-[7px] text-[13.5px] font-medium text-ink-soft hover:bg-hairline-soft hover:text-ink"
          >
            <BackIcon size={15} />
            Back
          </Link>
        </div>

        <nav className="mt-3 flex flex-col gap-[2px] px-2.5">
          {SETTINGS_NAV.map(({ label, href }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-2.5 py-[7px] text-[13.5px] font-medium transition-colors ${
                  active
                    ? "bg-chip text-ink"
                    : "text-ink-soft hover:bg-hairline-soft hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-hairline px-3.5 py-3">
          <div className="flex items-center gap-2.5">
            <Avatar char={USER.name[0]} bg={USER.avatarBg} size={28} />
            <div className="leading-tight">
              <div className="text-[13px] font-medium">{USER.name}</div>
              <div className="text-[11.5px] text-ink-faint">
                {USER.plan} · {credits} credits
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
