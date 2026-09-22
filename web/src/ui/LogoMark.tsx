// The XO mark: paired "<" chevrons in ink and ">" chevrons in the deep accent
// green, drawn on the dark space tile. Geometry is reused verbatim from the
// shared XO brand asset (viewBox 0 0 500 500, stroke-width 15.38).
// Colors are literal so the mark stays identical to the favicon and README asset.
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 500 500" width={size} height={size} aria-hidden focusable="false">
      <rect width="500" height="500" rx="110" fill="#0b0c0f" />
      <g fill="none" strokeWidth="15.38" strokeMiterlimit="10">
        <polyline points="36.99 165.84 118.47 247.31 31.16 334.61" stroke="#e9e4d9" />
        <polyline points="244.91 165.84 163.44 247.31 250.74 334.61" stroke="#e9e4d9" />
        <polyline points="328.12 165.06 246.65 246.53 333.95 333.84" stroke="#83d63a" />
        <polyline points="380.51 165.06 461.99 246.53 374.68 333.84" stroke="#83d63a" />
      </g>
    </svg>
  );
}
