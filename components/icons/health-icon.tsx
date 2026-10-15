import { cn } from "@/lib/utils";
import type { OkrHealth } from "@/lib/types";
import { healthLabel } from "@/lib/types";

const COLOR: Record<OkrHealth, string> = {
  on_track: "var(--health-on-track)",
  at_risk: "var(--health-at-risk)",
  off_track: "var(--health-off-track)",
};

/** Small filled dot used next to OKR health text. */
export function HealthIcon({ health, className }: { health: OkrHealth; className?: string }) {
  return (
    <svg viewBox="0 0 8 8" className={cn("size-2 shrink-0", className)} aria-label={healthLabel(health)}>
      <circle cx="4" cy="4" r="4" fill={COLOR[health]} />
    </svg>
  );
}
