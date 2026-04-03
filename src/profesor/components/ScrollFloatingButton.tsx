import React, { useEffect, useState } from 'react'

type Props = {
  label?: string
  title?: string
  smooth?: boolean
  className?: string
  /** If true the button is hidden at top and shown after scrolling past `threshold` */
  showOnScroll?: boolean
  /** Number of pixels to scroll before showing the button */
  threshold?: number
}

export default function ScrollFloatingButton({ label = 'Arriba', title = 'Ir arriba', smooth = true, className = '', showOnScroll = true, threshold = 120 }: Props) {
  const [visible, setVisible] = useState<boolean>(!showOnScroll)

  useEffect(() => {
    if (!showOnScroll) { setVisible(true); return }
    const onScroll = () => {
      try { setVisible(window.scrollY > threshold) } catch (e) {}
    }
    // initial check
    try { setVisible(window.scrollY > threshold) } catch (e) {}
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { try { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) } catch (e) {} }
  }, [showOnScroll, threshold])

  const handleClick = () => {
    try {
      if (smooth) window.scrollTo({ top: 0, behavior: 'smooth' })
      else window.scrollTo(0, 0)
    } catch (e) {
      try { window.scrollTo(0, 0) } catch (err) {}
    }
  }

  return (
    <button aria-label={title} title={title} className={`floating-upload-btn floating-circle-btn ${visible ? 'show' : ''} ${className}`} onClick={handleClick}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M12 5l-6 6h4v8h4v-8h4l-6-6z" fill="currentColor" />
      </svg>
      <span className="floating-upload-label">{label}</span>
    </button>
  )
}
