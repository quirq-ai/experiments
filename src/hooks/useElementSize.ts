import { useEffect, useRef, useState } from 'react'

interface ElementSizeOptions {
  minimumHeight?: number
  minimumWidth?: number
}

export function useElementSize<T extends HTMLElement>({ minimumHeight = 440, minimumWidth = 320 }: ElementSizeOptions = {}) {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 1100, height: minimumHeight })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      const rect = element.getBoundingClientRect()
      setSize({ width: Math.max(minimumWidth, rect.width), height: Math.max(minimumHeight, rect.height) })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [minimumHeight, minimumWidth])

  return { ref, ...size }
}
