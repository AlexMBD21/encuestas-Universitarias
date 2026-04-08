import React, { useEffect, useState, useCallback, createContext, useContext, useRef } from 'react'
import ReactDOM from 'react-dom'

// ─── Types ─────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastOptions {
  message: string
  type?: ToastType
  duration?: number   // ms, default 3500
}

interface ToastItem extends Required<ToastOptions> {
  id: string
}

// ─── Context ────────────────────────────────────────────────────────────────
interface ToastContextValue {
  show: (opts: ToastOptions | string) => void
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

// ─── Helper to auto-detect type from the message ───────────────────────────
function detectType(msg: string): ToastType {
  const m = msg.toLowerCase()
  if (m.includes('error') || m.includes('falló') || m.includes('fallo') || m.includes('no se pudo')) return 'error'
  if (m.includes('advertencia') || m.includes('atención') || m.includes('cuidado') || m.includes('tiempo de espera')) return 'warning'
  if (m.includes('creado') || m.includes('guardado') || m.includes('actualizado') || m.includes('publicad') ||
      m.includes('eliminado') || m.includes('copiado') || m.includes('desactivado') || m.includes('completado')) return 'success'
  return 'info'
}

// ─── Theme per type ─────────────────────────────────────────────────────────
const THEME: Record<ToastType, { bg: string; border: string; icon: string; iconColor: string; progress: string; glow: string }> = {
  success: {
    bg: 'bg-slate-900',
    border: 'border-emerald-500/40',
    icon: 'check_circle',
    iconColor: 'text-emerald-400',
    progress: 'bg-emerald-500',
    glow: 'rgba(16, 185, 129, 0.5)',   // emerald-500
  },
  error: {
    bg: 'bg-slate-900',
    border: 'border-red-500/40',
    icon: 'error',
    iconColor: 'text-red-400',
    progress: 'bg-red-500',
    glow: 'rgba(239, 68, 68, 0.5)',    // red-500
  },
  warning: {
    bg: 'bg-slate-900',
    border: 'border-amber-500/40',
    icon: 'warning',
    iconColor: 'text-amber-400',
    progress: 'bg-amber-500',
    glow: 'rgba(245, 158, 11, 0.5)',   // amber-500
  },
  info: {
    bg: 'bg-slate-900',
    border: 'border-blue-500/40',
    icon: 'info',
    iconColor: 'text-blue-400',
    progress: 'bg-blue-500',
    glow: 'rgba(59, 130, 246, 0.5)',   // blue-500
  },
}

// ─── Single Toast item ───────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const theme = THEME[toast.type]
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Trigger enter animation
    const t = setTimeout(() => setVisible(true), 10)

    // Progress bar countdown
    const step = 100 / (toast.duration / 50)
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p <= 0) {
          clearInterval(intervalRef.current!)
          return 0
        }
        return p - step
      })
    }, 50)

    // Auto-dismiss
    const dismiss = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(toast.id), 350)
    }, toast.duration)

    return () => {
      clearTimeout(t)
      clearTimeout(dismiss)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [toast.id, toast.duration, onDismiss])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(() => onDismiss(toast.id), 350)
  }

  return (
    <div
      className={`
        relative flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-2xl border
        ${theme.bg} ${theme.border} text-white
        transition-all duration-350 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        overflow-hidden cursor-pointer select-none
        ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
      `}
      style={{ minWidth: 260, maxWidth: 380, backdropFilter: 'blur(12px)' }}
      onClick={handleDismiss}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <span className={`material-symbols-outlined text-[22px] shrink-0 mt-0.5 ${theme.iconColor}`}>
        {theme.icon}
      </span>

      {/* Message */}
      <p className="text-sm font-medium leading-snug flex-1 pr-2">{toast.message}</p>

      {/* Close button */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); handleDismiss() }}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
        aria-label="Cerrar"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>

      {/* Progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-[3px] ${theme.progress} transition-none`}
        style={{
          width: `${progress}%`,
          transition: 'width 50ms linear',
          boxShadow: `0 0 6px 2px ${theme.glow}`,
        }}
      />
    </div>
  )
}

// ─── Toast Container (portaled to body) ─────────────────────────────────────
function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null

  return ReactDOM.createPortal(
    <>
      <style>{`
        .toast-enter { opacity: 0; transform: translateY(16px) scale(0.95); }
        .toast-enter-active { opacity: 1; transform: translateY(0) scale(1); transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1); }
      `}</style>
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2 pointer-events-none"
        style={{ top: 'calc(var(--topbar-height, 56px) + 12px)', width: 'max-content', maxWidth: 'calc(100vw - 32px)' }}
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto w-full">
            <ToastItem toast={t} onDismiss={onDismiss} />
          </div>
        ))}
      </div>
    </>,
    document.body
  )
}

// ─── Provider ───────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const show = useCallback((opts: ToastOptions | string) => {
    const message = typeof opts === 'string' ? opts : opts.message
    const rawType = typeof opts === 'string' ? undefined : opts.type
    const type = rawType ?? detectType(message)
    const duration = (typeof opts === 'object' && opts.duration) ? opts.duration : 3500
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts(prev => [...prev.slice(-3), { id, message, type, duration }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ─── Standalone imperative API (for pages that don't use the Provider) ──────
/**
 * Drop-in replacement for the old toast pattern:
 *   setToastMessage('Texto')  →  toast('Texto')
 *
 * Usage:
 *   import { toast } from '@/components/ui/Toast'
 *   toast('Encuesta guardada')
 *   toast({ message: 'Error al guardar', type: 'error', duration: 5000 })
 */
let _imperativeShow: ((opts: ToastOptions | string) => void) | null = null

export function ToastImperativeMount() {
  const { show } = useToast()
  useEffect(() => { _imperativeShow = show; return () => { _imperativeShow = null } }, [show])
  return null
}

export function toast(opts: ToastOptions | string) {
  if (_imperativeShow) {
    _imperativeShow(opts)
  } else {
    // Fallback: fire a custom event so the provider can pick it up
    window.dispatchEvent(new CustomEvent('toast:show', { detail: typeof opts === 'string' ? { message: opts } : opts }))
  }
}
