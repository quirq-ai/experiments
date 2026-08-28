export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="6.4"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <ellipse
        cx="12"
        cy="12.8"
        rx="6.2"
        ry="3.6"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="13.4" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <Mark size={size} />
      <span
        className="font-semibold tracking-tight"
        style={{ fontSize: size * 0.78 }}
      >
        Autospawn
      </span>
    </span>
  );
}
