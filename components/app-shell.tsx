"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "./logo";
import {
  AnalyticsIcon,
  CampaignsIcon,
  DispatchIcon,
  GearIcon,
  InboxIcon,
  SidebarIcon,
  WatcherIcon,
} from "./icons";
import { Avatar } from "./ui";
import { USER } from "@/lib/data";
import { useWorkspace } from "@/lib/store";

const NAV = [
  { label: "Dispatch", href: "/workspace", icon: DispatchIcon },
  { label: "Watcher", href: "/watcher", icon: WatcherIcon },
  { label: "Inbox", href: "/inbox", icon: InboxIcon },
  { label: "Analytics", href: "/analytics", icon: AnalyticsIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { campaigns, credits, sidebarOpen, setSidebarOpen } = useWorkspace();

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      {sidebarOpen && (
        <aside className="flex w-[228px] shrink-0 flex-col border-r border-hairline bg-sidebar">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <Link href="/" className="flex items-center gap-2">
              <Mark size={19} />
              <span className="text-[14.5px] font-semibold tracking-tight">
                Autospawn
              </span>
            </Link>
            <button
              type="button"
              aria-label="Hide sidebar"
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-1 text-ink-faint hover:bg-chip hover:text-ink-soft"
            >
              <SidebarIcon size={15} />
            </button>
          </div>

          <nav className="mt-3 flex flex-col gap-[2px] px-2.5">
            {NAV.map(({ label, href, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] font-medium transition-colors ${
                    active
                      ? "bg-chip text-ink"
                      : "text-ink-soft hover:bg-hairline-soft hover:text-ink"
                  }`}
                >
                  <Icon size={15.5} className="text-ink-soft" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 px-2.5">
            <div className="flex items-center gap-2.5 px-2.5 py-1 text-[13.5px] font-medium text-ink-soft">
              <CampaignsIcon size={15.5} />
              Campaigns
            </div>
            <div className="mt-[2px] flex flex-col gap-[2px]">
              {campaigns.map((c) => {
                const href = `/campaigns/${c.id}`;
                const active = pathname === href;
                return (
                  <Link
                    key={c.id}
                    href={href}
                    title={c.name}
                    className={`truncate rounded-lg py-[6px] pl-[34px] pr-2 text-[13px] transition-colors ${
                      active
                        ? "bg-chip text-ink"
                        : "text-ink-soft hover:bg-hairline-soft hover:text-ink"
                    }`}
                  >
                    {c.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-auto border-t border-hairline px-3.5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Avatar char={USER.name[0]} bg={USER.avatarBg} size={28} />
                <div className="leading-tight">
                  <div className="text-[13px] font-medium">{USER.name}</div>
                  <div className="text-[11.5px] text-ink-faint">
                    {USER.plan} · {credits} credits
                  </div>
                </div>
              </div>
              <Link
                href="/profile"
                aria-label="Open settings"
                className="rounded-md p-1 text-ink-faint hover:bg-chip hover:text-ink-soft"
              >
                <GearIcon size={15} />
              </Link>
            </div>
          </div>
        </aside>
      )}

      <main className="relative flex-1 overflow-y-auto">
        {!sidebarOpen && (
          <button
            type="button"
            aria-label="Show sidebar"
            onClick={() => setSidebarOpen(true)}
            className="absolute left-4 top-4 z-20 rounded-md p-1 text-ink-faint hover:bg-chip hover:text-ink-soft"
          >
            <SidebarIcon size={16} />
          </button>
        )}
        {children}
      </main>
    </div>
  );
}
