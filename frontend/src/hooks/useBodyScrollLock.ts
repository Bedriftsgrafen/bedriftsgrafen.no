import { useEffect } from 'react'

/**
 * Locks body scroll when active using the position:fixed pattern.
 * This is the most reliable approach for iOS Safari, which ignores
 * overflow:hidden on body for preventing horizontal viewport expansion.
 *
 * When locked: body becomes position:fixed (removed from flow), its
 * left/right/width constrain it to the viewport, and top is offset
 * to preserve the visual scroll position.
 */
export function useBodyScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return

    const scrollY = window.scrollY
    const body = document.body

    // Save original values
    const originalPosition = body.style.position
    const originalTop = body.style.top
    const originalLeft = body.style.left
    const originalRight = body.style.right
    const originalWidth = body.style.width

    // Lock: fix body in place at current scroll position
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'

    return () => {
      // Restore original styles
      body.style.position = originalPosition
      body.style.top = originalTop
      body.style.left = originalLeft
      body.style.right = originalRight
      body.style.width = originalWidth

      // Restore scroll position
      window.scrollTo(0, scrollY)
    }
  }, [active])
}
