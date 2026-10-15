import { initials } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import type { Member } from "@/lib/types";

const SIZES = {
  sm: "size-[18px] text-[9px]",
  md: "size-6 text-[10px]",
  lg: "size-8 text-xs",
} as const;

/*
  Colored-initials avatar, Linear style. Pass member=null for the
  unassigned state (dashed outline person).
*/
export function MemberAvatar({
  member,
  size = "sm",
  className,
}: {
  member?: Member | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (!member) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-dashed border-input text-faint",
          SIZES[size],
          className
        )}
        aria-label="Unassigned"
      >
        <svg viewBox="0 0 16 16" className="size-[60%]" fill="currentColor">
          <path d="M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 1.5c-2.2 0-4.5 1.1-4.5 3.2 0 .4.3.8.8.8h7.4c.5 0 .8-.4.8-.8 0-2.1-2.3-3.2-4.5-3.2Z" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white",
        SIZES[size],
        className
      )}
      style={{ backgroundColor: member.color }}
      title={member.name}
    >
      {initials(member.name)}
    </span>
  );
}
