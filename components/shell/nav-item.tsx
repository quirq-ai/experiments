"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavItem({
  href,
  icon: Icon,
  label,
  indent = false,
}: {
  href: string;
  icon?: LucideIcon;
  label: string;
  indent?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "flex h-[30px] items-center gap-2.5 rounded-md px-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
        indent && "pl-[34px]",
        active && "bg-selected text-foreground"
      )}
    >
      {Icon ? (
        <Icon
          strokeWidth={1.8}
          className={cn("size-4 shrink-0 text-muted-foreground", active && "text-foreground")}
        />
      ) : null}
      <span className="truncate">{label}</span>
    </Link>
  );
}
