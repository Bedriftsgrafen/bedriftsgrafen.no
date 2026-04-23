import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, AlertTriangle, X } from 'lucide-react'
import { useToastStore, type Toast, type ToastType } from '../store/toastStore'

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div
      className="fixed bottom-4 right-4 z-9999 flex flex-col gap-2 max-w-md"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remainingRef = useRef(toast.duration)
  const startRef = useRef<number>(0)
  // Stable ref so the mount-effect closure doesn't capture a stale onClose
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    startRef.current = Date.now()
    timerRef.current = setTimeout(() => onCloseRef.current(), remainingRef.current)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleMouseEnter = () => {
    setPaused(true)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      remainingRef.current -= Date.now() - startRef.current
    }
  }

  const handleMouseLeave = () => {
    setPaused(false)
    startRef.current = Date.now()
    timerRef.current = setTimeout(() => onCloseRef.current(), remainingRef.current)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCloseRef.current()
  }

  const isAlert = toast.type === 'error' || toast.type === 'warning'

  const icons: Record<ToastType, typeof CheckCircle> = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: AlertCircle,
  }

  const colors: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200 text-green-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
  }

  const iconColors: Record<ToastType, string> = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
  }

  const barColors: Record<ToastType, string> = {
    success: 'bg-green-400',
    error: 'bg-red-400',
    warning: 'bg-amber-400',
    info: 'bg-blue-400',
  }

  const Icon = icons[toast.type]

  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      className={`${colors[toast.type]} relative overflow-hidden border rounded-lg shadow-lg p-4 flex items-start gap-3 min-w-[280px] sm:min-w-[320px] animate-slide-in`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      data-paused={paused || undefined}
    >
      <Icon className={`h-5 w-5 ${iconColors[toast.type]} mt-0.5 shrink-0`} />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={onClose}
        className="shrink-0 p-1 hover:bg-black/5 rounded transition-colors"
        aria-label="Lukk varsel"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Countdown progress bar — shrinks from full width to zero */}
      <div
        aria-hidden="true"
        className={`toast-progress absolute bottom-0 left-0 h-0.5 w-full ${barColors[toast.type]}`}
        style={{ animationDuration: `${toast.duration}ms` }}
      />
    </div>
  )
}
