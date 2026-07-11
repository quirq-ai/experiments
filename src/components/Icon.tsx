import type { SVGProps } from 'react'

export type IconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'center'
  | 'check'
  | 'chevron-down'
  | 'close'
  | 'compass'
  | 'external'
  | 'filter'
  | 'layers'
  | 'link'
  | 'moon'
  | 'network'
  | 'pause'
  | 'play'
  | 'route'
  | 'search'
  | 'shuffle'
  | 'sparkles'
  | 'sun'
  | 'swap'
  | 'timeline'
  | 'zoom-in'
  | 'zoom-out'

const paths: Record<IconName, React.ReactNode> = {
  'arrow-left': <><path d="m15 18-6-6 6-6" /></>,
  'arrow-right': <><path d="m9 18 6-6-6-6" /></>,
  center: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.4 5.6L8 16l2.4-5.6L16 8Z" /></>,
  external: <><path d="M15 4h5v5M14 10l6-6" /><path d="M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" /></>,
  filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1" /></>,
  moon: <path d="M20 15.4A9 9 0 0 1 8.6 4 9 9 0 1 0 20 15.4Z" />,
  network: <><circle cx="12" cy="5" r="2" /><circle cx="5" cy="17" r="2" /><circle cx="19" cy="17" r="2" /><path d="m11 7-5 8M13 7l5 8M7 17h10" /></>,
  pause: <><path d="M9 6v12M15 6v12" /></>,
  play: <path d="m8 5 11 7-11 7V5Z" />,
  route: <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h3a3 3 0 0 0 3-3v-1a3 3 0 0 0-3-3H9a3 3 0 0 1-3-3V7a2 2 0 0 1 2-2h8" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  shuffle: <><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></>,
  sparkles: <><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z" /><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14ZM19 12l.6 1.4L21 14l-1.4.6L19 16l-.6-1.4L17 14l1.4-.6L19 12Z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  swap: <><path d="M7 7h11l-3-3M17 17H6l3 3" /></>,
  timeline: <><path d="M3 12h18" /><circle cx="6" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="18" cy="12" r="2" /></>,
  'zoom-in': <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5M10.5 7.5v6M7.5 10.5h6" /></>,
  'zoom-out': <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5M7.5 10.5h6" /></>,
}

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number }

export function Icon({ name, size = 18, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
