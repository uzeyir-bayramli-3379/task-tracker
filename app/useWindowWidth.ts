'use client'

import { useState, useEffect } from 'react'

/**
 * Returns the current window width, updating on resize.
 *
 * Starts at 0 (its value during SSR and the first client render, when
 * `window` isn't available yet). Callers should treat 0 as "unknown"
 * and defer choosing a layout until after mount — this keeps the
 * server and first client render identical and avoids a hydration
 * mismatch / layout flash.
 */
export function useWindowWidth(): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    onResize() // capture the real width as soon as we're mounted
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return width
}
