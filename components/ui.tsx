import { ReactNode } from "react";

export function PillButton({
  children,
  variant = "dark",
  className = "",
  onClick,
  disabled,
}: {
  children: ReactNode;
  variant?: "dark" | "outline" | "gray" | "ghost";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const styles = {
    dark: "bg-pill-dark text-white hover:bg-black",
    outline:
      "bg-card text-ink border border-hairline hover:border-ink-faint shadow-[0_1px_2px_rgba(28,25,23,0.04)]",
    gray: "bg-[#8f8d89] text-white hover:bg-[#7d7b77]",
    ghost: "text-ink-soft hover:bg-chip",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-[7px] text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-hairline bg-card shadow-[0_1px_3px_rgba(28,25,23,0.03)] ${className}`}
    >
      {children}
    </div>
  );
}

export function CountChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-[6px] text-[13px] font-medium transition-colors ${
        active ? "bg-chip text-ink" : "text-ink-faint hover:text-ink-soft"
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] ${
            active ? "bg-[#dedbd4] text-ink-soft" : "bg-chip text-ink-faint"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function TimeRange({
  value,
  onChange,
}: {
  value: string;
  onChange?: (v: string) => void;
}) {
  const ranges = ["1d", "7d", "30d", "90d", "All time"];
  return (
    <div className="flex items-center gap-1">
      {ranges.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange?.(r)}
          className={`rounded-md px-2 py-1 text-[12.5px] font-medium transition-colors ${
            value === r
              ? "bg-chip text-ink"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg bg-danger-bg px-4 py-3 text-[13px] text-danger">
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  pct,
}: {
  label: string;
  value: string | number;
  pct?: string;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[12.5px] text-ink-faint">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[22px] font-medium leading-none">{value}</span>
        {pct !== undefined && (
          <span className="text-[12px] text-ink-faint">{pct}</span>
        )}
      </div>
    </Card>
  );
}

export function SignalBadge({ type, dot }: { type: string; dot?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3 py-[5px] text-[12.5px] font-medium text-ink shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
      <span
        className="h-[7px] w-[7px] rounded-[2.5px]"
        style={{ background: dot ?? "#34d399" }}
      />
      {type}
    </span>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-[3px]"
      style={{ background: color, width: size + 2, height: size + 2 }}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-[13.5px] text-ink-soft">{subtitle}</p>
      )}
    </div>
  );
}

export function Avatar({
  char,
  bg,
  size = 28,
  rounded = "rounded-full",
  fontSize,
}: {
  char: string;
  bg: string;
  size?: number;
  rounded?: string;
  fontSize?: number;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-medium text-white ${rounded}`}
      style={{ background: bg, width: size, height: size, fontSize: fontSize ?? size * 0.44 }}
    >
      {char}
    </span>
  );
}
