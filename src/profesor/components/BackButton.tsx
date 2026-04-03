import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function BackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const isDashboardRoot = String(location.pathname || '').replace(/\/+$/, '') === '/profesor'
  const [topbarHeight, setTopbarHeight] = useState(52)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const el = document.getElementById('top-bar')
    if (el) setTopbarHeight(el.offsetHeight)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const main = document.getElementById('main-content')
    if (!main) return
    if (!isDashboardRoot) {
      main.classList.add('has-back-button')
    } else {
      main.classList.remove('has-back-button')
    }
    return () => { main.classList.remove('has-back-button') }
  }, [isDashboardRoot])

  if (isDashboardRoot) return null

  return (
    <button
      onClick={() => navigate('/profesor')}
      className={`back-to-dashboard-btn${scrolled ? ' is-scrolled' : ''}`}
      style={{ top: scrolled ? topbarHeight : topbarHeight + 20 }}
      aria-label="Volver al Dashboard"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Volver al Dashboard
    </button>
  )
}
