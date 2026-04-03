import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthAdapter from '../services/AuthAdapter'
import { useAuth } from '../services/AuthContext'
import '../styles/login.css'
import initLegacyLogin from '../legacy/loginLegacy'

export default function Login() {
  const [showModal, setShowModal] = useState(false)
  const { user, loading } = useAuth()
  const [role, setRole] = useState<'student' | 'profesor'>('profesor')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const timerRef = useRef<number | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const validateTimerRef = useRef<number | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  useEffect(() => {
    // Si hay usuario autenticado, redirigir automáticamente
    if (!loading && user) {
      if (user.role === 'profesor') navigate('/profesor', { replace: true })
      else if (user.role === 'estudiante') navigate('/estudiante', { replace: true })
      return
    }
    // Initialize legacy login script (noop if not present)
    try {
      initLegacyLogin()
    } catch (e) {
      // fail silently
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading])

  // On mount, clear any leftover demo autofill values
  useEffect(() => {
    const demoEmails = ['student@example.com', 'teacher@example.com', 'prof.nuevo@example.com']
    if (demoEmails.includes(email)) setEmail('')
    if (password && (password === 'password' || password === 'nuevo123')) setPassword('')
  }, [])

  const continueSession = () => {
    try {
      const cached = (window as any).Utils && (window as any).Utils.getUserData ? (window as any).Utils.getUserData() : AuthAdapter.getUser()
      if (!cached) return setShowModal(false)
      if (cached.role === 'profesor') window.location.href = '/profesor'
      else if (cached.role === 'estudiante') window.location.href = '/estudiante'
      else setShowModal(false)
    } catch (err) {
      setShowModal(false)
    }
  }

  const logoutSession = () => {
    AuthAdapter.logout()
    setShowModal(false)
    setTimeout(() => window.location.reload(), 800)
  }

  const onRoleToggle = () => setRole(r => (r === 'student' ? 'profesor' : 'student'))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isValidating) return
    setIsValidating(true)
    setMessage('')
    if (validateTimerRef.current) window.clearTimeout(validateTimerRef.current)
    if (timerRef.current) window.clearTimeout(timerRef.current)

    try {
      const userResult: any = await AuthAdapter.login(email, password, role === 'profesor' ? 'profesor' : 'estudiante')
      setIsValidating(false)
      setIsLoggingIn(true)
      setMessageType('success')
      setMessage('Inicio exitoso')

      timerRef.current = window.setTimeout(() => {
        setIsLoggingIn(false)
        if (userResult.role === 'profesor') navigate('/profesor', { replace: true })
        else navigate('/', { replace: true })
      }, 700)
    } catch (err) {
      setIsValidating(false)
      try {
        const code = (err && (err as any).code) ? String((err as any).code) : ''
        const msg = (err && (err as any).message) ? String((err as any).message) : ''
        let friendly = 'Error en login'
        const loweredCode = code.toLowerCase()
        const loweredMsg = msg.toLowerCase()

        if (
          loweredCode.indexOf('wrong-password') >= 0 ||
          loweredCode.indexOf('invalid-credential') >= 0 ||
          loweredCode.indexOf('user-not-found') >= 0 ||
          loweredMsg.indexOf('wrong-password') >= 0 ||
          loweredMsg.indexOf('invalid-credential') >= 0 ||
          loweredMsg.indexOf('user-not-found') >= 0
        ) {
          friendly = 'Correo electrónico o contraseña incorrectos'
        } else if (loweredCode.indexOf('invalid-email') >= 0 || loweredMsg.indexOf('invalid-email') >= 0) {
          friendly = 'Correo electrónico inválido'
        } else if (loweredCode.indexOf('too-many-requests') >= 0 || loweredMsg.indexOf('too-many-requests') >= 0) {
          friendly = 'Demasiados intentos. Intenta nuevamente más tarde.'
        } else if (loweredCode.indexOf('network-request-failed') >= 0 || loweredMsg.indexOf('network') >= 0) {
          friendly = 'Error de red. Revisa tu conexión e intenta de nuevo.'
        } else if (msg) {
          friendly = msg
        }

        setMessage(friendly)
      } catch (e) {
        setMessage((err && (err as any).message) || 'Error en login')
      }
      setMessageType('error')
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (validateTimerRef.current) window.clearTimeout(validateTimerRef.current)
    }
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f0f4f8', gap: '20px' }}>
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 0.9s linear infinite' }}>
        <circle cx="26" cy="26" r="22" stroke="#e2e8f0" strokeWidth="5" />
        <path d="M26 4a22 22 0 0 1 22 22" stroke="#00628d" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', letterSpacing: '0.03em' }}>Cargando sesión...</div>
    </div>
  )

  return (
    <div className="login-root">
      <div className="login-container">
        <div className="login-header">
          <div className="logo">
            <i className="fas fa-graduation-cap"></i>
            <h1>EduSurvey</h1>
          </div>
          <p>Sistema de Encuestas Académicas</p>
        </div>

        <div className="role-selection">
          <div className="toggle-container">
            <div
              id="roleToggle"
              className={`toggle-switch ${role === 'profesor' ? 'active' : ''}`}
              onClick={onRoleToggle}
              role="button"
              tabIndex={0}
            >
              <div className="toggle-slider" />
              <div className="toggle-labels">
                <span className="student">Estudiante</span>
                <span className="teacher">Profesor</span>
              </div>
            </div>
          </div>
        </div>

        <form id="loginForm" onSubmit={onSubmit}>
          <div className="form-group">
            <div className={`input-container align-down-2`}>
              <i className="fas fa-envelope"></i>
              <input required type="email" id="email" placeholder=" " aria-label="Correo Electrónico" value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" />
              <label htmlFor="email" className="floating">Correo Electrónico</label>
            </div>
          </div>

          <div className="form-group">
            <div className={`input-container align-down-2`}>
              <i className="fas fa-lock"></i>
              <input required type={showPassword ? 'text' : 'password'} id="password" placeholder=" " aria-label="Contraseña" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
              <label htmlFor="password" className="floating">Contraseña</label>
              <button type="button" className={`password-toggle ${showPassword ? 'active' : ''}`} id="passwordToggle" onClick={() => setShowPassword(s => !s)} aria-pressed={showPassword} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn" id="loginBtn" disabled={isValidating || isLoggingIn} aria-busy={isValidating || isLoggingIn}>
            <i className="fas fa-sign-in-alt"></i>
            {isValidating ? ' Validando...' : isLoggingIn ? ' Iniciando sesión...' : ' Iniciar Sesión'}
          </button>

          <div className="forgot-container">
            <a href="#" className="forgot-password"><i className="fas fa-key"></i> ¿Olvidaste tu contraseña?</a>
          </div>
        </form>

        {message && (
          <div className={`message ${messageType} ${message ? 'show' : ''}`} role="status">
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
