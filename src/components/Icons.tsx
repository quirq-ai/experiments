import type { SVGProps } from 'react'

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

export const PlayIcon = () => (
  <Base>
    <path d="M6 4.5 19 12 6 19.5Z" fill="currentColor" stroke="none" />
  </Base>
)

export const PauseIcon = () => (
  <Base>
    <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" />
  </Base>
)

export const ResetIcon = () => (
  <Base>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </Base>
)

export const PlusIcon = () => (
  <Base>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Base>
)
