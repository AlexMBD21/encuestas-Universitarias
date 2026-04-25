import React, { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

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
  const [isScrolling, setIsScrolling] = useState<boolean>(false)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    if (!showOnScroll) { 
      setVisible(true)
      setIsScrolling(true)
      return 
    }
    
    const onScroll = (e: Event) => {
      try {
        const target = e.target as HTMLElement | Document;
        let currentScroll = 0;
        if (target === document || (target as any) === window) {
          currentScroll = window.scrollY;
        } else {
          currentScroll = (target as HTMLElement).scrollTop;
        }
        
        if (currentScroll > threshold) {
          setVisible(true);
          setIsScrolling(true);
          
          // Clear existing timer and start a new one to hide after inactivity
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            setIsScrolling(false);
          }, 2500); // 2.5 seconds of inactivity
        } else {
          setVisible(false);
          setIsScrolling(false);
          if (timerRef.current) clearTimeout(timerRef.current);
        }
      } catch (e) {}
    }

    try { 
      const initialScroll = window.scrollY;
      if (initialScroll > threshold) {
        setVisible(true);
        // We don't set isScrolling here so it doesn't pop up immediately on load unless they scroll
      }
    } catch (e) {}

    window.addEventListener('scroll', onScroll, true); 
    window.addEventListener('resize', onScroll);
    
    return () => { 
      try { 
        window.removeEventListener('scroll', onScroll, true); 
        window.removeEventListener('resize', onScroll);
        if (timerRef.current) clearTimeout(timerRef.current);
      } catch (e) {} 
    }
  }, [showOnScroll, threshold])

  const handleClick = () => {
    try {
      if (smooth) window.scrollTo({ top: 0, behavior: 'smooth' })
      else window.scrollTo(0, 0)

      // Also scroll the first scrollable container found, just in case
      const containers = document.querySelectorAll('.overflow-y-auto, .layout-container');
      containers.forEach(c => {
        try { c.scrollTo({ top: 0, behavior: 'smooth' }) } catch(e) {}
      });
    } catch (e) {
      try { window.scrollTo(0, 0) } catch (err) {}
    }
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <button 
      aria-label={title} 
      title={title} 
      className={`group fixed bottom-6 right-6 z-[1200] flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/90 text-white shadow-[0_8px_25px_rgba(15,23,42,0.5)] border border-slate-700/50 backdrop-blur-md transition-all duration-500 hover:bg-slate-800 hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(15,23,42,0.7)] hover:border-slate-500 active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 sm:bottom-8 sm:right-8 sm:h-14 sm:w-14 ${visible && isScrolling ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-90 pointer-events-none'} ${className}`} 
      onClick={handleClick}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:-translate-y-0.5">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>,
    document.body
  )
}
