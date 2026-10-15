import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Centered empty state used by pages with no content yet. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center gap-1.5 p-8", className)}>
      {Icon ? <Icon className="mb-2 size-6 text-faint" strokeWidth={1.5} /> : null}
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description ? (
        <div className="max-w-[360px] text-center text-sm text-muted-foreground">{description}</div>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
