import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthAdapter from '../services/AuthAdapter'
import { useAuth } from '../services/AuthContext'
import Loader from './Loader'
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
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    // Si hay usuario autenticado, redirigir automáticamente (a menos que estemos en la animación de éxito)
    if (!loading && user && !isSuccess) {
      if (user.role === 'profesor') navigate('/profesor', { replace: true })
      else if (user.role === 'estudiante') navigate('/estudiante', { replace: true })
    }

    try {
      initLegacyLogin()
    } catch (e) {
      // fail silently
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, navigate])

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
      setIsSuccess(true)
      setMessageType('success')
      setMessage('Inicio exitoso')

      timerRef.current = window.setTimeout(() => {
        setIsSuccess(false)
        if (userResult.role === 'profesor') navigate('/profesor', { replace: true })
        else navigate('/', { replace: true })
      }, 2500)
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
    if (message) {
      const timer = setTimeout(() => setMessage(''), 4000)
      return () => clearTimeout(timer)
    }
  }, [message])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (validateTimerRef.current) window.clearTimeout(validateTimerRef.current)
    }
  }, [])

  if (loading) return <Loader fullScreen text="Cargando sesión..." />

  return (
    <div className="login-root fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a] overflow-hidden font-outfit">
      {/* Toast Notification */}
      {message && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] animate-fade-in-down">
          <div className={`flex items-center gap-4 px-6 py-4 rounded-[24px] border backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-w-[320px] ${
            messageType === 'success' 
              ? 'bg-emerald-600 border-emerald-500 text-white' 
              : 'bg-red-500/20 border-red-500/30 text-red-50'
          }`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
              messageType === 'success' ? 'bg-white' : 'bg-red-500'
            }`}>
              <span className={`material-symbols-outlined text-[24px] font-bold ${
                messageType === 'success' ? 'text-emerald-600' : 'text-white'
              }`}>
                {messageType === 'success' ? 'check' : 'priority_high'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                {messageType === 'success' ? 'Éxito' : 'Atención'}
              </span>
              <span className="text-sm font-bold tracking-tight">{message}</span>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-[400px] relative z-10 animate-fade-in-up p-4">
        <div className="bg-slate-900/40 backdrop-blur-3xl border border-slate-700/50 shadow-[0_64px_128px_-16px_rgba(0,0,0,0.8)] rounded-[48px] p-6 md:p-8 overflow-hidden relative">
          
          <div className="text-center mb-6">
            <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6 animate-bounce-slow">
              {/* Outer Glow Layer */}
              <div className="absolute inset-0 bg-white/10 rounded-full blur-2xl"></div>
              
              {/* Glass Ring */}
              <div className="absolute inset-2 border-2 border-white/30 rounded-full backdrop-blur-sm"></div>
              
              {/* The Icon */}
              <span 
                className="material-symbols-outlined text-[56px] text-white relative z-10 drop-shadow-lg"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 900, 'GRAD' 0, 'opsz' 48" }}
              >
                fact_check
              </span>
            </div>
            <h1 className="text-5xl font-black bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-transparent leading-none mb-3">
              Encuestas
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] opacity-100">
              Gestión Universitaria
            </p>
          </div>

          <div className="mb-6">
            <div className="bg-slate-950/50 p-1.5 rounded-[24px] flex items-center relative gap-1 border border-white/5 shadow-inner">
              <button 
                onClick={() => setRole('student')}
                className={`flex-1 py-3 px-4 rounded-[18px] text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 relative z-10 ${role === 'student' ? 'text-white' : 'text-slate-500 hover:text-white'}`}
              >
                Estudiante
              </button>
              <button 
                onClick={() => setRole('profesor')}
                className={`flex-1 py-3 px-4 rounded-[18px] text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 relative z-10 ${role === 'profesor' ? 'text-white' : 'text-slate-500 hover:text-white'}`}
              >
                Profesor
              </button>
              <div 
                className={`absolute inset-y-1.5 bg-indigo-600 shadow-md rounded-[18px] transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${role === 'student' ? 'left-1.5 w-[calc(50%-8px)]' : 'left-[calc(50%+2px)] w-[calc(50%-8px)]'}`}
              ></div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-2 group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Correo Electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                  <span className="material-symbols-outlined text-[22px]">alternate_email</span>
                </div>
                <input 
                  required 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-900/50 border-2 border-slate-700/50 focus:border-indigo-500/50 focus:bg-slate-800 rounded-[22px] pl-12 pr-6 py-4 text-sm font-bold transition-all outline-none text-white placeholder:text-slate-500 shadow-inner"
                  placeholder="nombre@ejemplo.com"
                />
              </div>
            </div>

            <div className="space-y-2 group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                  <span className="material-symbols-outlined text-[22px]">lock</span>
                </div>
                <input 
                  required 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border-2 border-slate-700/50 focus:border-indigo-500/50 focus:bg-slate-800 rounded-[22px] pl-12 pr-12 py-4 text-sm font-bold transition-all outline-none text-white placeholder:text-slate-500 shadow-inner"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-5 flex items-center text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isValidating || isLoggingIn || isSuccess}
                  className="w-full bg-white text-slate-950 font-black py-4 rounded-[22px] shadow-[0_20px_40px_-15px_rgba(255,255,255,0.15)] hover:bg-slate-50 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                >
                  {isValidating || isLoggingIn || isSuccess? (
                    <>
                      <div className="w-5 h-5 border-2 border-slate-900/20 border-t-slate-950 rounded-full animate-spin"></div>
                      <span>{isSuccess ? 'Entrando...' : 'Validando...'}</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl font-bold">login</span>
                      <span>Iniciar Sesión</span>
                    </>
                  )}
                </button>
            </div>

            {/* Forgot password link removed per user request */}
          </form>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap');
        .font-outfit { font-family: 'Outfit', sans-serif; }
        
        @keyframes fadeInDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in-down { animation: fadeInDown 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        
        @keyframes bounceSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce-slow { animation: bounceSlow 3s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
