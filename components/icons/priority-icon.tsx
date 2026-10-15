import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/types";

/*
  Linear-style 16px priority glyphs: signal bars for low/medium/high,
  an orange square for urgent, dots for none.
*/

const BAR_ON = "#8a8f98";
const BAR_OFF = "#3c3e44";

function Bars({ level, label, className }: { level: 1 | 2 | 3; label: string; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-label={label}>
      <rect x="1.5" y="8" width="3" height="6" rx="1" fill={level >= 1 ? BAR_ON : BAR_OFF} />
      <rect x="6.5" y="5" width="3" height="9" rx="1" fill={level >= 2 ? BAR_ON : BAR_OFF} />
      <rect x="11.5" y="2" width="3" height="12" rx="1" fill={level >= 3 ? BAR_ON : BAR_OFF} />
    </svg>
  );
}

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const cls = cn("size-4 shrink-0", className);
  switch (priority) {
    case "none":
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-label="No priority">
          <rect x="1.5" y="7.25" width="3" height="1.5" rx="0.75" fill={BAR_OFF} />
          <rect x="6.5" y="7.25" width="3" height="1.5" rx="0.75" fill={BAR_OFF} />
          <rect x="11.5" y="7.25" width="3" height="1.5" rx="0.75" fill={BAR_OFF} />
        </svg>
      );
    case "urgent":
      return (
        <svg viewBox="0 0 16 16" className={cls} aria-label="Urgent">
          <rect x="1" y="1" width="14" height="14" rx="3.5" fill="#f2994a" />
          <path d="M8 4.2 L8 8.8" stroke="#151516" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r="1" fill="#151516" />
        </svg>
      );
    case "high":
      return <Bars level={3} label="High priority" className={cls} />;
    case "medium":
      return <Bars level={2} label="Medium priority" className={cls} />;
    case "low":
      return <Bars level={1} label="Low priority" className={cls} />;
  }
}
