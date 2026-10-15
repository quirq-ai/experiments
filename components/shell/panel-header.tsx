import { cn } from "@/lib/utils";

/*
  40px header at the top of the main panel. Every page renders exactly one.
  `left` is usually the page title; `right` holds actions (Display, New...).
*/
export function PanelHeader({
  left,
  right,
  className,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex h-10 shrink-0 items-center justify-between gap-2 border-b px-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
        {left}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-1.5">{right}</div> : null}
    </header>
  );
}
