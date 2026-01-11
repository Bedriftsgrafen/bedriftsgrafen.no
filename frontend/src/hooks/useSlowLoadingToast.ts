import { useEffect, useRef } from 'react'
import { toast } from '../store/toastStore'

/**
 * Show a toast if loading takes longer than specified delay
 * Useful for slow queries where users need feedback
 */
export function useSlowLoadingToast(
  isLoading: boolean,
  message: string = 'Laster data, vennligst vent...',
  delayMs: number = 3000
) {
  const toastShownRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Start timer when loading begins
    if (isLoading && !toastShownRef.current) {
      timerRef.current = setTimeout(() => {
        toast.info(message)
        toastShownRef.current = true
      }, delayMs)
    }

    // Clean up timer when loading completes
    if (!isLoading) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      toastShownRef.current = false
    }

    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [isLoading, message, delayMs])
}
