type IconProps = { size?: number; className?: string };

function base(props: IconProps) {
  return {
    width: props.size ?? 16,
    height: props.size ?? 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: props.className,
    "aria-hidden": true,
  };
}

export function DispatchIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 5l16 7-16 7 4-7-4-7z" />
    </svg>
  );
}

export function WatcherIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="2.2" />
      <path d="M6.5 7.5a7.5 7.5 0 000 9M17.5 7.5a7.5 7.5 0 010 9" />
      <path d="M3.8 4.8a11 11 0 000 14.4M20.2 4.8a11 11 0 010 14.4" />
    </svg>
  );
}

export function InboxIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 13h5l2 3h4l2-3h5" />
      <path d="M5 6h14l2 7v6H3v-6l2-7z" />
    </svg>
  );
}

export function AnalyticsIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
    </svg>
  );
}

export function CampaignsIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 11l14-5v12L3 13v-2z" />
      <path d="M9 14.5V18a2 2 0 004 0v-2.5" />
      <path d="M17 9a3 3 0 010 6" />
    </svg>
  );
}

export function GearIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.5 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.5-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2z" />
    </svg>
  );
}

export function SidebarIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9.5 4.5v15" />
    </svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ArrowUpIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function PromptIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M7.5 10l2.5 2-2.5 2M12.5 14h4" />
    </svg>
  );
}

export function ExternalIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14 5h5v5M19 5l-8 8" />
      <path d="M19 14v4a2 2 0 01-2 2H7a2 2 0 01-2-2V8a2 2 0 012-2h4" />
    </svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-3.8-3.8" />
    </svg>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function BackIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function FlagIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 21V4" />
      <path d="M5 4h13l-2.5 4L18 12H5" />
    </svg>
  );
}
