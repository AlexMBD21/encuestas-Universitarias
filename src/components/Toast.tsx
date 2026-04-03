import React from 'react'
import { createPortal } from 'react-dom'

type ToastKind = 'create' | 'edit' | 'delete' | 'info'

interface ToastProps {
  visible: boolean
  message: string | null
  kind?: ToastKind
  onClose?: () => void
}

const COLORS: Record<ToastKind, string> = {
  create: '#059669', // green
  edit: '#2563eb', // blue
  delete: '#dc2626', // red
  info: '#374151', // gray
}

export default function Toast({ visible, message, kind = 'info', onClose }: ToastProps) {
  if (!visible || !message) return null

  const bg = COLORS[kind]

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: '72px',
    right: 20,
    zIndex: 9999999,
    background: bg,
    color: '#fff',
    padding: '10px 14px',
    borderRadius: 8,
    boxShadow: '0 6px 24px rgba(15,23,42,0.2)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 260,
    maxWidth: 420,
    cursor: 'pointer'
  }

  const icon = kind === 'create' ? '✔' : kind === 'edit' ? '✎' : kind === 'delete' ? '✖' : 'ℹ'

  const node = (
    <div style={containerStyle} role="status" aria-live="polite" onClick={() => onClose && onClose()}>
      <div style={{ fontSize: 16, lineHeight: 1 }} aria-hidden>
        {icon}
      </div>
      <div style={{ flex: 1, fontSize: 14, wordBreak: 'break-word' }}>{message}</div>
      <button
        onClick={(e) => { e.stopPropagation(); onClose && onClose() }}
        aria-label="Cerrar aviso"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.95)',
          fontSize: 18,
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  )

  if (typeof document === 'undefined') return node
  return createPortal(node, document.body)
}
