import { cn } from "@/lib/utils";
import type { Label } from "@/lib/types";

/** Rounded label chip with colored dot, as on Linear issue rows. */
export function LabelChip({ label, className }: { label: Label; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border border-input px-2 text-2xs font-medium text-muted-foreground",
        className
      )}
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: label.color }} />
      {label.name}
    </span>
  );
}
